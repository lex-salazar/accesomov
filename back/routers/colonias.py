from fastapi import APIRouter
from fastapi.responses import Response
from core import geo, ai

router = APIRouter(tags=["colonias"])


@router.get("/colonias", response_class=Response,
            summary="GeoJSON de las colonias de Tlalpan con scores de accesibilidad")
async def get_colonias():
    return Response(content=geo.geojson_bytes, media_type="application/geo+json")


@router.get("/colonias/{cve_col}", summary="Detalle + análisis IA de una colonia")
async def get_colonia(cve_col: str):
    from fastapi import HTTPException
    row = geo.row_or_404(cve_col)
    try:
        descripcion = await ai.generar_descripcion_ia(row)
    except Exception as e:
        raise HTTPException(502, f"Error IA: {e}")
    return {
        "cve_col":             row["cve_col"],
        "colonia":             row["colonia"],
        "alcaldia":            "TLALPAN",
        "pob_2010":            geo.safe_int(row["pob_2010"]),
        "score_accesibilidad": geo.safe_float(row["score_accesibilidad"]),
        "nivel_acceso":        row["nivel_acceso"],
        "INFRAPEAT":           row["INFRAPEAT"],
        "Cp_CAMIN":            geo.safe_int(row["Cp_CAMIN"]),
        "Cp_INFCICL":          geo.safe_int(row["Cp_INFCICL"]),
        "C_pEPICCAM":          geo.safe_int(row["C_pEPICCAM"]),
        "descripcion_ia":      descripcion,
    }


@router.get("/zonas-riesgo", summary="Colonias con score >= 4 (alto riesgo de accesibilidad)")
async def get_zonas_riesgo():
    alto = geo.gdf[geo.gdf["score_accesibilidad"] >= 4].copy().sort_values(
        "score_accesibilidad", ascending=False
    )
    result = []
    for _, row in alto.iterrows():
        c = row.geometry.centroid
        result.append({
            "cve_col":             row["cve_col"],
            "colonia":             row["colonia"],
            "score_accesibilidad": geo.safe_float(row["score_accesibilidad"]),
            "nivel_acceso":        row["nivel_acceso"],
            "INFRAPEAT":           row["INFRAPEAT"],
            "centroide":           {"lat": round(c.y, 6), "lng": round(c.x, 6)},
        })
    return {"total": len(result), "colonias": result}


@router.get("/resumen", summary="Estadísticas agregadas de accesibilidad en Tlalpan")
async def get_resumen():
    peor = geo.gdf.loc[geo.gdf["score_accesibilidad"].idxmax()]
    return {
        "alcaldia":                "TLALPAN",
        "total_colonias":          len(geo.gdf),
        "score_promedio":          geo.safe_float(geo.gdf["score_accesibilidad"].mean()),
        "score_min":               geo.safe_float(geo.gdf["score_accesibilidad"].min()),
        "score_max":               geo.safe_float(geo.gdf["score_accesibilidad"].max()),
        "distribucion_infrapeat":  geo.gdf["INFRAPEAT"].value_counts().sort_index().to_dict(),
        "distribucion_nivel_score":geo.gdf["nivel_acceso"].value_counts().sort_index().to_dict(),
        "colonias_alto_riesgo":    int((geo.gdf["score_accesibilidad"] >= 4).sum()),
        "peor_colonia": {
            "cve_col":             peor["cve_col"],
            "colonia":             peor["colonia"],
            "score_accesibilidad": geo.safe_float(peor["score_accesibilidad"]),
            "INFRAPEAT":           peor["INFRAPEAT"],
        },
    }
