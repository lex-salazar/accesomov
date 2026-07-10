"""Cliente Groq y funciones de generación de IA."""
import os
import groq

client: groq.AsyncGroq | None = None
chat_system_prompt: str | None = None

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


def init_client() -> None:
    global client
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY no está definida en el entorno")
    client = groq.AsyncGroq(api_key=api_key)


def build_chat_system_prompt(gdf) -> None:
    global chat_system_prompt
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

    chat_system_prompt = f"""Eres un asistente de movilidad accesible para Tlalpan, CDMX.
Ayudas a personas con movilidad reducida, silla de ruedas, adultos mayores y ciclistas.
Responde en español. Sé directo y breve: máximo 2 oraciones. Sin listas ni bullets.

DATOS DE TLALPAN (score 1=mejor, 5=peor):
Score promedio: {promedio}/5 | Distribución: {dist_txt}

COLONIAS CON PEOR ACCESIBILIDAD (score ≥ 4.5):
{peores_txt}

COLONIAS CON MEJOR INFRAESTRUCTURA CICLISTA:
{bici_txt}

COLONIAS MÁS ACCESIBLES (score ≤ 2.5):
{mejores_txt}"""


async def generar_descripcion_ia(row) -> str:
    infra_desc = _INFRAPEAT_DESC.get(row["INFRAPEAT"], row["INFRAPEAT"])
    from .geo import safe_float, safe_int
    prompt = (
        f"Describe en 2-3 oraciones cómo es moverse por {row['colonia']} en Tlalpan "
        f"para una persona con movilidad reducida.\n"
        f"Infraestructura peatonal: {row['INFRAPEAT']} ({infra_desc}).\n"
        f"Score de accesibilidad: {safe_float(row['score_accesibilidad'])}/5 (5=peor).\n"
        f"Accesibilidad peatonal (cuantil 1-5): {safe_int(row['Cp_CAMIN'])}.\n"
        f"Infraestructura ciclista (cuantil 1-5): {safe_int(row['Cp_INFCICL'])}.\n"
        f"Sé empático y menciona el reto principal."
    )
    resp = await client.chat.completions.create(
        model="llama-3.1-8b-instant", max_tokens=250,
        messages=[
            {"role": "system", "content": _SISTEMA_MOVILIDAD},
            {"role": "user",   "content": prompt},
        ],
    )
    return resp.choices[0].message.content.strip()


async def analisis_ruta_ia(colonias: list, modo: str, dist_km: float, dur_min: int) -> str:
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
        resp = await client.chat.completions.create(
            model="llama-3.1-8b-instant", max_tokens=70,
            messages=[
                {"role": "system", "content": _SISTEMA_MOVILIDAD},
                {"role": "user",   "content": prompt},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return ""
