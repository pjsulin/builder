"""Measure app server: serves the iPad page and saves answers into the project.

    uv run survey capture --project .  # then open http://<this-mac>.local:8000 on the iPad

The project supplies measure/checklist.yaml, photos/ and measurements/.

GET  /                  the page (index.html, next to this file)
GET  /api/checklist     checklist.yaml items + how many answers each has
GET  /photos/<name>     reference photos from photos/
GET  /measurements/...  photos saved with earlier answers
POST /api/unref         {id} -> removes the item's reference photo from checklist.yaml
POST /api/submit        {id, values, note, marks, insets, photo, photo_type, annotated}
                        -> measurements/<date>/<HHMMSS>-<id>/entry.json,
                           photo.<ext>, annotated.jpg
"""

import base64
import re
import json
import socket
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import yaml

from ..project import Project

HERE = Path(__file__).resolve().parent
ROOT = PHOTOS = OUT = CHECKLIST = NAME = None   # set by serve() from --project
PORT = 8000

EXT = {"image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif"}


def load_items():
    return yaml.safe_load(CHECKLIST.read_text())["items"]


def answers():
    """id -> list of saved entries, oldest first."""
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
            done = answers()
            items = load_items()
            for it in items:
                it["answers"] = sorted((e for i in [it["id"], *it.get("was", [])] for e in done.get(i, [])),
                                       key=lambda e: e["saved"])
            self.send_json(items)
        elif self.path.startswith("/measurements/"):   # photos of earlier answers
            p = (ROOT / self.path.lstrip("/")).resolve()
            if not p.is_relative_to(OUT) or not p.is_file():
                self.send_json({"error": "no such file"}, 404)
                return
            self.send(200, p.read_bytes(), "image/png" if p.suffix == ".png" else "image/jpeg")
        elif self.path.startswith("/photos/"):
            p = (PHOTOS / self.path[len("/photos/"):]).resolve()
            if p.parent != PHOTOS or not p.is_file():
                self.send_json({"error": "no such photo"}, 404)
                return
            ctype = "image/png" if p.suffix == ".png" else "image/jpeg"
            self.send(200, p.read_bytes(), ctype)
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
        ids = {it["id"] for it in load_items()}
        if body.get("id") not in ids:
            self.send_json({"error": f"unknown item {body.get('id')!r}"}, 400)
            return
        now = datetime.now()
        d = OUT / now.strftime("%Y-%m-%d") / f"{now.strftime('%H%M%S')}-{body['id']}"
        d.mkdir(parents=True)
        entry = {
            "id": body["id"],
            "saved": now.isoformat(timespec="seconds"),
            "values": body.get("values", {}),
            "note": body.get("note", ""),
            "marks": body.get("marks", []),
            "insets": body.get("insets", []),   # detail views: src / dst boxes, 0-1 of the image
            "base": body.get("base"),   # reference photo name, if marked up instead of a new one
        }
        if body.get("photo"):
            ext = EXT.get(body.get("photo_type"), "jpg")
            (d / f"photo.{ext}").write_bytes(decode(body["photo"]))
            entry["photo"] = f"photo.{ext}"
        if body.get("annotated"):
            (d / "annotated.jpg").write_bytes(decode(body["annotated"]))
            entry["annotated"] = "annotated.jpg"
        (d / "entry.json").write_text(json.dumps(entry, indent=2) + "\n")
        print(f"saved {d.relative_to(ROOT)}", flush=True)
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


def serve(project, port=PORT):
    global ROOT, PHOTOS, OUT, CHECKLIST, NAME
    ROOT = Path(project).resolve()
    PHOTOS = ROOT / "photos"
    OUT = ROOT / "measurements"
    CHECKLIST = ROOT / "measure" / "checklist.yaml"
    if not CHECKLIST.is_file():
        sys.exit(f"capture: no checklist at {CHECKLIST}")
    NAME = Project(ROOT).load_spec()["name"]
    host = socket.gethostname().removesuffix(".local")
    print(f"Measure app: http://{host}.local:{port}  (iPad on the same Wi-Fi)", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
