from fastapi import APIRouter, HTTPException
from db import insert_reporte, get_reportes
from models import ReporteRequest

TIPOS_VALIDOS = {"flood", "unsafe", "police", "traffic", "power", "danger"}

router = APIRouter(tags=["reportes"])


@router.post("/reportes", summary="Registra un reporte ciudadano")
async def crear_reporte(req: ReporteRequest):
    if req.tipo not in TIPOS_VALIDOS:
        raise HTTPException(400, f"tipo inválido. Debe ser uno de: {', '.join(TIPOS_VALIDOS)}")
    if not (-90 <= req.lat <= 90 and -180 <= req.lng <= 180):
        raise HTTPException(400, "Coordenadas inválidas")
    row_id = await insert_reporte(req.tipo, req.lat, req.lng, req.colonia)
    return {"id": row_id, "status": "ok"}


@router.get("/reportes", summary="Lista los reportes ciudadanos más recientes")
async def listar_reportes(limit: int = 200):
    if limit > 500:
        limit = 500
    rows = await get_reportes(limit)
    return {"total": len(rows), "reportes": rows}
