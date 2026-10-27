"""Checks: disagreements over TOLERANCE become CONFLICTS with a severity."""


TOLERANCE = 0.5  # inches; relationships that disagree by more are CONFLICTS

# Size of a miss -> how it's drawn. Block walls wander, so small misses are noise.
SEVERITY = ((2, "minor", "#8a8a8a"), (6, "check", "#e08a00"), (float("inf"), "major", "#d62728"))


def severity(off):
    return next((name, color) for limit, name, color in SEVERITY if abs(off) <= limit)


def conflict(report, text, off=None, geom=None):
    name = severity(off)[0] if off is not None else "major"
    report["conflicts"].append({"text": text, "off": off, "geom": geom, "severity": name})
