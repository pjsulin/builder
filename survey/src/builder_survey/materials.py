"""The material library: name -> RGB. Includes house-specific ones (walnut, iron,
landscape_block, boiler_green, sauna_wood...) that move to a spec `materials:` section later."""


MATERIALS = {  # name -> RGB
    "block": (190, 190, 185),
    "framed": (235, 225, 205),
    "slab": (160, 160, 160),
    "wood": (200, 160, 110),
    "joist": (200, 160, 110),          # old floor framing; dark brown in renders
    "sauna_wood": (225, 195, 150),
    "glass": (200, 225, 235),
    "glow": (255, 190, 110),           # LED strips; emit light in renders
    "white_paint": (240, 240, 235),    # painted wood: stairs, window sashes, doors
    "rubber": (35, 35, 35),            # stair tread covers
    "pine": (230, 195, 140),           # clear-finished pine (panel cabinet doors)
    "walnut": (110, 70, 40),           # garage shelving boards
    "iron": (25, 25, 25),              # black iron (garage shelving frame)
    "landscape_block": (185, 170, 145),  # patio steps: tan split-face block, grey caps
    "grass": (95, 140, 70),            # lawn
    "flagstone": (150, 140, 125),      # big flat rocks (under the solarium stairs)
    "enamel": (238, 238, 234),         # white appliance enamel
    "appliance_grey": (150, 155, 160), # washer console
    "boiler_green": (30, 90, 55),      # Williamson boiler jacket
    "wh_jacket": (200, 200, 195),      # water heater jacket
    "object": (120, 140, 160),
    "pipe": (40, 40, 40),              # pipe of unknown material
    "steel": (60, 60, 65),
    "copper": (184, 115, 51),
    "pvc": (235, 235, 230),
    "cast_iron": (30, 28, 26),
    "proposed": (90, 150, 220),
    "placeholder": (255, 140, 0),
}


def rgb(name, alpha=1.0):
    r, g, b = MATERIALS[name]
    return (r / 255, g / 255, b / 255, alpha)
