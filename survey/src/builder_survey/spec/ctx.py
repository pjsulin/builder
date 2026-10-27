"""Value resolution for one spec entry: MISSING / ~ bookkeeping, levels, lengths."""
from ..units import parse_length


class Missing(Exception):
    pass


class Ctx:
    """Resolves values and records MISSING / placeholder use for one element."""

    def __init__(self, spec, report, path):
        self.levels = spec.get("levels", {})
        self.report = report
        self.path = path
        self.placeholder = False

    def len(self, val, field):
        where = f"{self.path}.{field}"
        if val is None or val == "MISSING":
            self.report["missing"].append(where)
            raise Missing(where)
        if isinstance(val, (int, float)):
            return float(val)
        s = str(val).strip()
        if s.startswith("~"):
            self.placeholder = True
            self.report["placeholder"].append(f"{where} = {s}")
            s = s[1:]
        if s in self.levels:
            return self.len(self.levels[s], f"{field}<{s}>")
        return parse_length(s, where)

    def pt(self, val, field):
        if val is None or val == "MISSING":
            return [self.len(None, field)]
        return [self.len(v, f"{field}[{i}]") for i, v in enumerate(val)]


class Blocked(Exception):
    """A relationship refers to a room that isn't placed (yet)."""
