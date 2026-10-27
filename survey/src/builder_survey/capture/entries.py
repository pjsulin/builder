"""List measurement entries with their transcripts, and whether the spec cites them.

An entry is cited when its folder path (`measurements/<date>/<time>-<id>`) appears in
model/spec.yaml or any model/plans/*.yaml, as a `source:` value or in a comment.
"""
import json


def list_entries(project):
    """Entries oldest first: {folder, saved, id, question, transcript, cited, void}."""
    texts = [project.spec_path.read_text()] if project.spec_path.is_file() else []
    if project.plans.is_dir():
        texts += [p.read_text() for p in sorted(project.plans.glob("*.yaml"))]
    cited_text = "\n".join(texts)
    out = []
    for f in sorted(project.measurements.glob("*/*/entry.json")):
        e = json.loads(f.read_text())
        folder = str(f.parent.relative_to(project.root))
        transcript = e.get("transcript")
        if transcript is None and e.get("values"):      # v1: typed values and a note
            transcript = "; ".join(f"{k} {v}" for k, v in e["values"].items() if v)
            if e.get("note"):
                transcript = f"{transcript}; {e['note']}" if transcript else e["note"]
        out.append({
            "folder": folder,
            "saved": e.get("saved", ""),
            "id": e.get("id", ""),
            "question": e.get("question") or e.get("id", ""),
            "transcript": transcript,
            "transcript_error": e.get("transcript_error"),
            "cited": folder in cited_text,
            "void": e.get("void"),
        })
    return out


def print_entries(project, uncited=False):
    rows = [e for e in list_entries(project) if not e["void"] and not (uncited and e["cited"])]
    for e in rows:
        mark = "cited" if e["cited"] else "uncited"
        text = e["transcript"] if e["transcript"] is not None else f"(no transcript: {e['transcript_error'] or 'pending'})"
        print(f"{e['folder']}  [{mark}]  {e['question']}\n    {text}")
    if not rows:
        print("no uncited entries" if uncited else "no entries")
