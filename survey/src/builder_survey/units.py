"""Lengths: feet-inches text <-> inches."""
import re
import sys

LEN_RE = re.compile(
    r"^\s*(?:(?P<ft>\d+)')?\s*(?:(?P<in>\d+(?:\.\d+)?)?\s*(?:(?P<num>\d+)/(?P<den>\d+))?\s*\")?\s*$"
)


def parse_length(val, where):
    """'10\'11.5"', '9 1/4"', '6"' or a number of inches -> inches."""
    s = str(val).strip()
    try:
        return float(s)
    except ValueError:
        pass
    m = LEN_RE.match(s)
    if not m or not any(m.group(g) for g in ("ft", "in", "num")):
        sys.exit(f"Can't read length {val!r} at {where}")
    inches = float(m.group("ft") or 0) * 12 + float(m.group("in") or 0)
    if m.group("num"):
        inches += float(m.group("num")) / float(m.group("den"))
    return inches


def ftin(x):
    sign, x = ("-" if x < 0 else ""), abs(x)
    ft, inch = int(x // 12), round((x % 12) * 8) / 8
    if inch == 12:
        ft, inch = ft + 1, 0
    return f"{sign}{ft}'{inch:g}\""
