"""The element record every generator produces."""


def element(name, phase, material, ctx, parts, notes=None):
    base = material                # the real material, for realistic renders
    if phase == "proposed" and material not in ("placeholder",):
        material = "proposed"
    return {
        "name": name,
        "phase": phase,
        "material": "placeholder" if ctx.placeholder else material,
        "base": base,
        "placeholder": ctx.placeholder,
        "parts": parts,
    }
