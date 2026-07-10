"""Estado global de datos geoespaciales y funciones auxiliares."""
import math
import asyncio
import geopandas as gpd
import networkx as nx
import osmnx as ox
from shapely.geometry import LineString

from .config import GEOJSON_PATH, GRAPH_WALK_PATH, GRAPH_BIKE_PATH

gdf:           gpd.GeoDataFrame | None = None
geojson_bytes: bytes | None = None
G_walk:        nx.MultiDiGraph | None = None
G_bike:        nx.MultiDiGraph | None = None


def load_geojson() -> None:
    global gdf, geojson_bytes
    raw = gpd.read_file(GEOJSON_PATH)
    raw["geometry"] = raw["geometry"].simplify(0.0001, preserve_topology=True)
    gdf = raw
    geojson_bytes = raw.to_json(show_bbox=False).encode()
    print(f"  ✓ GeoJSON cargado: {len(gdf)} colonias | "
          f"{len(GEOJSON_PATH.read_bytes()) // 1024} KB → {len(geojson_bytes) // 1024} KB (simplificado)")


def _assign_weights(G: nx.MultiDiGraph) -> None:
    for u, v, data in G.edges(data=True):
        score  = float(data.get("score_colonia") or 3.0)
        length = float(data.get("length") or 1.0)
        data["accessibility_cost"] = length * score


def _load_or_download_graph(path, query: str, network: str) -> nx.MultiDiGraph:
    if path.exists():
        print(f"  Cargando grafo desde {path.name}…")
        G = ox.load_graphml(path)
    else:
        print(f"  Descargando grafo OSM ({network}) — primera vez, ~30s…")
        G = ox.graph_from_place(query, network_type=network)
        if gdf is not None:
            edges = ox.graph_to_gdfs(G, nodes=False)
            edges = edges.set_crs("EPSG:4326", allow_override=True)
            joined = edges.sjoin(
                gdf[["score_accesibilidad", "geometry"]].rename(
                    columns={"score_accesibilidad": "score_colonia"}
                ),
                how="left", predicate="intersects",
            )
            for (u, v, k), row in joined.iterrows():
                if (u, v, k) in G.edges:
                    G[u][v][k]["score_colonia"] = row.get("score_colonia", 3.0)
        ox.save_graphml(G, path)
    _assign_weights(G)
    return G


async def load_graphs_background() -> None:
    global G_walk, G_bike
    loop = asyncio.get_event_loop()
    try:
        G_walk = await loop.run_in_executor(
            None, _load_or_download_graph,
            GRAPH_WALK_PATH, "Tlalpan, Ciudad de México, Mexico", "walk",
        )
        print(f"  ✓ Grafo peatonal listo: {len(G_walk.nodes)} nodos, {len(G_walk.edges)} aristas")
    except Exception as e:
        print(f"  ✗ Error grafo peatonal: {e}")
    try:
        G_bike = await loop.run_in_executor(
            None, _load_or_download_graph,
            GRAPH_BIKE_PATH, "Tlalpan, Ciudad de México, Mexico", "bike",
        )
        print(f"  ✓ Grafo ciclista listo:  {len(G_bike.nodes)} nodos, {len(G_bike.edges)} aristas")
    except Exception as e:
        print(f"  ✗ Error grafo ciclista: {e}")


# ── Helpers ───────────────────────────────────────────────────────────────────

def safe_int(val) -> int | None:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return int(val)


def safe_float(val) -> float | None:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return round(float(val), 2)


def row_or_404(cve_col: str):
    from fastapi import HTTPException
    subset = gdf[gdf["cve_col"] == cve_col]
    if subset.empty:
        raise HTTPException(404, f"Colonia '{cve_col}' no encontrada")
    return subset.iloc[0]


def colonias_en_ruta(route_line: LineString) -> list:
    buffered = route_line.buffer(0.001)
    intersecting = gdf[gdf.geometry.intersects(buffered)]
    return [
        {
            "cve_col": row["cve_col"],
            "colonia": row["colonia"],
            "score_accesibilidad": safe_float(row["score_accesibilidad"]),
            "nivel_acceso": row["nivel_acceso"],
            "INFRAPEAT": row["INFRAPEAT"],
        }
        for _, row in intersecting.sort_values("score_accesibilidad").iterrows()
    ]
