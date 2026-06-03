"""
Capa 2 — Integration tests con Playwright (1 edificio real, requiere red y browser)
HU-22: Suite de tests para validar el nuevo scraper (Playwright)

Ejecutar con:
    pytest tests/test_scraper_integration.py -v -s

Nota: estos tests abren un browser headless real y hacen una petición a Google Maps.
Se marcan con @pytest.mark.integration para poder excluirlos en CI si se requiere:
    pytest -m "not integration"
"""
import pytest
from datetime import datetime

from scraper_playwright import fetch_reviews, BUILDINGS

# Edificio de referencia para todos los tests de integración
EDIFICIO_TEST = BUILDINGS[0]  # 'INSITU Irarrázaval, Santiago, Chile'

# ---------------------------------------------------------------------------
# Fixture compartido: scrapea una sola vez para todos los tests de esta capa
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
async def reviews():
    """Scrapea EDIFICIO_TEST una sola vez y comparte el resultado."""
    result = await fetch_reviews(EDIFICIO_TEST, headless=True)
    return result


# ---------------------------------------------------------------------------
# Capa 2 — Integration tests
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_fetch_returns_list(reviews):
    """fetch_reviews no lanza excepción y retorna una lista."""
    assert isinstance(reviews, list)


@pytest.mark.integration
async def test_fetch_at_least_one_review(reviews):
    """Retorna al menos 1 reseña para el edificio de referencia."""
    assert len(reviews) >= 1, (
        f"Se esperaba al menos 1 reseña para '{EDIFICIO_TEST}', se obtuvieron {len(reviews)}"
    )


@pytest.mark.integration
async def test_no_duplicate_reviews(reviews):
    """No hay reseñas duplicadas (mismo Usuario + Fecha + Texto)."""
    seen = set()
    duplicates = []
    for r in reviews:
        key = (r["Usuario"], r["Fecha"], r["Texto"])
        if key in seen:
            duplicates.append(key)
        seen.add(key)
    assert duplicates == [], f"Duplicados encontrados: {duplicates}"


@pytest.mark.integration
async def test_scroll_captures_multiple_pages(reviews):
    """El scroll infinito captura más de 10 reseñas (requiere scroll efectivo)."""
    assert len(reviews) > 10, (
        f"Se esperaban >10 reseñas tras el scroll, se obtuvieron {len(reviews)}"
    )


@pytest.mark.integration
async def test_retry_on_timeout(monkeypatch):
    """fetch_reviews reintenta en vez de fallar si _fetch_once lanza excepción."""
    import scraper_playwright as mod

    call_count = 0

    async def fake_fetch_once(building_query, headless=True, debug=False):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise mod.PlaywrightTimeout("timeout simulado")
        # Segunda llamada devuelve resultado válido
        return [
            {
                "Edificio": "insitu irarrázaval",
                "Fecha": datetime(2026, 5, 1),
                "Score": 5,
                "Texto": "Muy bueno.",
                "Usuario": "Test User",
            }
        ]

    monkeypatch.setattr(mod, "_fetch_once", fake_fetch_once)

    result = await mod.fetch_reviews(EDIFICIO_TEST, headless=True)

    assert call_count == 2, f"Se esperaban 2 intentos, se hicieron {call_count}"
    assert isinstance(result, list)
    assert len(result) == 1
