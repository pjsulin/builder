# Capture: phone photo + voice note

How a measurement gets from the house into the spec: the phone takes a photo and records a note, the Mac stores and transcribes it, a Claude session reads the entry into `spec.yaml` citing it with `source:`.

## Setup

**Install the transcriber (once, on the Mac):**

```bash
cd builder/survey && uv sync --extra transcribe      # faster-whisper; the model downloads on first use
```

**HTTPS (once):** iOS Safari only allows in-page recording (`MediaRecorder`) on a secure origin, so the page must be served over HTTPS from the Mac. `mkcert` makes a certificate the phone will trust:

```bash
brew install mkcert
mkcert -install                                      # the local root CA, trusted on this Mac
mkdir -p ~/certs && cd ~/certs
mkcert "$(hostname -s).local" "$(ipconfig getifaddr en0)"   # -> <name>.local+1.pem and -key.pem
```

Install the root CA on the iPhone once: AirDrop or mail `"$(mkcert -CAROOT)/rootCA.pem"` to the phone, open it, then Settings > General > VPN & Device Management > install the profile, then Settings > General > About > Certificate Trust Settings > enable full trust for it.

Point `survey capture` at the certificate, on the command line or in `survey.yaml`:

```bash
uv run survey capture --project ../house --cert ~/certs/mac.local+1.pem --key ~/certs/mac.local+1-key.pem
```

```yaml
# survey.yaml
capture_tls: {cert: ~/certs/mac.local+1.pem, key: ~/certs/mac.local+1-key.pem}
transcribe_model: small.en        # optional; any faster-whisper model name
```

Without a certificate the server runs on HTTP, the page shows a banner, photos still save, and the record button is disabled.

```
$ uv run survey capture --project ../house --cert ~/certs/mac.local+1.pem --key ~/certs/mac.local+1-key.pem
Capture: https://mac.local:8000  (phone on the same Wi-Fi)
GET /
GET /api/checklist
POST /api/submit
saved measurements/2026-11-03/100108-return_height
transcribed 100108-return_height: 'Return pipe is thirty two and a half to the top at the west wall.'
```

## On the phone

Open `https://<mac>.local:8000`. The page lists the open questions from `measure/checklist.yaml`, each with its reference photo if it has one and the last entry's transcript.

Tap a question:

1. **Take photo** opens the camera (several photos per entry; tap a thumbnail to draw a line or add a magnified detail on it, which is optional).
2. **Hold to record a voice note**: hold the button and talk, let go to stop; or tap once to start and again to stop. Say the numbers and what they span ("thirty two and a half from the slab to the top of the pipe, west wall").
3. **Save.** No typing. The phone uploads the photos and the note; the Mac transcribes the note in the background and the question's list entry shows the text when it is done.

One hand, under 30 seconds. Earlier entries are shown under the question with their photos, note player and transcript.

## The entry

Each save writes one folder, which is the record:

```
measurements/2026-11-03/100108-return_height/
  entry.json       see below
  photo-1.jpg      the photos, in the order taken (photo-2.jpg, ...)
  note.m4a         the voice note as the phone recorded it (m4a on iOS; webm or ogg elsewhere)
  transcript.txt   written by the Mac when transcription finishes
  annotated.jpg    the marked-up photo, only when lines or details were drawn
```

```json
{ "id": "return_height", "saved": "2026-11-03T10:01:08",
  "question": "Return pipe height at the west wall",
  "photos": ["photo-1.jpg"], "audio": "note.m4a",
  "transcript": "Return pipe is thirty two and a half to the top at the west wall.",
  "marks": [], "insets": [], "base": null }
```

`transcript` is `null` until transcription finishes. If faster-whisper is not installed, or the file cannot be decoded, the entry gets `"transcript_error": "..."` instead and the server logs it; the audio is still there to transcribe later (`python -c "from builder_survey.capture.transcribe import transcribe; transcribe('measurements/.../100108-return_height')"`). Nothing is guessed in place of a transcript.

v1 entries (from the typed-fields app: `values`, `note`, `photo`) stay as they are and still list and display; `survey entries` shows their values and note where a transcript would be.

An entry filed in error keeps its folder and gets a `"void": "<reason>"` key; it then stops counting as an answer.

## The checklist

`measure/checklist.yaml` v2 is a list of open questions:

```yaml
items:
  - id: return_height                     # the entry folder is <time>-<id>
    question: Return pipe height at the west wall, slab to top of pipe
    photo: laundry-west-wall.jpg          # optional, from photos/
```

v1 items (`title`, `ask`, `fields`, `room`) still load: the title and ask become the question, `room` groups the list, and the fields are shown read-only as a reminder of what to say. `was: [old_id]` makes an earlier id's entries count for a renamed item. **Remove reference photo** on the page deletes the item's `photo:` line.

## From entry to spec

```bash
uv run survey entries --project ../house --uncited
```

lists every entry (oldest first) with its transcript and whether `model/spec.yaml` or a `model/plans/*.yaml` mentions its folder; `--uncited` keeps only the ones nothing cites yet:

```
measurements/2026-11-03/100108-return_height  [uncited]  Return pipe height at the west wall
    Return pipe is thirty two and a half to the top at the west wall.
```

A Claude session (or you) reads the uncited entries, puts the number into the spec entry it measures, and cites the folder with `source:`:

```yaml
pipes:
  zone_b_return:
    source: measurements/2026-11-03/100108-return_height
    corners:
      west: {z: 32.5"}
```

The build checks that the `source:` folder exists, writes it into `survey:source` on the element in `STEM.builder`, and the survey panel in Builder shows it when the element is selected. After `survey build`, the entry is cited and drops out of `--uncited`. Numbers only come from the person who measured; the transcript is the record of what was said, read by a person or an agent, never parsed into the spec automatically ([contract.md](contract.md)).
