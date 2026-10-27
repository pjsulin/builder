"""Transcribe an entry's voice note on this Mac with faster-whisper.

The optional dependency group `transcribe` provides it: `uv sync --extra transcribe`.
Without it, the entry is saved with `transcript_error` set and nothing is invented.

The audio is decoded here with PyAV (16 kHz mono float32, what Whisper expects)
rather than by faster-whisper's `decode_audio`, which calls `av.open` with keywords
that PyAV 15+ no longer has.
"""
import json
import sys
from pathlib import Path

RATE = 16000
_models = {}


def _model(name):
    from faster_whisper import WhisperModel   # the `transcribe` extra
    if name not in _models:
        try:        # a cached model loads without touching the network
            _models[name] = WhisperModel(name, device="cpu", compute_type="int8", local_files_only=True)
        except Exception:
            _models[name] = WhisperModel(name, device="cpu", compute_type="int8")
    return _models[name]


def decode(audio):
    """Samples of an audio file (m4a, webm, ogg, wav, mp3) as float32 at 16 kHz mono."""
    import av
    import numpy as np
    resampler = av.AudioResampler(format="flt", layout="mono", rate=RATE)
    chunks = []
    with av.open(str(audio)) as container:
        stream = next(s for s in container.streams if s.type == "audio")
        for frame in container.decode(stream):
            for out in resampler.resample(frame):
                chunks.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):      # flush
            chunks.append(out.to_ndarray().reshape(-1))
    if not chunks:
        raise ValueError(f"{audio}: no audio samples")
    return np.concatenate(chunks).astype(np.float32)


def transcribe_file(audio, model="small.en"):
    """The text of an audio file."""
    segments, _info = _model(model).transcribe(decode(audio), vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip()


def transcribe(entry_dir, model="small.en"):
    """Write transcript.txt and set entry.json `transcript` (or `transcript_error`)."""
    entry_dir = Path(entry_dir)
    path = entry_dir / "entry.json"
    entry = json.loads(path.read_text())
    try:
        text = transcribe_file(entry_dir / entry["audio"], model)
        (entry_dir / "transcript.txt").write_text(text + "\n")
        entry["transcript"] = text
        entry.pop("transcript_error", None)
        print(f"transcribed {entry_dir.name}: {text[:80]!r}", flush=True)
    except ImportError:
        entry["transcript_error"] = "faster-whisper is not installed: uv sync --extra transcribe"
        print(f"{entry_dir.name}: {entry['transcript_error']}", file=sys.stderr, flush=True)
    except Exception as e:   # a bad file or a model download failure: recorded, not hidden
        entry["transcript_error"] = f"{type(e).__name__}: {e}"
        print(f"{entry_dir.name}: transcription failed: {e}", file=sys.stderr, flush=True)
    path.write_text(json.dumps(entry, indent=2) + "\n")
