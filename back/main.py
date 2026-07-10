import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import geo, ai
from db import init_db
from routers import colonias, rutas, chat, media, reportes


@asynccontextmanager
async def lifespan(app: FastAPI):
    geo.load_geojson()
    ai.init_client()
    ai.build_chat_system_prompt(geo.gdf)
    await init_db()
    asyncio.create_task(geo.load_graphs_background())
    yield
    if ai.client:
        await ai.client.close()


app = FastAPI(
    title="AccesoMov API",
    description="Movilidad urbana accesible en Tlalpan, CDMX",
    version="3.0.0",
    lifespan=lifespan,
)

_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
_allowed_origins = ["*"] if _origins_env == "*" else [o.strip() for o in _origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(colonias.router)
app.include_router(rutas.router)
app.include_router(chat.router)
app.include_router(media.router)
app.include_router(reportes.router)
