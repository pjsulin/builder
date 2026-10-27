"""Capture server: serves the phone page and saves entries into the project.

    uv run survey capture --project DIR [--port N] [--cert FILE --key FILE]
    # then open http(s)://<this-mac>.local:8000 on the phone

The project supplies measure/checklist.yaml, photos/ and measurements/ (Project paths).
With --cert/--key, or survey.yaml `capture_tls: {cert, key}`, the page is served over
HTTPS, which iOS Safari needs before it allows recording in the page. Over plain
HTTP the page shows a banner and voice notes are unavailable.

GET  /                  the page (index.html, next to this file)
GET  /api/checklist     checklist.yaml items with their saved entries
GET  /photos/<name>     reference photos from photos/
GET  /measurements/...  photos and audio saved with earlier entries
POST /api/unref         {id} -> removes the item's reference photo from checklist.yaml
POST /api/submit        {id, photos: [{data, type}], audio: {data, type}, marks, insets, base, annotated}
                        -> measurements/<date>/<HHMMSS>-<id>/entry.json (v2),
                           photo-N.<ext>, note.<ext>, annotated.jpg; then the note is
                           transcribed on this Mac in the background (transcribe.py)

checklist.yaml v2: items: [{id, question, photo?}]. v1 items ({id, title, ask, fields,
room, photo}) still load; their fields are shown read-only on the page.
entry.json v2: {id, saved, question, photos, audio, transcript, marks, insets, base}.
v1 entries (values, note, photo) are read as they are.
"""

import base64
import json
import re
import socket
import ssl
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import yaml

from ..project import Project

HERE = Path(__file__).resolve().parent
ROOT = PHOTOS = OUT = CHECKLIST = NAME = None   # set by serve() from --project
MODEL = "small.en"
PORT = 8000

EXT = {"image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif"}
AUDIO_EXT = {"audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a", "audio/webm": "webm",
             "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3"}
CTYPE = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic",
         ".m4a": "audio/mp4", ".webm": "audio/webm", ".ogg": "audio/ogg", ".wav": "audio/wav",
         ".mp3": "audio/mpeg", ".txt": "text/plain; charset=utf-8"}

# Transcription threads started by submits, newest last (tests join them).
transcriptions = []


def load_items():
    """checklist.yaml items, v1 or v2, each with `question` set."""
    items = yaml.safe_load(CHECKLIST.read_text()).get("items") or []
    for it in items:
        it.setdefault("question", it.get("title", it["id"]))
        if it.get("ask"):
            it["question"] = f"{it['question']} {it['ask']}".strip()
    return items


def entries():
    """id -> list of saved entries (v1 and v2), oldest first."""
    found = {}
    for f in sorted(OUT.glob("*/*/entry.json")):
        e = json.loads(f.read_text())
        if e.get("void"):        # kept as a record, but not an answer (reason in "void")
            continue
        e["dir"] = str(f.parent.relative_to(ROOT))
        found.setdefault(e["id"], []).append(e)
    return found


def decode(data_url):
    return base64.b64decode(data_url.split(",", 1)[1])


class Handler(BaseHTTPRequestHandler):
    def send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, obj, code=200):
        self.send(code, json.dumps(obj).encode(), "application/json")

    def do_GET(self):
        if self.path == "/":
            page = (HERE / "index.html").read_text().replace("{{name}}", NAME)
            self.send(200, page.encode(), "text/html; charset=utf-8")
        elif self.path == "/api/checklist":
            done = entries()
            items = load_items()
            for it in items:
                it["entries"] = sorted((e for i in [it["id"], *it.get("was", [])] for e in done.get(i, [])),
                                       key=lambda e: e["saved"])
            self.send_json(items)
        elif self.path.startswith("/measurements/"):   # files of earlier entries
            p = (ROOT / self.path.lstrip("/")).resolve()
            if not p.is_relative_to(OUT) or not p.is_file():
                self.send_json({"error": "no such file"}, 404)
                return
            self.send(200, p.read_bytes(), CTYPE.get(p.suffix.lower(), "application/octet-stream"))
        elif self.path.startswith("/photos/"):
            p = (PHOTOS / self.path[len("/photos/"):]).resolve()
            if p.parent != PHOTOS or not p.is_file():
                self.send_json({"error": "no such photo"}, 404)
                return
            self.send(200, p.read_bytes(), CTYPE.get(p.suffix.lower(), "image/jpeg"))
        else:
            self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        if self.path == "/api/unref":
            self.unref()
            return
        if self.path != "/api/submit":
            self.send_json({"error": "not found"}, 404)
            return
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        items = {it["id"]: it for it in load_items()}
        if body.get("id") not in items:
            self.send_json({"error": f"unknown item {body.get('id')!r}"}, 400)
            return
        photos = body.get("photos") or []
        if not photos and not body.get("audio") and not body.get("base"):
            self.send_json({"error": "nothing to save: take a photo or record a note"}, 400)
            return
        now = datetime.now()
        d = OUT / now.strftime("%Y-%m-%d") / f"{now.strftime('%H%M%S')}-{body['id']}"
        d.mkdir(parents=True)
        entry = {
            "id": body["id"],
            "saved": now.isoformat(timespec="seconds"),
            "question": items[body["id"]]["question"],
            "photos": [],
            "audio": None,
            "transcript": None,
            "marks": body.get("marks", []),
            "insets": body.get("insets", []),   # detail views: src / dst boxes, 0-1 of the image
            "base": body.get("base"),   # reference photo name, if marked up instead of a new one
        }
        for i, ph in enumerate(photos, 1):
            name = f"photo-{i}.{EXT.get(ph.get('type'), 'jpg')}"
            (d / name).write_bytes(decode(ph["data"]))
            entry["photos"].append(name)
        if body.get("audio"):
            a = body["audio"]
            ext = AUDIO_EXT.get((a.get("type") or "").split(";")[0].strip())
            if ext is None:
                self.send_json({"error": f"unknown audio type {a.get('type')!r}"}, 400)
                return
            entry["audio"] = f"note.{ext}"
            (d / entry["audio"]).write_bytes(decode(a["data"]))
        if body.get("annotated"):
            (d / "annotated.jpg").write_bytes(decode(body["annotated"]))
            entry["annotated"] = "annotated.jpg"
        (d / "entry.json").write_text(json.dumps(entry, indent=2) + "\n")
        print(f"saved {d.relative_to(ROOT)}", flush=True)
        if entry["audio"]:
            from .transcribe import transcribe
            t = threading.Thread(target=transcribe, args=(d, MODEL), daemon=True)
            transcriptions.append(t)
            t.start()
        self.send_json({"saved": str(d.relative_to(ROOT))})

    def unref(self):
        """Drop an item's reference photo: deletes its `photo:` line in checklist.yaml."""
        item = json.loads(self.rfile.read(int(self.headers["Content-Length"])))["id"]
        path = CHECKLIST
        text = path.read_text()
        m = re.search(rf"^  - id: {re.escape(item)}\n.*?(?=^  - id: |\Z)", text, re.S | re.M)
        if not m:
            self.send_json({"error": f"unknown item {item!r}"}, 400)
            return
        block = re.sub(r"^    photo: .*\n", "", m.group(0), flags=re.M)
        path.write_text(text[:m.start()] + block + text[m.end():])
        print(f"reference photo removed from {item}", flush=True)
        self.send_json({"ok": True})

    def log_message(self, fmt, *args):
        if not getattr(self, "path", "").startswith("/photos/"):
            sys.stderr.write("%s %s\n" % (self.command, self.path))


def make_server(project, port=PORT, cert=None, key=None, host="0.0.0.0"):
    """The server, bound and ready for serve_forever(); HTTPS when cert and key are given."""
    global ROOT, PHOTOS, OUT, CHECKLIST, NAME, MODEL
    proj = Project(project)
    ROOT, PHOTOS, OUT, CHECKLIST = proj.root, proj.photos, proj.measurements, proj.checklist
    if not CHECKLIST.is_file():
        sys.exit(f"capture: no checklist at {CHECKLIST}")
    NAME = proj.load_spec()["name"]
    MODEL = proj.config.get("transcribe_model", "small.en")
    tls = proj.config.get("capture_tls") or {}
    cert = cert or tls.get("cert")
    key = key or tls.get("key")
    if bool(cert) != bool(key):
        sys.exit("capture: --cert and --key go together")
    server = ThreadingHTTPServer((host, port), Handler)
    if cert:
        cert, key = (Path(p).expanduser() for p in (cert, key))
        for p in (cert, key):
            if not p.is_file():
                sys.exit(f"capture: no such file {p}")
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cert, key)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
    return server


def serve(project, port=PORT, cert=None, key=None):
    server = make_server(project, port, cert, key)
    scheme = "https" if cert or (Project(project).config.get("capture_tls")) else "http"
    host = socket.gethostname().removesuffix(".local")
    print(f"Capture: {scheme}://{host}.local:{port}  (phone on the same Wi-Fi)", flush=True)
    if scheme == "http":
        print("No certificate: voice notes need HTTPS on iOS. See survey/docs/capture.md.", flush=True)
    server.serve_forever()
