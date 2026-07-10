import osmnx as ox
import networkx as nx
from fastapi import APIRouter, HTTPException
from shapely.geometry import LineString, mapping
from core import geo, ai
from core.config import SPEEDS
from models import RouteAnalysisRequest, OsmRouteRequest

router = APIRouter(tags=["rutas"])


@router.post("/ruta-analisis", summary="Análisis de accesibilidad de una ruta Mapbox")
async def ruta_analisis(req: RouteAnalysisRequest):
    route_line = LineString(req.coordinates)
    colonias   = geo.colonias_en_ruta(route_line)
    analisis   = await ai.analisis_ruta_ia(colonias, req.modo, req.distancia_km, req.duracion_min)
    return {"colonias": colonias, "analisis_ia": analisis}


@router.post(
    "/ruta-osm",
    summary="Ruta accesible usando red vial OSM ponderada por score de accesibilidad",
)
async def ruta_osm(req: OsmRouteRequest):
    G = geo.G_bike if req.modo == "cycling" else geo.G_walk
    if G is None:
        raise HTTPException(503, "Grafo OSM no disponible aún.")

    try:
        orig_node = ox.distance.nearest_nodes(G, X=req.origin_lng, Y=req.origin_lat)
        dest_node = ox.distance.nearest_nodes(G, X=req.dest_lng,   Y=req.dest_lat)
    except Exception as e:
        raise HTTPException(400, f"No se pudieron encontrar nodos cercanos: {e}")

    try:
        route_nodes = ox.routing.shortest_path(G, orig_node, dest_node, weight="accessibility_cost")
    except nx.NetworkXNoPath:
        raise HTTPException(404, "Sin ruta disponible entre esos puntos.")
    except Exception as e:
        raise HTTPException(500, f"Error al calcular ruta: {e}")

    if not route_nodes or len(route_nodes) < 2:
        raise HTTPException(404, "Sin ruta disponible.")

    coords     = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in route_nodes]
    route_line = LineString(coords)
    edge_gdf   = ox.routing.route_to_gdf(G, route_nodes)
    dist_m     = float(edge_gdf["length"].sum())
    dist_km    = round(dist_m / 1000, 2)
    dur_min    = max(1, round(dist_m / SPEEDS.get(req.modo, SPEEDS["walking"]) / 60))
    scores     = edge_gdf["score_colonia"].dropna() if "score_colonia" in edge_gdf.columns else []
    score_avg  = round(float(scores.mean()), 2) if len(scores) else None
    colonias   = geo.colonias_en_ruta(route_line)
    analisis   = await ai.analisis_ruta_ia(colonias, req.modo, dist_km, dur_min)

    return {
        "type": "Feature",
        "geometry": mapping(route_line),
        "properties": {
            "distancia_km":   dist_km,
            "duracion_min":   dur_min,
            "score_promedio": score_avg,
            "modo":           req.modo,
            "nodos":          len(route_nodes),
            "colonias":       colonias,
            "analisis_ia":    analisis,
        },
    }


@router.get("/osm-status", summary="Estado del grafo OSM cargado")
async def osm_status():
    return {
        "grafo_peatonal": {
            "disponible": geo.G_walk is not None,
            "nodos":      len(geo.G_walk.nodes) if geo.G_walk else 0,
            "aristas":    len(geo.G_walk.edges) if geo.G_walk else 0,
        },
        "grafo_ciclista": {
            "disponible": geo.G_bike is not None,
            "nodos":      len(geo.G_bike.nodes) if geo.G_bike else 0,
            "aristas":    len(geo.G_bike.edges) if geo.G_bike else 0,
        },
    }
