"""Plans (plans/<name>.yaml) layer onto the spec without editing it."""
import sys

import yaml


# Plans (plans/<name>.yaml) layer onto spec.yaml without editing it:
#   add:    entries in the same shape as spec.yaml; they become `proposed`
#   remove: spec paths of existing entries; they become `demo`
# Only these sections take plan entries (the ones whose builders read `phase`).
# Rooms and their generated walls are the base and can't be changed by a plan.
PLAN_SECTIONS = ("layout.fixtures", "layout.doors", "pipes", "joists", "objects", "cameras")


def apply_plan(spec, name, plans_dir):
    path = plans_dir / f"{name}.yaml"
    if not path.exists():
        sys.exit(f"plan {name!r}: no file {path}")
    plan = yaml.safe_load(path.read_text()) or {}
    unknown = set(plan) - {"description", "add", "remove"}
    if unknown:
        sys.exit(f"plans/{name}.yaml: unknown keys {sorted(unknown)} (use add / remove)")

    def section(dotted, create):
        node = spec
        for key in dotted.split("."):
            if node.get(key) is None:
                if not create:
                    return None
                node[key] = {}
            node = node[key]
        return node

    def flatten(tree, prefix=""):
        """The PLAN_SECTIONS inside an `add:` tree, as (section, entries)."""
        for key, val in (tree or {}).items():
            dotted = f"{prefix}{key}"
            if dotted in PLAN_SECTIONS:
                yield dotted, val or {}
            elif isinstance(val, dict) and any(s.startswith(dotted + ".") for s in PLAN_SECTIONS):
                yield from flatten(val, dotted + ".")
            else:
                sys.exit(f"plans/{name}.yaml: add.{dotted}: a plan can only add to "
                         f"{', '.join(PLAN_SECTIONS)}")

    for dotted, entries in flatten(plan.get("add")):
        target = section(dotted, create=True)
        for key, entry in entries.items():
            if key in target:
                sys.exit(f"plans/{name}.yaml: add.{dotted}.{key} already exists in spec.yaml "
                         f"(remove it and add one under a new name)")
            if dotted == "cameras":
                entry.setdefault("show", "after")
            else:
                if entry.get("phase", "proposed") != "proposed":
                    sys.exit(f"plans/{name}.yaml: add.{dotted}.{key}: added entries are proposed")
                entry["phase"] = "proposed"
            target[key] = entry

    for ref in plan.get("remove") or []:
        dotted, _, key = ref.rpartition(".")
        if dotted not in PLAN_SECTIONS or dotted == "cameras":
            sys.exit(f"plans/{name}.yaml: remove {ref!r}: only entries of "
                     f"{', '.join(s for s in PLAN_SECTIONS if s != 'cameras')} can be removed")
        target = section(dotted, create=False)
        if target is None or key not in target:
            sys.exit(f"plans/{name}.yaml: remove {ref!r}: no such entry in spec.yaml")
        if target[key].get("phase", "existing") != "existing":
            sys.exit(f"plans/{name}.yaml: remove {ref!r}: it is "
                     f"{target[key]['phase']}, not existing")
        target[key]["phase"] = "demo"
