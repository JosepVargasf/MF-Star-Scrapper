"""
Scraper de reseñas Google Maps con Playwright (reemplaza Outscraper).
Módulo principal — HU-01: configuración base y funciones puras.
HU-02: implementación de fetch_reviews con browser.
"""

import re
from datetime import datetime, timezone
from dateutil.parser import parse as parse_date
from dateutil.relativedelta import relativedelta

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

BUILDINGS = [
    'INSITU Irarrázaval, Santiago, Chile',
    'INSITU Echaurren, Santiago, Chile',
    'Somma Plaza Ñuloa, Santiago, Chile',
    'Somma Inés de Suárez, Santiago, Chile',
    'Somma Asturias, Santiago, Chile',
    'Ronda Santo Domingo, Santiago, Chile',
    'Somma Plaza Bustamante, Santiago, Chile',
    'Nativo Riesco, Santiago, Chile',
    'Nomad Holley, Santiago, Chile',
    'Nomad Bellet, Santiago, Chile',
    'IMU San Cristóbal, Santiago, Chile',
    'Spot Nueva Kennedy, Santiago, Chile',
    'Soho Barrio Italia, Santiago, Chile',
    'Park Santiago, Santiago, Chile',
    'The Place, Santiago, Chile',
]

# ---------------------------------------------------------------------------
# Funciones puras (sin red, testeables en Capa 1)
# ---------------------------------------------------------------------------

def normalize_building_name(building_query: str) -> str:
    """Extrae el nombre base del edificio en minúsculas, sin la ciudad."""
    return building_query.split(',')[0].strip().lower()


def is_park_santiago_false_positive(text: str) -> bool:
    """
    Detecta si una reseña de Park Santiago menciona el parque (falso positivo).
    Filtra 'parque' o ' park ' rodeado de espacios.
    """
    lt = (text or '').lower()
    if 'parque' in lt:
        return True
    if re.search(r'\bpark\b', lt) and 'park santiago' not in lt:
        return True
    return False


def parse_review(raw: dict, building_query: str) -> dict:
    """
    Convierte un dict raw del scraper al schema interno:
    {Edificio, Fecha, Score, Texto, Usuario}

    Raises:
        ValueError: si el score está fuera del rango 1-5.
    """
    score_raw = raw.get('rating') if raw.get('rating') is not None else raw.get('score')
    try:
        score = float(score_raw) if score_raw is not None else None
    except (TypeError, ValueError):
        score = None

    if score is not None and not (1 <= score <= 5):
        raise ValueError(f"score fuera de rango: {score}")

    score = score if score is not None else 0.0

    date_raw = raw.get('date') or raw.get('datetime') or raw.get('review_datetime_utc')
    fecha = None
    if date_raw:
        try:
            fecha = parse_date(str(date_raw))
            if fecha.tzinfo is None:
                fecha = fecha.replace(tzinfo=timezone.utc)
        except Exception:
            fecha = None

    texto = raw.get('text') or raw.get('review_text') or ''
    if texto is None:
        texto = ''

    usuario = (
        raw.get('author')
        or raw.get('author_title')
        or raw.get('author_name')
        or raw.get('reviewer_name')
        or ''
    )

    return {
        'Edificio': normalize_building_name(building_query),
        'Fecha': fecha,
        'Score': score,
        'Texto': str(texto),
        'Usuario': str(usuario),
    }


def filter_last_month(reviews: list) -> list:
    """
    Retorna solo las reseñas del último mes calendario.
    Excluye reseñas sin fecha.
    """
    now = datetime.now(timezone.utc)
    start = (now - relativedelta(months=1)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    result = []
    for r in reviews:
        fecha = r.get('Fecha')
        if fecha is None:
            continue
        if fecha.tzinfo is None:
            fecha = fecha.replace(tzinfo=timezone.utc)
        if fecha >= start:
            result.append(r)
    return result


# ---------------------------------------------------------------------------
# Fetch con Playwright (HU-02 — pendiente de implementar)
# ---------------------------------------------------------------------------

async def fetch_reviews(building_query: str) -> list:
    """
    Descarga las reseñas de Google Maps para un edificio usando Playwright.
    Implementado en HU-02.
    """
    raise NotImplementedError("fetch_reviews se implementa en HU-02")
