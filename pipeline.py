"""
Pipeline de enriquecimiento, análisis y exportación (HU-06, HU-07, HU-08).
Recibe las reseñas crudas de scraper_playwright y produce Excel + JSON.

Uso:
    python pipeline.py
"""

import os
import json
import asyncio
from datetime import datetime, date

import pandas as pd
import nltk
from dateutil.relativedelta import relativedelta
from rake_nltk import Rake
from textblob import TextBlob
import gender_guesser.detector as gender_det

from scraper_playwright import fetch_all_buildings, BUILDINGS

# ---------------------------------------------------------------------------
# Rutas de salida
# ---------------------------------------------------------------------------
DATA_DIR       = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_XLSX    = os.path.join(DATA_DIR, "informe_multifamily.xlsx")
OUTPUT_REVIEWS = os.path.join(DATA_DIR, "reviews.json")
OUTPUT_METRICS = os.path.join(DATA_DIR, "metrics.json")

# ---------------------------------------------------------------------------
# NLP setup
# ---------------------------------------------------------------------------
nltk.download("stopwords",  quiet=True)
nltk.download("punkt",      quiet=True)
nltk.download("punkt_tab",  quiet=True)

rake     = Rake(language="spanish")
detector = gender_det.Detector(case_sensitive=False)

try:
    from googletrans import Translator
    _translator = Translator()
except ImportError:
    _translator = None

# ---------------------------------------------------------------------------
# Diccionarios de clasificación (portados del scraper v4.0)
# ---------------------------------------------------------------------------
POS_CATS = {
    "Atención del personal": [
        "atencion","atención","personal","administracion","administración","trato",
        "amabilidad","recepcion","recepción","staff","service","support","conserjeria",
        "porteria","gestión","gestora","conserje","atencoin","persnal","amblidad",
        "recepsion","conserge","servicio","equipo","profesional",
    ],
    "Diseño/calidad interior": [
        "diseno","diseño","acabados","decoracion","decoración","interior","terminaciones",
        "calidad","comodidad","ambiente","elegante","espacios comunes","lobby","hall",
        "disenio","decpracion","inteior","acabado","comodid","ambientee","infraestructura",
        "bonito","proyecto","edificio","lindo","bello","hermoso","comodo",
    ],
    "Ubicación": [
        "ubicacion","ubicación","localizacion","localización","zona","barrio","vecindario",
        "lugar","cercania","cercanía","acceso","gps","metro","micro","transporte",
        "ubicasion","localisacion","cercaniia","transorte",
    ],
    "Limpieza/mantenimiento": [
        "limpieza","limpio","higiene","mantenimiento","aseo","desinfeccion","desinfección",
        "escoba","orden","basura","limpiesa","mantenimento","aseoo",
    ],
    "Seguridad": [
        "seguridad","seguro","vigilancia","proteccion","protección","camara","cámara",
        "guardia","alarma","cctv","seguriad","inseguro","protecion",
    ],
    "Precio/Costo": [
        "costo","caro","valor","precio","arriendo","aumento","subida","costro","pricio","valorr",
    ],
    "Amenities": [
        "amenidades","instalaciones","gimnasio","gym","piscina","terraza","quincho","cowork",
        "lavanderia","salón","sala","jacuzzi","spa","pet friendly","lobby","aminidades",
        "gimsnasio","lavnderia","quinch","áreas comunes","áreas","areas","amenities",
    ],
    "Felicitaciones": [
        "excelente","exelent","encantó","wonderfull","encanta","espectacular",
        "muy bueno","perfect","perfecto",
    ],
    "Otros": [],
}

NEG_CATS = {
    "Higiene ambiental": [
        "olor","olores","moho","humedad","suciedad","inundación","sucio","oloor",
        "oloroso","humeda","aseo","aseó",
    ],
    "Mantenciones": [
        "mantencion","mantenimiento","reparacion","reparación","averia","avería",
        "arreglo","falla","mantenimineto","reparar","fajla",
    ],
    "Conectividad": [
        "internet","wifi","conexion","conexión","latencia","corte","señal","fibra",
        "wiffi","wify","net","conecion",
    ],
    "Calefacción": ["calefaccion","calefacción","frio","frío","calor","calefaion"],
    "Estacionamiento": [
        "estacionamiento","parking","garaje","cochera","parkin","estacionaminto",
    ],
    "Atención cliente": [
        "telefono","teléfono","email","demora","reclamo","queja","supervisión",
        "atencion","administrado","service","amigable","demora","administración",
        "administracion","atención",
    ],
    "Garantía": ["deposito","depósito","fianza","garantia","garantía","debposito","fianzia"],
    "Cobros": [
        "pago","facturación","cobranza","cobros","reembolso","caro","aumento","subida",
        "cobro","excesivo","cobran","multa","cobrarte",
    ],
    "Ruidos": ["ruido","bulla","sonido","noise","tráfico","música","ruiddo","bullla"],
    "Seguridad": ["seguridad","seguro","inseguro","robo","hurto","seguriad","roban","robaron","roba"],
    "Crítica": ["horrible","peor","terrible","desagradable","pésimo","mala experiencia"],
    "Otros": [],
}

POS_PHRASES = [
    "buen ambiente","buen servicio","trato excelente","excelente ubicación",
    "vistas hermosas","servicio rápido","wifi gratis","gente amable",
    "espacios amplios","diseño moderno",
]
NEG_PHRASES = [
    "mala internet","sin señal wifi","internet lento","mucho ruido","ruido nocturno",
    "poca limpieza","cobro excesivo","demora pago","fianza retenida",
    "sin estacionamiento","agua fría","servicio lento",
]

AMENITIES = [
    "gimnasio","piscina","terraza","quincho","cowork","lavanderia",
    "sala de cine","jacuzzi","spa","pet friendly","lobby",
]

# ---------------------------------------------------------------------------
# Funciones de enriquecimiento
# ---------------------------------------------------------------------------

def _sentiment(text: str, score: int) -> str:
    if score >= 4:
        return "Positiva"
    if score <= 2:
        return "Negativa"
    if not text or len(text.strip()) < 5:
        return "Sin Comentario"
    pol = TextBlob(text).sentiment.polarity
    if pol > 0:
        return "Positiva"
    if pol < 0:
        return "Negativa"
    return "Neutra"


def _classify(text: str, senti: str):
    txt = (text or "").lower()
    if not txt or len(txt.strip()) < 5:
        return ["Sin Comentario"], []
    rake.extract_keywords_from_text(txt)
    keywords = set(rake.get_ranked_phrases())
    temas = []
    frases = POS_PHRASES if senti == "Positiva" else NEG_PHRASES
    for phrase in frases:
        if phrase in txt:
            temas.append(phrase)
    cats = POS_CATS if senti == "Positiva" else NEG_CATS if senti == "Negativa" else {}
    for cat, kws in cats.items():
        if any(k in txt or k in keywords for k in kws):
            temas.append(cat)
    amenidades = [a for a in AMENITIES if a in txt]
    return temas or ["Otros"], amenidades


def enrich(df: pd.DataFrame) -> pd.DataFrame:
    """Agrega PrimerNombre, Sexo, Sentimiento, Temas, Amenidades al DataFrame."""
    df = df.copy()
    df["Fecha"] = pd.to_datetime(df["Fecha"], errors="coerce")
    df["PrimerNombre"] = df["Usuario"].str.split().str[0].fillna("")
    df["Sexo"] = df["PrimerNombre"].apply(
        lambda n: detector.get_gender(n) if n else "unknown"
    )
    df["Sentimiento"] = df.apply(
        lambda r: _sentiment(r["Texto"], r["Score"]), axis=1
    )
    df[["Temas", "Amenidades"]] = df.apply(
        lambda r: _classify(r["Texto"], r["Sentimiento"]), axis=1, result_type="expand"
    )
    return df


# ---------------------------------------------------------------------------
# Funciones de métricas
# ---------------------------------------------------------------------------

def build_metrics(df: pd.DataFrame) -> pd.DataFrame:
    mes_ant = datetime.now() - relativedelta(months=1)
    rows = []
    for b, grp in df.groupby("Edificio"):
        total   = len(grp)
        ca      = grp["Score"].mean() if total else 0
        cp      = grp[grp["Fecha"] < mes_ant]["Score"].mean() if total else 0
        nuevas  = grp[grp["Fecha"] >= mes_ant].shape[0]
        pos_pct = (grp["Sentimiento"] == "Positiva").mean() * 100 if total else 0
        neg_pct = (grp["Sentimiento"] == "Negativa").mean() * 100 if total else 0
        rows.append({
            "Edificio":    b,
            "CalifActual": round(ca, 2),
            "CalifPrevio": round(cp, 2),
            "Variacion":   round(ca - cp, 2),
            "ReseñasTot":  total,
            "NuevasMes":   nuevas,
            "Pos%":        round(pos_pct, 1),
            "Neg%":        round(neg_pct, 1),
        })
    return pd.DataFrame(rows)


def build_resumen(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for b, grp in df.groupby("Edificio"):
        for m, label in [(None, "Hist"), (12, "12m"), (6, "6m"), (3, "3m")]:
            cutoff = None if m is None else datetime.now() - relativedelta(months=m)
            dh  = grp if cutoff is None else grp[grp["Fecha"] >= cutoff]
            tot = len(dh)
            rows.append({
                "Edificio":  b,
                "Horizonte": label,
                "Calif":     round(dh["Score"].mean(), 2) if tot else 0,
                "TotRes":    tot,
                "Pos%":      round((dh["Sentimiento"] == "Positiva").mean() * 100, 1) if tot else 0,
                "Neg%":      round((dh["Sentimiento"] == "Negativa").mean() * 100, 1) if tot else 0,
            })
    return pd.DataFrame(rows)


def _dist_with_gender(df_raw: pd.DataFrame, col: str, name_col: str) -> pd.DataFrame:
    dist = df_raw[col].explode().value_counts().reset_index()
    dist.columns = [name_col, "Conteo"]
    df_temp = df_raw[[col, "Sexo"]].explode(col)
    df_temp["SexoSimple"] = df_temp["Sexo"].map(
        lambda x: "male" if x in ("male", "mostly_male")
        else "female" if x in ("female", "mostly_female") else None
    )
    gc = (
        df_temp.dropna(subset=["SexoSimple"])
        .groupby([col, "SexoSimple"])
        .size()
        .unstack(fill_value=0)
    )
    gp = (
        gc.div(gc.sum(axis=1), axis=0)
        .mul(100)
        .rename(columns={"male": "Male%", "female": "Female%"})
        .reset_index()
        .rename(columns={col: name_col})
    )
    return dist.merge(gp, on=name_col, how="left")


def build_evolucion(df: pd.DataFrame) -> pd.DataFrame:
    start = datetime(2024, 1, 1).date()
    end   = datetime.now().date()
    rng   = pd.date_range(start=start, end=end, freq="D")
    evol  = pd.DataFrame(index=rng)
    for b in df["Edificio"].unique():
        df_b = df[df["Edificio"] == b].dropna(subset=["Fecha"]).sort_values("Fecha")
        if df_b.empty:
            evol[b] = pd.NA
            continue
        evol[b] = [
            df_b[df_b["Fecha"].dt.date <= d.date()]["Score"].mean()
            if not df_b[df_b["Fecha"].dt.date <= d.date()].empty else pd.NA
            for d in rng
        ]
    return evol


def build_evolucion_count(df: pd.DataFrame) -> pd.DataFrame:
    start = datetime(2024, 1, 1).date()
    end   = datetime.now().date()
    rng   = pd.date_range(start=start, end=end, freq="D")
    evol  = pd.DataFrame(index=rng)
    for b in df["Edificio"].unique():
        df_b = df[df["Edificio"] == b].dropna(subset=["Fecha"]).sort_values("Fecha")
        if df_b.empty:
            evol[b] = 0
            continue
        evol[b] = [df_b[df_b["Fecha"].dt.date <= d.date()].shape[0] for d in rng]
    return evol


# ---------------------------------------------------------------------------
# Exportación
# ---------------------------------------------------------------------------

def _json_serializer(obj):
    if isinstance(obj, (datetime, date)):
        return obj.strftime("%Y-%m-%d")
    raise TypeError(f"Type {type(obj)} not serializable")


def export_excel(df: pd.DataFrame, df_metrics: pd.DataFrame):
    os.makedirs(DATA_DIR, exist_ok=True)

    df_pos_raw = df[df["Sentimiento"] == "Positiva"]
    df_neg_raw = df[df["Sentimiento"] == "Negativa"]

    df_pos_dist = _dist_with_gender(df_pos_raw, "Temas",     "Tema")
    df_neg_dist = _dist_with_gender(df_neg_raw, "Temas",     "Tema")
    df_am_dist  = _dist_with_gender(df,         "Amenidades","Amenidad")

    pivot_pos = pd.crosstab(
        df_pos_raw["Edificio"],
        df_pos_raw["Temas"].explode()
    ).reset_index()
    pivot_neg = pd.crosstab(
        df_neg_raw["Edificio"],
        df_neg_raw["Temas"].explode()
    ).reset_index()
    pivot_am = pd.crosstab(
        df["Edificio"],
        df["Amenidades"].explode()
    ).reset_index()

    df_resumen       = build_resumen(df)
    evol_promedio    = build_evolucion(df)
    evol_count       = build_evolucion_count(df)

    try:
        with pd.ExcelWriter(OUTPUT_XLSX, engine="openpyxl") as writer:
            df.to_excel(writer,                    sheet_name="Comentarios_Raw", index=False)
            df_pos_raw.to_excel(writer,            sheet_name="Comentarios_Pos", index=False)
            df_neg_raw.to_excel(writer,            sheet_name="Comentarios_Neg", index=False)
            df_metrics.to_excel(writer,            sheet_name="Metrics",         index=False)
            df_resumen.to_excel(writer,            sheet_name="Resumen",         index=False)
            df_pos_dist.to_excel(writer,           sheet_name="Dist_Pos",        index=False)
            df_neg_dist.to_excel(writer,           sheet_name="Dist_Neg",        index=False)
            df_am_dist.to_excel(writer,            sheet_name="Amenities",       index=False)
            pivot_pos.to_excel(writer,             sheet_name="Pivot_Pos",       index=False)
            pivot_neg.to_excel(writer,             sheet_name="Pivot_Neg",       index=False)
            pivot_am.to_excel(writer,              sheet_name="Pivot_Amen",      index=False)
            evol_promedio.reset_index().rename(columns={"index": "Fecha"}).to_excel(
                writer, sheet_name="Evol_Promedio", index=False)
            evol_count.reset_index().rename(columns={"index": "Fecha"}).to_excel(
                writer, sheet_name="Evol_Count", index=False)
        print(f"Excel guardado en: {OUTPUT_XLSX}")
    except PermissionError:
        print(f"[ERROR] El archivo {OUTPUT_XLSX} está abierto. Ciérralo e intenta de nuevo.")
        raise


def export_json(df: pd.DataFrame, df_metrics: pd.DataFrame):
    os.makedirs(DATA_DIR, exist_ok=True)

    reviews = df.copy()
    reviews.columns = [c.lower().replace("ñ", "n") for c in reviews.columns]
    reviews = reviews.rename(columns={
        "primernombre": "primer_nombre",
        "amenidades":   "amenidades",
    })
    reviews["fecha"] = reviews["fecha"].apply(
        lambda d: d.strftime("%Y-%m-%d") if pd.notna(d) else None
    )

    with open(OUTPUT_REVIEWS, "w", encoding="utf-8") as f:
        json.dump(
            reviews.to_dict(orient="records"),
            f,
            ensure_ascii=False,
            indent=2,
            default=_json_serializer,
        )
    print(f"reviews.json guardado en: {OUTPUT_REVIEWS}")

    metrics = df_metrics.copy()
    metrics.columns = [
        c.lower()
        .replace("ñ", "n")
        .replace("%", "_pct")
        .replace("reseñastot", "resenas_tot")
        .replace("nuevasmes",  "nuevas_mes")
        .replace("califactual","calif_actual")
        .replace("califprevio","calif_previo")
        for c in metrics.columns
    ]

    with open(OUTPUT_METRICS, "w", encoding="utf-8") as f:
        json.dump(
            metrics.to_dict(orient="records"),
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"metrics.json guardado en: {OUTPUT_METRICS}")


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

async def main(filter_month: bool = False):
    """
    Scrapea todos los edificios, enriquece y exporta Excel + JSON.

    filter_month=False captura el histórico completo (igual que el scraper antiguo).
    filter_month=True  captura solo el último mes (útil para actualizaciones mensuales).
    """
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Iniciando scrape de {len(BUILDINGS)} edificios...")
    rows = await fetch_all_buildings(filter_month=filter_month)

    if not rows:
        print("No se obtuvieron reseñas. Verifica la conexión.")
        return

    print(f"Total reseñas crudas: {len(rows)}")

    df = pd.DataFrame(rows)
    print("Enriqueciendo reseñas (género, sentimiento, temas)...")
    df = enrich(df)

    df_metrics = build_metrics(df)

    print("Exportando Excel...")
    export_excel(df, df_metrics)

    print("Exportando JSON...")
    export_json(df, df_metrics)

    print("Listo.")


if __name__ == "__main__":
    asyncio.run(main())
