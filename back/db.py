"""Persistencia de reportes ciudadanos con SQLite."""
import asyncio
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "alivia.db"


def _init():
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS reportes (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo    TEXT NOT NULL,
            lat     REAL NOT NULL,
            lng     REAL NOT NULL,
            colonia TEXT,
            ts      TEXT DEFAULT (datetime('now'))
        )
    """)
    con.commit()
    con.close()


async def init_db():
    await asyncio.get_event_loop().run_in_executor(None, _init)


async def insert_reporte(tipo: str, lat: float, lng: float, colonia: str | None) -> int:
    def _insert():
        con = sqlite3.connect(DB_PATH)
        cur = con.execute(
            "INSERT INTO reportes (tipo, lat, lng, colonia) VALUES (?,?,?,?)",
            (tipo, lat, lng, colonia),
        )
        row_id = cur.lastrowid
        con.commit()
        con.close()
        return row_id
    return await asyncio.get_event_loop().run_in_executor(None, _insert)


async def get_reportes(limit: int = 200) -> list[dict]:
    def _query():
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row
        rows = con.execute(
            "SELECT * FROM reportes ORDER BY ts DESC LIMIT ?", (limit,)
        ).fetchall()
        con.close()
        return [dict(r) for r in rows]
    return await asyncio.get_event_loop().run_in_executor(None, _query)
