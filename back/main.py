#!/usr/bin/env python3
"""
AccesoMov API — Movilidad urbana accesible en Tlalpan, CDMX.

Endpoints:
  GET  /colonias             → GeoJSON completo (colonias de Tlalpan)
  GET  /colonias/{cve_col}   → Detalle + descripción generada por IA
  GET  /zonas-riesgo         → Colonias con score >= 4, con centroide
  GET  /resumen              → Estadísticas agregadas
  POST /chat                 → Chat conversacional con contexto de Tlalpan
  POST /ruta-analisis        → Cruza una ruta Mapbox con el GeoJSON
  POST /ruta-osm             → Ruta accesible usando red OSM ponderada por score
"""

from contextlib import asynccontextmanager
import math
import os
import json
from typing import List

import groq
import geopandas as gpd
import networkx as nx
import osmnx as ox
from fastapi import FastAPI, HTTPException
from shapely.geometry import LineString, Point, mapping
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

GEOJSON_PATH     = "tlalpan_accesibilidad.geojson"
GRAPH_WALK_PATH  = "tlalpan_walk.graphml"
GRAPH_BIKE_PATH  = "tlalpan_bike.graphml"

# Velocidades por modo (m/s)
SPEEDS = {"walking": 4000/3600, "cycling": 15000/3600, "driving": 30000/3600}

# En memoria al arrancar
_gdf:             gpd.GeoDataFrame | None = None
_geojson_bytes:   bytes | None = None
_client:          groq.AsyncGroq | None = None
_chat_system_prompt: str | None = None
_G_walk:          nx.MultiDiGraph | None = None
_G_bike:          nx.MultiDiGraph | None = None


# ── Sistema de prompts ────────────────────────────────────────────────────────

_SISTEMA_MOVILIDAD = (
    "Eres un asistente especializado en movilidad urbana inclusiva para la Ciudad de México. "
    "Explica en lenguaje claro y empático, en español, cómo es moverse por Tlalpan para "
    "personas con movilidad reducida, adultos mayores o personas con discapacidad. "
    "Sé directo y humano. Nunca uses tecnicismos innecesarios. Nunca uses markdown."
)

_INFRAPEAT_DESC = {
    "Alta":  "buena presencia de banquetas, rampas y pasos peatonales",
    "Media": "infraestructura peatonal parcial, sin rampas consistentes",
    "Baja":  "banquetas deterioradas o inexistentes en varios tramos",
    "Nula":  "sin infraestructura peatonal formal",
}


def _build_chat_system_prompt(gdf: gpd.GeoDataFrame) -> str:
    promedio = round(float(gdf["score_accesibilidad"].mean()), 2)
    peores = gdf[gdf["score_accesibilidad"] >= 4.5].sort_values("score_accesibilidad", ascending=False)
    peores_txt = "\n".join(
        f"  - {r['colonia']} (score {r['score_accesibilidad']}, peatonal {r['INFRAPEAT']})"
        for _, r in peores.iterrows()
    )
    bici = gdf[gdf["Cp_INFCICL"] <= 2].sort_values("score_accesibilidad")
    bici_txt = "\n".join(f"  - {r['colonia']}" for _, r in bici.head(10).iterrows())
    mejores = gdf[gdf["score_accesibilidad"] <= 2.5].sort_values("score_accesibilidad")
    mejores_txt = "\n".join(f"  - {r['colonia']}" for _, r in mejores.iterrows())
    dist = gdf["nivel_acceso"].value_counts().sort_index()
    dist_txt = " | ".join(f"{k.split('-')[1]}: {v}" for k, v in dist.items())

    return f"""Eres un asistente de movilidad accesible para Tlalpan, CDMX.
Ayudas a personas con movilidad reducida, silla de ruedas, adultos mayores y ciclistas.
Responde en español. Sé directo y breve: máximo 2 oraciones. Sin listas ni bullets.

DATOS DE TLALPAN (score 1=mejor, 5=peor):
Score promedio: {promedio}/5 | Distribución: {dist_txt}

COLONIAS CON PEOR ACCESIBILIDAD:
{peores_txt}

MEJORES PARA CICLISTAS:
{bici_txt}

MEJOR ACCESIBILIDAD GENERAL:
{mejores_txt}"""


# ── OSMnx helpers ────────────────────────────────────────────────────────────

def _assign_accessibility_weights(G: nx.MultiDiGraph, gdf: gpd.GeoDataFrame):
    """
    Añade `accessibility_cost` a cada arista del grafo.
    Costo = longitud × score de la colonia que contiene el punto medio del tramo.
    Tramos sin colonia asignada usan score=3 (neutro).
    """
    gdf_4326 = gdf.to_crs(epsg=4326) if gdf.crs.to_epsg() != 4326 else gdf

    for u, v, key, data in G.edges(keys=True, data=True):
        if "geometry" in data:
            midpoint = data["geometry"].interpolate(0.5, normalized=True)
        else:
            mx = (G.nodes[u]["x"] + G.nodes[v]["x"]) / 2
            my = (G.nodes[u]["y"] + G.nodes[v]["y"]) / 2
            midpoint = Point(mx, my)

        hits = gdf_4326[gdf_4326.geometry.contains(midpoint)]
        score = float(hits.iloc[0]["score_accesibilidad"]) if not hits.empty else 3.0

        length = data.get("length", 50.0)
        # accessibility_cost penaliza tramos con peor accesibilidad
        data["accessibility_cost"] = length * score
        # también guardamos el score para consultas
        data["score_colonia"] = score


def _load_or_download_graph(path: str, network_type: str) -> nx.MultiDiGraph:
    """Carga grafo desde disco si existe, si no lo descarga de OSM y lo guarda."""
    if os.path.exists(path):
        print(f"  Cargando grafo desde {path}…")
        return ox.io.load_graphml(path)

    print(f"  Descargando red OSM ({network_type}) para Tlalpan…")
    G = ox.graph.graph_from_place(
        "Tlalpan, Mexico City, Mexico",
        network_type=network_type,
        simplify=True,
    )
    G = ox.routing.add_edge_speeds(G)
    G = ox.routing.add_edge_travel_times(G)
    return G


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _gdf, _geojson_bytes, _client, _chat_system_prompt, _G_walk, _G_bike

    # GeoJSON de colonias
    _gdf = gpd.read_file(GEOJSON_PATH)
    _geojson_bytes = _gdf.to_json().encode()
    _chat_system_prompt = _build_chat_system_prompt(_gdf)
    print(f"✓ GeoJSON cargado: {len(_gdf)} colonias")

    # Groq
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY no está definida en el entorno")
    _client = groq.AsyncGroq(api_key=api_key)

    # Grafos OSM
    try:
        _G_walk = _load_or_download_graph(GRAPH_WALK_PATH, "walk")
        _assign_accessibility_weights(_G_walk, _gdf)
        if not os.path.exists(GRAPH_WALK_PATH):
            ox.io.save_graphml(_G_walk, filepath=GRAPH_WALK_PATH)
        print(f"✓ Grafo peatonal: {len(_G_walk.nodes)} nodos, {len(_G_walk.edges)} aristas")

        _G_bike = _load_or_download_graph(GRAPH_BIKE_PATH, "bike")
        _assign_accessibility_weights(_G_bike, _gdf)
        if not os.path.exists(GRAPH_BIKE_PATH):
            ox.io.save_graphml(_G_bike, filepath=GRAPH_BIKE_PATH)
        print(f"✓ Grafo ciclista:  {len(_G_bike.nodes)} nodos, {len(_G_bike.edges)} aristas")

    except Exception as e:
        print(f"⚠ Grafos OSM no disponibles: {e}. El endpoint /ruta-osm no funcionará.")

    yield
    await _client.close()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AccesoMov API",
    description="Movilidad urbana accesible en Tlalpan, CDMX",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_or_404(cve_col: str):
    subset = _gdf[_gdf["cve_col"] == cve_col]
    if subset.empty:
        raise HTTPException(404, f"Colonia '{cve_col}' no encontrada")
    return subset.iloc[0]


def _safe_int(val) -> int | None:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return int(val)


def _safe_float(val) -> float | None:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return round(float(val), 2)


async def _generar_descripcion_ia(row) -> str:
    infra_desc = _INFRAPEAT_DESC.get(row["INFRAPEAT"], row["INFRAPEAT"])
    prompt = (
        f"Describe en 2-3 oraciones cómo es moverse por {row['colonia']} en Tlalpan "
        f"para una persona con movilidad reducida.\n"
        f"Infraestructura peatonal: {row['INFRAPEAT']} ({infra_desc}).\n"
        f"Score de accesibilidad: {_safe_float(row['score_accesibilidad'])}/5 (5=peor).\n"
        f"Accesibilidad peatonal (cuantil 1-5): {_safe_int(row['Cp_CAMIN'])}.\n"
        f"Infraestructura ciclista (cuantil 1-5): {_safe_int(row['Cp_INFCICL'])}.\n"
        f"Sé empático y menciona el reto principal."
    )
    resp = await _client.chat.completions.create(
        model="llama-3.1-8b-instant", max_tokens=250,
        messages=[
            {"role": "system", "content": _SISTEMA_MOVILIDAD},
            {"role": "user",   "content": prompt},
        ],
    )
    return resp.choices[0].message.content.strip()


def _colonias_en_ruta(route_line: LineString) -> list:
    buffered = route_line.buffer(0.001)
    intersecting = _gdf[_gdf.geometry.intersects(buffered)]
    return [
        {
            "cve_col": row["cve_col"],
            "colonia": row["colonia"],
            "score_accesibilidad": _safe_float(row["score_accesibilidad"]),
            "nivel_acceso": row["nivel_acceso"],
            "INFRAPEAT": row["INFRAPEAT"],
        }
        for _, row in intersecting.sort_values("score_accesibilidad").iterrows()
    ]


async def _analisis_ruta_ia(colonias: list, modo: str, dist_km: float, dur_min: int) -> str:
    modo_txt = {"walking": "a pie", "cycling": "en bicicleta", "driving": "en auto"}.get(modo, modo)
    cols_txt = ", ".join(
        f"{c['colonia']} (score {c['score_accesibilidad']})" for c in colonias[:5]
    ) or "sin datos de colonias"
    prompt = (
        f"Ruta {modo_txt}: {dist_km:.1f} km, {dur_min} min. "
        f"Colonias: {cols_txt}. "
        f"En 1 oración: si es accesible y la precaución principal."
    )
    try:
        resp = await _client.chat.completions.create(
            model="llama-3.1-8b-instant", max_tokens=70,
            messages=[
                {"role": "system", "content": _SISTEMA_MOVILIDAD},
                {"role": "user",   "content": prompt},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return ""


# ── Endpoints estáticos ───────────────────────────────────────────────────────

@app.get("/colonias", response_class=Response,
         summary="GeoJSON de las colonias de Tlalpan con scores de accesibilidad")
async def get_colonias():
    return Response(content=_geojson_bytes, media_type="application/geo+json")


@app.get("/colonias/{cve_col}", summary="Detalle + análisis IA de una colonia")
async def get_colonia(cve_col: str):
    row = _row_or_404(cve_col)
    try:
        descripcion = await _generar_descripcion_ia(row)
    except Exception as e:
        raise HTTPException(502, f"Error IA: {e}")
    return {
        "cve_col": row["cve_col"],
        "colonia": row["colonia"],
        "alcaldia": "TLALPAN",
        "pob_2010": _safe_int(row["pob_2010"]),
        "score_accesibilidad": _safe_float(row["score_accesibilidad"]),
        "nivel_acceso": row["nivel_acceso"],
        "INFRAPEAT": row["INFRAPEAT"],
        "Cp_CAMIN": _safe_int(row["Cp_CAMIN"]),
        "Cp_INFCICL": _safe_int(row["Cp_INFCICL"]),
        "C_pEPICCAM": _safe_int(row["C_pEPICCAM"]),
        "descripcion_ia": descripcion,
    }


@app.get("/zonas-riesgo", summary="Colonias con score >= 4 (alto riesgo de accesibilidad)")
async def get_zonas_riesgo():
    alto = _gdf[_gdf["score_accesibilidad"] >= 4].copy().sort_values(
        "score_accesibilidad", ascending=False
    )
    result = []
    for _, row in alto.iterrows():
        c = row.geometry.centroid
        result.append({
            "cve_col": row["cve_col"],
            "colonia": row["colonia"],
            "score_accesibilidad": _safe_float(row["score_accesibilidad"]),
            "nivel_acceso": row["nivel_acceso"],
            "INFRAPEAT": row["INFRAPEAT"],
            "centroide": {"lat": round(c.y, 6), "lng": round(c.x, 6)},
        })
    return {"total": len(result), "colonias": result}


@app.get("/resumen", summary="Estadísticas agregadas de accesibilidad en Tlalpan")
async def get_resumen():
    peor = _gdf.loc[_gdf["score_accesibilidad"].idxmax()]
    return {
        "alcaldia": "TLALPAN",
        "total_colonias": len(_gdf),
        "score_promedio": _safe_float(_gdf["score_accesibilidad"].mean()),
        "score_min": _safe_float(_gdf["score_accesibilidad"].min()),
        "score_max": _safe_float(_gdf["score_accesibilidad"].max()),
        "distribucion_infrapeat": _gdf["INFRAPEAT"].value_counts().sort_index().to_dict(),
        "distribucion_nivel_score": _gdf["nivel_acceso"].value_counts().sort_index().to_dict(),
        "colonias_alto_riesgo": int((_gdf["score_accesibilidad"] >= 4).sum()),
        "peor_colonia": {
            "cve_col": peor["cve_col"],
            "colonia": peor["colonia"],
            "score_accesibilidad": _safe_float(peor["score_accesibilidad"]),
            "INFRAPEAT": peor["INFRAPEAT"],
        },
    }


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]


@app.post("/chat", summary="Chat sobre movilidad accesible en Tlalpan")
async def chat(request: ChatRequest):
    msgs = [m for m in request.messages]
    while msgs and msgs[0].role == "assistant":
        msgs.pop(0)
    if not msgs:
        raise HTTPException(422, "No hay mensajes de usuario")
    try:
        resp = await _client.chat.completions.create(
            model="llama-3.1-8b-instant", max_tokens=150,
            messages=[
                {"role": "system", "content": _chat_system_prompt},
                *[{"role": m.role, "content": m.content} for m in msgs],
            ],
        )
        return {"response": resp.choices[0].message.content.strip()}
    except groq.APIError as e:
        raise HTTPException(502, f"Error Groq: {e.message}")
    except Exception as e:
        raise HTTPException(502, str(e))


# ── Análisis de ruta Mapbox ───────────────────────────────────────────────────

class RouteAnalysisRequest(BaseModel):
    coordinates: List[List[float]]
    modo: str
    distancia_km: float
    duracion_min: int


@app.post("/ruta-analisis", summary="Análisis de accesibilidad de una ruta Mapbox")
async def ruta_analisis(req: RouteAnalysisRequest):
    route_line = LineString(req.coordinates)
    colonias   = _colonias_en_ruta(route_line)
    analisis   = await _analisis_ruta_ia(colonias, req.modo, req.distancia_km, req.duracion_min)
    return {"colonias": colonias, "analisis_ia": analisis}


# ── Ruta OSM ponderada por accesibilidad ─────────────────────────────────────

class OsmRouteRequest(BaseModel):
    origin_lat:  float
    origin_lng:  float
    dest_lat:    float
    dest_lng:    float
    modo:        str = "walking"   # walking | cycling | driving


@app.post(
    "/ruta-osm",
    summary="Ruta accesible usando red vial OSM ponderada por score de accesibilidad",
    description="""
Calcula la ruta óptima entre dos puntos usando OpenStreetMap + NetworkX.

A diferencia de Mapbox Directions (que minimiza tiempo o distancia),
este endpoint minimiza el **costo de accesibilidad**: `distancia × score_colonia`.

Resultado: rutas que evitan zonas con banquetas deterioradas, sin rampas
o sin iluminación, aunque sean un poco más largas.

Devuelve GeoJSON LineString + colonias + análisis IA.
    """,
)
async def ruta_osm(req: OsmRouteRequest):
    # Seleccionar grafo según modo
    if req.modo == "cycling":
        G = _G_bike
    else:
        G = _G_walk

    if G is None:
        raise HTTPException(
            503,
            "Grafo OSM no disponible. Asegúrate de que el servidor arrancó con conexión a internet."
        )

    # Nodos más cercanos al origen y destino
    try:
        orig_node = ox.distance.nearest_nodes(G, X=req.origin_lng, Y=req.origin_lat)
        dest_node = ox.distance.nearest_nodes(G, X=req.dest_lng,   Y=req.dest_lat)
    except Exception as e:
        raise HTTPException(400, f"No se pudieron encontrar nodos cercanos: {e}")

    # Ruta minimizando accessibility_cost (tramos en zonas accesibles son más baratos)
    try:
        route_nodes = ox.routing.shortest_path(G, orig_node, dest_node, weight="accessibility_cost")
    except nx.NetworkXNoPath:
        raise HTTPException(404, "Sin ruta disponible entre esos puntos en la red OSM.")
    except Exception as e:
        raise HTTPException(500, f"Error al calcular ruta: {e}")

    if route_nodes is None or len(route_nodes) < 2:
        raise HTTPException(404, "Sin ruta disponible.")

    # Construir geometría GeoJSON del camino
    coords = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in route_nodes]
    route_line = LineString(coords)

    # Métricas: distancia real y tiempo estimado
    edge_gdf   = ox.routing.route_to_gdf(G, route_nodes)
    dist_m     = float(edge_gdf["length"].sum())
    dist_km    = round(dist_m / 1000, 2)
    speed_ms   = SPEEDS.get(req.modo, SPEEDS["walking"])
    dur_min    = max(1, round(dist_m / speed_ms / 60))

    # Score promedio de accesibilidad de la ruta
    scores     = edge_gdf["score_colonia"].dropna() if "score_colonia" in edge_gdf.columns else []
    score_avg  = round(float(scores.mean()), 2) if len(scores) else None

    # Colonias que cruza + análisis IA
    colonias   = _colonias_en_ruta(route_line)
    analisis   = await _analisis_ruta_ia(colonias, req.modo, dist_km, dur_min)

    return {
        "type": "Feature",
        "geometry": mapping(route_line),
        "properties": {
            "distancia_km":  dist_km,
            "duracion_min":  dur_min,
            "score_promedio": score_avg,
            "modo":          req.modo,
            "nodos":         len(route_nodes),
            "colonias":      colonias,
            "analisis_ia":   analisis,
        },
    }


@app.get("/osm-status", summary="Estado del grafo OSM cargado")
async def osm_status():
    return {
        "grafo_peatonal": {
            "disponible": _G_walk is not None,
            "nodos": len(_G_walk.nodes) if _G_walk else 0,
            "aristas": len(_G_walk.edges) if _G_walk else 0,
        },
        "grafo_ciclista": {
            "disponible": _G_bike is not None,
            "nodos": len(_G_bike.nodes) if _G_bike else 0,
            "aristas": len(_G_bike.edges) if _G_bike else 0,
        },
    }
