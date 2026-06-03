"""
Scraper de reseñas Google Maps con Playwright (reemplaza Outscraper).
HU-01: configuración base y funciones puras.
HU-02: fetch_reviews con browser.
"""

import re
import asyncio
from datetime import datetime, timezone
from dateutil.parser import parse as parse_date
from dateutil.relativedelta import relativedelta
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout

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
# Parseo de fechas relativas de Google Maps
# ---------------------------------------------------------------------------

_RELATIVE_DATE_MAP = {
    # español
    'segundo': 'seconds', 'segundos': 'seconds',
    'minuto': 'minutes',  'minutos': 'minutes',
    'hora': 'hours',      'horas': 'hours',
    'día': 'days',        'días': 'days',
    'dia': 'days',        'dias': 'days',
    'semana': 'weeks',    'semanas': 'weeks',
    'mes': 'months',      'meses': 'months',
    'año': 'years',       'años': 'years',
    'ano': 'years',       'anos': 'years',
    # inglés (por si acaso)
    'second': 'seconds',  'seconds': 'seconds',
    'minute': 'minutes',  'minutes': 'minutes',
    'hour': 'hours',      'hours': 'hours',
    'day': 'days',        'days': 'days',
    'week': 'weeks',      'weeks': 'weeks',
    'month': 'months',    'months': 'months',
    'year': 'years',      'years': 'years',
}

def parse_relative_date(text: str) -> datetime | None:
    """
    Convierte fechas relativas de Google Maps a datetime.
    Ejemplos: 'hace 2 meses', 'hace 1 semana', '3 days ago'.
    """
    if not text:
        return None
    text = text.strip().lower()

    # Intentar parseo directo primero (fechas absolutas)
    try:
        d = parse_date(text, fuzzy=True)
        return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
    except Exception:
        pass

    # Parseo de fechas relativas: "hace N unidad" o "N unit ago"
    match = re.search(r'(\d+)\s+(\w+)', text)
    if not match:
        # "hace un mes", "hace una semana"
        match = re.search(r'un[ao]?\s+(\w+)', text)
        if match:
            unit_str = match.group(1)
            n = 1
        else:
            return None
    else:
        n = int(match.group(1))
        unit_str = match.group(2)

    unit = _RELATIVE_DATE_MAP.get(unit_str)
    if not unit:
        return None

    now = datetime.now(timezone.utc)
    return now - relativedelta(**{unit: n})


# ---------------------------------------------------------------------------
# Selectores Google Maps (pueden cambiar con actualizaciones de Google)
# ---------------------------------------------------------------------------

SEL_REVIEWS_TAB    = 'button[role="tab"][data-tab-index="1"]'
SEL_SORT_BUTTON    = 'button[aria-label*="rdenar"], button[aria-label*="ort review"]'
SEL_SORT_NEWEST    = '[data-index="1"]'
SEL_REVIEW_CARD    = 'div.jftiEf'
SEL_AUTHOR         = 'div.d4r55'
SEL_RATING         = 'span.kvMYJc'              # role="img" aria-label="N estrellas"
SEL_DATE           = 'span.rsqaWe'
SEL_TEXT           = 'span.wiI7pd'
SEL_EXPAND_TEXT    = 'button.w8nwRe'
SEL_SCROLL_PANEL   = 'div.m6QErb.DxyBCb'

MAX_SCROLL_ATTEMPTS = 40
SCROLL_PAUSE_MS     = 1200


# ---------------------------------------------------------------------------
# Fetch con Playwright (HU-02)
# ---------------------------------------------------------------------------

async def _extract_reviews_from_page(page: Page, building_query: str) -> list:
    """Extrae todas las reseñas visibles en el panel de reseñas."""
    base_name = normalize_building_name(building_query)
    is_park = base_name == 'park santiago'
    reviews = []

    cards = await page.query_selector_all(SEL_REVIEW_CARD)
    for card in cards:
        # Expandir texto truncado si existe el botón
        try:
            expand_btn = await card.query_selector(SEL_EXPAND_TEXT)
            if expand_btn:
                await expand_btn.click()
                await page.wait_for_timeout(300)
        except Exception:
            pass

        # Autor
        author_el = await card.query_selector(SEL_AUTHOR)
        author = (await author_el.inner_text()).strip() if author_el else ''

        # Rating: extrae el número del aria-label ("4 estrellas" → 4)
        rating_el = await card.query_selector(SEL_RATING)
        rating = None
        if rating_el:
            aria = await rating_el.get_attribute('aria-label') or ''
            m = re.search(r'(\d+)', aria)
            rating = int(m.group(1)) if m else None

        # Fecha relativa
        date_el = await card.query_selector(SEL_DATE)
        date_text = (await date_el.inner_text()).strip() if date_el else ''
        fecha = parse_relative_date(date_text)

        # Texto
        text_el = await card.query_selector(SEL_TEXT)
        text = (await text_el.inner_text()).strip() if text_el else ''

        # Filtrar falsos positivos de Park Santiago
        if is_park and is_park_santiago_false_positive(text):
            continue

        raw = {'author': author, 'rating': rating, 'date': fecha, 'text': text}

        # parse_review espera date como datetime, lo pasamos directo
        try:
            review = {
                'Edificio': base_name,
                'Fecha': fecha,
                'Score': float(rating) if rating is not None else 0.0,
                'Texto': str(text),
                'Usuario': str(author),
            }
            reviews.append(review)
        except ValueError:
            continue

    return reviews


async def fetch_reviews(building_query: str, headless: bool = True, debug: bool = False) -> list:
    """
    Descarga todas las reseñas de Google Maps para un edificio usando Playwright.

    Args:
        building_query: nombre completo del edificio (ej: 'INSITU Irarrázaval, Santiago, Chile')
        headless: si False, abre el browser visible (útil para depurar)

    Returns:
        Lista de dicts con schema {Edificio, Fecha, Score, Texto, Usuario}
    """
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        context = await browser.new_context(
            locale='es-CL',
            timezone_id='America/Santiago',
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
        )
        page = await context.new_page()

        try:
            # 1. Buscar el edificio en Google Maps
            search_url = f"https://www.google.com/maps/search/{building_query.replace(' ', '+')}"
            await page.goto(search_url, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(2000)

            # 2. Aceptar cookies si aparece el banner
            try:
                accept_btn = page.locator('button:has-text("Aceptar todo"), button:has-text("Accept all")')
                if await accept_btn.count() > 0:
                    await accept_btn.first.click()
                    await page.wait_for_timeout(1000)
            except Exception:
                pass

            if debug:
                await page.screenshot(path="debug_01_after_search.png", full_page=True)
                print("[DEBUG] Screenshot guardado: debug_01_after_search.png")

            # 2b. Si la búsqueda devuelve una lista, hacer clic en el primer resultado
            try:
                first_result = page.locator('a[href*="/maps/place/"]').first
                await first_result.wait_for(timeout=5000)
                await first_result.click()
                await page.wait_for_timeout(2000)
                if debug:
                    await page.screenshot(path="debug_02_after_click_result.png", full_page=True)
                    print("[DEBUG] Screenshot guardado: debug_02_after_click_result.png")
            except Exception:
                pass  # Ya estamos en el panel del lugar directamente

            # 3. Esperar a que Maps reformatee el URL del lado del cliente (~5s) y recargar
            await page.wait_for_timeout(5000)
            final_url = page.url
            await page.goto(final_url, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(3000)

            # 4. Hacer clic en la pestaña de reseñas
            try:
                reviews_tab = page.locator(SEL_REVIEWS_TAB).first
                await reviews_tab.wait_for(timeout=10000)
                await reviews_tab.click()
                await page.wait_for_timeout(2000)
                if debug:
                    await page.screenshot(path="debug_02_after_reviews_tab.png", full_page=True)
                    print("[DEBUG] Screenshot guardado: debug_02_after_reviews_tab.png")
            except PlaywrightTimeout:
                if debug:
                    await page.screenshot(path="debug_02_reviews_tab_NOT_FOUND.png", full_page=True)
                    # Imprimir todos los botones visibles para encontrar el selector correcto
                    buttons = await page.query_selector_all('button')
                    print(f"[DEBUG] Botones encontrados en la página ({len(buttons)}):")
                    for btn in buttons[:20]:
                        label = await btn.get_attribute('aria-label') or ''
                        text = (await btn.inner_text()).strip()[:50]
                        print(f"  aria-label='{label}' | text='{text}'")
                print(f"[WARN] No se encontró pestaña de reseñas para: {building_query}")
                return []

            # 5. Ordenar por más recientes
            try:
                sort_btn = page.locator(SEL_SORT_BUTTON).first
                await sort_btn.wait_for(timeout=5000)
                await sort_btn.click()
                await page.wait_for_timeout(1000)
                newest_opt = page.locator(SEL_SORT_NEWEST).first
                await newest_opt.click()
                await page.wait_for_timeout(2000)
            except Exception:
                pass  # Si falla el orden, seguimos igual

            # 6. Leer total de reseñas declarado por Google Maps
            total_reviews = None
            try:
                count_el = page.locator('div.jANrlb div.fontBodySmall').first
                count_text = await count_el.inner_text()
                m = re.search(r'(\d+)', count_text)
                if m:
                    total_reviews = int(m.group(1))
                    print(f"[INFO] Total reseñas declaradas: {total_reviews}")
            except Exception:
                pass

            # 7. Scroll hasta tener todas las reseñas o agotar intentos
            scroll_panel = page.locator(SEL_SCROLL_PANEL).first
            prev_count = 0
            stable_rounds = 0

            for _ in range(MAX_SCROLL_ATTEMPTS):
                await scroll_panel.evaluate('el => el.scrollBy(0, el.scrollHeight)')
                await page.wait_for_timeout(SCROLL_PAUSE_MS)

                current_count = await page.locator(SEL_REVIEW_CARD).count()
                print(f"[SCROLL] {current_count}/{total_reviews or '?'} reseñas cargadas")

                # Parar si ya tenemos todas
                if total_reviews and current_count >= total_reviews:
                    break

                if current_count == prev_count:
                    stable_rounds += 1
                    if stable_rounds >= 3:
                        break
                else:
                    stable_rounds = 0
                prev_count = current_count

            # 9. Extraer todas las reseñas visibles
            reviews = await _extract_reviews_from_page(page, building_query)

        except Exception as e:
            print(f"[ERROR] {building_query}: {type(e).__name__}: {e}")
            reviews = []
        finally:
            await browser.close()

    return reviews


async def fetch_all_buildings(buildings: list = BUILDINGS, max_workers: int = 3) -> list:
    """Descarga reseñas de todos los edificios en paralelo (semáforo de max_workers)."""
    sem = asyncio.Semaphore(max_workers)

    async def fetch_limited(query):
        async with sem:
            print(f"[→] Scrapeando: {query}")
            result = await fetch_reviews(query)
            print(f"[✓] {query}: {len(result)} reseñas")
            return result

    tasks = [fetch_limited(b) for b in buildings]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_reviews = []
    for b, res in zip(buildings, results):
        if isinstance(res, Exception):
            print(f"[ERROR] {b}: {res}")
        else:
            all_reviews.extend(res)

    return all_reviews
