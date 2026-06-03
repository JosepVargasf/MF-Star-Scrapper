"""
Capa 1 — Unit tests para el nuevo scraper (sin red, sin browser)
HU-22: Suite de tests para validar el nuevo scraper (Playwright)
"""
import pytest
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

# El nuevo scraper deberá exponer estas funciones desde scraper_playwright.py
from scraper_playwright import (
    normalize_building_name,
    filter_last_month,
    parse_review,
    is_park_santiago_false_positive,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_review(**kwargs):
    """Construye una reseña válida con valores por defecto."""
    base = {
        "Edificio": "insitu irarrázaval",
        "Fecha": datetime(2026, 5, 15, tzinfo=timezone.utc),
        "Score": 4,
        "Texto": "Excelente edificio, muy buena atención.",
        "Usuario": "María González",
    }
    base.update(kwargs)
    return base


REQUIRED_FIELDS = {"Edificio", "Fecha", "Score", "Texto", "Usuario"}

NOW = datetime.now(timezone.utc)
LAST_MONTH_START = (NOW - relativedelta(months=1)).replace(
    day=1, hour=0, minute=0, second=0, microsecond=0
)

REVIEWS_MIXED_DATES = [
    make_review(Fecha=NOW - relativedelta(days=5)),    # dentro del mes
    make_review(Fecha=NOW - relativedelta(days=15)),   # dentro del mes
    make_review(Fecha=NOW - relativedelta(months=2)),  # fuera del mes
    make_review(Fecha=NOW - relativedelta(months=6)),  # fuera del mes
    make_review(Fecha=None),                           # sin fecha — excluir
]

# ---------------------------------------------------------------------------
# test_review_schema
# Verifica que cada reseña contiene los 5 campos obligatorios
# ---------------------------------------------------------------------------

def test_review_schema():
    review = make_review()
    missing = REQUIRED_FIELDS - review.keys()
    assert not missing, f"Faltan campos obligatorios: {missing}"


def test_review_schema_no_extra_mandatory():
    """parse_review no debe omitir ningún campo aunque el texto esté vacío."""
    raw = {
        "author": "Juan Pérez",
        "rating": 3,
        "text": "",
        "date": "2026-05-10T12:00:00Z",
    }
    review = parse_review(raw, building_query="INSITU Irarrázaval, Santiago, Chile")
    assert REQUIRED_FIELDS.issubset(review.keys())


# ---------------------------------------------------------------------------
# test_score_range
# Score debe ser numérico y estar entre 1 y 5
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("score", [1, 2, 3, 4, 5])
def test_score_range_valid(score):
    review = make_review(Score=score)
    assert 1 <= review["Score"] <= 5


@pytest.mark.parametrize("score", [0, 6, -1, 10])
def test_score_range_invalid_rejected(score):
    """parse_review debe rechazar scores fuera de rango."""
    raw = {"author": "Test", "rating": score, "text": "ok", "date": "2026-05-01T00:00:00Z"}
    with pytest.raises(ValueError, match="score"):
        parse_review(raw, building_query="INSITU Irarrázaval, Santiago, Chile")


# ---------------------------------------------------------------------------
# test_fecha_es_datetime
# Fecha debe ser datetime o None, nunca string
# ---------------------------------------------------------------------------

def test_fecha_es_datetime_when_valid_date():
    raw = {"author": "Ana", "rating": 5, "text": "Bien", "date": "2026-05-10T10:00:00Z"}
    review = parse_review(raw, building_query="INSITU Irarrázaval, Santiago, Chile")
    assert isinstance(review["Fecha"], datetime), "Fecha debe ser datetime"


def test_fecha_es_none_when_missing():
    raw = {"author": "Ana", "rating": 5, "text": "Bien", "date": None}
    review = parse_review(raw, building_query="INSITU Irarrázaval, Santiago, Chile")
    assert review["Fecha"] is None, "Fecha debe ser None si no hay date"


def test_fecha_never_string():
    raw = {"author": "Ana", "rating": 5, "text": "Bien", "date": "2026-05-10T10:00:00Z"}
    review = parse_review(raw, building_query="INSITU Irarrázaval, Santiago, Chile")
    assert not isinstance(review["Fecha"], str), "Fecha no puede ser string"


# ---------------------------------------------------------------------------
# test_edificio_normalizado
# Edificio debe ser el nombre base en minúsculas, sin la ciudad
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("query,expected", [
    ("INSITU Irarrázaval, Santiago, Chile", "insitu irarrázaval"),
    ("Somma Plaza Ñuñoa, Santiago, Chile", "somma plaza ñuñoa"),
    ("Park Santiago, Santiago, Chile", "park santiago"),
    ("Nomad Bellet, Santiago, Chile", "nomad bellet"),
])
def test_edificio_normalizado(query, expected):
    assert normalize_building_name(query) == expected


# ---------------------------------------------------------------------------
# test_texto_es_string
# Texto siempre debe ser str, nunca None
# ---------------------------------------------------------------------------

def test_texto_es_string_cuando_hay_texto():
    raw = {"author": "Luis", "rating": 4, "text": "Buen edificio", "date": "2026-05-01T00:00:00Z"}
    review = parse_review(raw, building_query="Nomad Bellet, Santiago, Chile")
    assert isinstance(review["Texto"], str)


def test_texto_es_string_cuando_no_hay_texto():
    raw = {"author": "Luis", "rating": 5, "text": None, "date": "2026-05-01T00:00:00Z"}
    review = parse_review(raw, building_query="Nomad Bellet, Santiago, Chile")
    assert isinstance(review["Texto"], str), "Texto debe ser str aunque el original sea None"
    assert review["Texto"] == ""


# ---------------------------------------------------------------------------
# test_filtra_solo_ultimo_mes
# filter_last_month debe retornar solo reseñas del último mes calendario
# ---------------------------------------------------------------------------

def test_filtra_solo_ultimo_mes_cantidad():
    resultado = filter_last_month(REVIEWS_MIXED_DATES)
    assert len(resultado) == 2, f"Esperaba 2 reseñas del último mes, got {len(resultado)}"


def test_filtra_excluye_sin_fecha():
    resultado = filter_last_month(REVIEWS_MIXED_DATES)
    assert all(r["Fecha"] is not None for r in resultado)


def test_filtra_todas_dentro_del_rango():
    resultado = filter_last_month(REVIEWS_MIXED_DATES)
    for r in resultado:
        assert r["Fecha"] >= LAST_MONTH_START, f"Reseña fuera de rango: {r['Fecha']}"


# ---------------------------------------------------------------------------
# test_park_santiago_excluye_parque
# Reseñas que mencionan "parque" o " park " deben ser filtradas para Park Santiago
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("texto", [
    "El parque cerca es hermoso",
    "Me gusta el park de la esquina",
    "Fui al parque ayer",
    "El PARQUE está muy bien mantenido",
])
def test_park_santiago_excluye_menciones_parque(texto):
    assert is_park_santiago_false_positive(texto) is True


@pytest.mark.parametrize("texto", [
    "Excelente departamento, muy tranquilo",
    "Buena atención del personal",
    "Las instalaciones son modernas",
    "Me encanta vivir aquí",
])
def test_park_santiago_mantiene_resenas_validas(texto):
    assert is_park_santiago_false_positive(texto) is False
