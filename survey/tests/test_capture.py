"""The capture server on a temp project: a v2 entry with a photo and a real audio
clip, the files and entry.json it writes, transcription when the extra is installed,
v1 entries still listed, and the cited / uncited logic of `survey entries`."""
import base64
import json
import math
import struct
import threading
import urllib.request
import wave
from io import BytesIO

import pytest

from builder_survey.capture import serve
from builder_survey.capture.entries import list_entries
from builder_survey.project import Project

# A 1x1 JPEG.
JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8Q"
    "EBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k="
)


def wav_bytes(seconds=1.0, rate=16000):
    """A short real audio clip: a 440 Hz tone with a fade, 16-bit mono WAV."""
    n = int(seconds * rate)
    frames = b"".join(
        struct.pack("<h", int(12000 * math.sin(2 * math.pi * 440 * i / rate) * min(1, (n - i) / rate)))
        for i in range(n)
    )
    buf = BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(frames)
    return buf.getvalue()


def data_url(mime, data):
    return f"data:{mime};base64," + base64.b64encode(data).decode()


@pytest.fixture
def project(tmp_path):
    (tmp_path / "model").mkdir()
    (tmp_path / "model" / "spec.yaml").write_text("name: Test house\n")
    (tmp_path / "survey.yaml").write_text("transcribe_model: tiny.en\n")   # the smallest model: quick to fetch
    (tmp_path / "measure").mkdir()
    (tmp_path / "measure" / "checklist.yaml").write_text(
        "items:\n"
        "  - id: return_height\n    question: Return pipe height at the west wall\n"
        "  - id: old_item\n    title: Old item\n    ask: 'How wide?'\n    room: office\n"
        "    fields: [{key: width, label: Width, kind: length}]\n"
    )
    (tmp_path / "photos").mkdir()
    v1 = tmp_path / "measurements" / "2026-10-23" / "100000-old_item"
    v1.mkdir(parents=True)
    (v1 / "entry.json").write_text(json.dumps({
        "id": "old_item", "saved": "2026-10-23T10:00:00", "values": {"width": "10'8\""}, "note": "by the door",
        "marks": [], "base": None,
    }))
    return tmp_path


@pytest.fixture
def server(project):
    s = serve.make_server(project, port=0, host="127.0.0.1")
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()
    yield f"http://127.0.0.1:{s.server_address[1]}"
    s.shutdown()


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def get(url):
    with urllib.request.urlopen(url) as r:
        return r.status, r.headers["Content-Type"], r.read()


def test_v2_entry_with_photo_and_audio(project, server):
    audio = wav_bytes()
    code, out = post(server + "/api/submit", {
        "id": "return_height",
        "photos": [{"data": data_url("image/jpeg", JPEG), "type": "image/jpeg"}],
        "audio": {"data": data_url("audio/wav", audio), "type": "audio/wav"},
        "marks": [{"a": [0.1, 0.1], "b": [0.5, 0.5], "label": "32\""}],
        "insets": [], "base": None,
    })
    assert code == 200, out
    folder = project / out["saved"]
    assert folder.parent.parent.name == "measurements" and folder.name.endswith("-return_height")
    assert (folder / "photo-1.jpg").read_bytes() == JPEG
    assert (folder / "note.wav").read_bytes() == audio
    for t in serve.transcriptions:
        t.join(timeout=600)
    entry = json.loads((folder / "entry.json").read_text())
    assert entry["id"] == "return_height"
    assert entry["question"] == "Return pipe height at the west wall"
    assert entry["photos"] == ["photo-1.jpg"] and entry["audio"] == "note.wav"
    assert entry["marks"][0]["label"] == "32\"" and entry["base"] is None
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        assert "faster-whisper is not installed" in entry["transcript_error"]
        assert entry["transcript"] is None
    else:
        assert isinstance(entry["transcript"], str), entry   # a tone transcribes to little or nothing
        assert (folder / "transcript.txt").read_text() == entry["transcript"] + "\n"
        assert "transcript_error" not in entry

    # The files serve back with their types, and the checklist lists the entry.
    status, ctype, body = get(server + "/" + out["saved"] + "/note.wav")
    assert status == 200 and ctype == "audio/wav" and body == audio
    status, _, body = get(server + "/api/checklist")
    items = {it["id"]: it for it in json.loads(body)}
    assert [e["dir"] for e in items["return_height"]["entries"]] == [out["saved"]]


def test_v1_items_and_entries_still_list(server):
    _, _, body = get(server + "/api/checklist")
    items = {it["id"]: it for it in json.loads(body)}
    old = items["old_item"]
    assert old["question"] == "Old item How wide?"
    assert old["fields"][0]["key"] == "width"
    assert old["entries"][0]["values"] == {"width": "10'8\""}
    assert old["entries"][0]["dir"] == "measurements/2026-10-23/100000-old_item"


def test_submit_refuses_empty_and_unknown(server):
    assert post(server + "/api/submit", {"id": "nope", "photos": []})[0] == 400
    assert post(server + "/api/submit", {"id": "return_height", "photos": []})[0] == 400
    code, out = post(server + "/api/submit", {
        "id": "return_height", "photos": [], "audio": {"data": data_url("audio/flac", b"x"), "type": "audio/flac"},
    })
    assert code == 400 and "audio type" in out["error"]


def test_page_serves_and_names_the_model(server):
    _, ctype, body = get(server)
    assert ctype.startswith("text/html") and b"Test house" in body and b"MediaRecorder" in body


def test_entries_cited_and_uncited(project):
    v2 = project / "measurements" / "2026-11-03" / "100108-return_height"
    v2.mkdir(parents=True)
    (v2 / "entry.json").write_text(json.dumps({
        "id": "return_height", "saved": "2026-11-03T10:01:08", "question": "Return pipe height",
        "photos": ["photo-1.jpg"], "audio": "note.m4a", "transcript": "thirty two inches to the top",
        "marks": [], "insets": [], "base": None,
    }))
    (project / "model" / "plans").mkdir()
    (project / "model" / "plans" / "x.yaml").write_text(
        "add:\n  objects:\n    a: {type: box, source: measurements/2026-10-23/100000-old_item}\n")
    rows = list_entries(Project(project))
    assert [(r["folder"], r["cited"]) for r in rows] == [
        ("measurements/2026-10-23/100000-old_item", True),
        ("measurements/2026-11-03/100108-return_height", False),
    ]
    assert rows[0]["transcript"] == "width 10'8\"; by the door"       # v1: values and note
    assert rows[1]["transcript"] == "thirty two inches to the top"
    (project / "model" / "spec.yaml").write_text("name: T\npipes:\n  r:\n    source: measurements/2026-11-03/100108-return_height\n")
    assert all(r["cited"] for r in list_entries(Project(project)))
