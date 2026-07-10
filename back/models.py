from typing import List
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class RouteAnalysisRequest(BaseModel):
    coordinates: List[List[float]]
    modo: str
    distancia_km: float
    duracion_min: int


class OsmRouteRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat:   float
    dest_lng:   float
    modo:       str = "walking"


class AudioBase64Request(BaseModel):
    audio_b64: str
    mime:      str = "audio/m4a"


class ReporteRequest(BaseModel):
    tipo:    str
    lat:     float
    lng:     float
    colonia: str | None = None
