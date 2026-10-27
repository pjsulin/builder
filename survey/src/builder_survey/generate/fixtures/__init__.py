"""Fixture types (one module each, registered in registry.TYPES) and their placement."""
from . import appliance, boiler, box, cabinet_doors, cylinder, sauna, shelving, stairs, water_heater  # noqa: F401  (register the types)
from .place import place_fixtures

__all__ = ["place_fixtures"]
