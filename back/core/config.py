from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

GEOJSON_PATH    = BASE_DIR / "tlalpan_accesibilidad.geojson"
GRAPH_WALK_PATH = BASE_DIR / "tlalpan_walk.graphml"
GRAPH_BIKE_PATH = BASE_DIR / "tlalpan_bike.graphml"

SPEEDS = {
    "walking": 4000 / 3600,
    "cycling": 15000 / 3600,
    "driving": 30000 / 3600,
}
