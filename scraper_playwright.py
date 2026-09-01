"""
Scraper de reseñas Google Maps con Playwright.
Intercepta el endpoint ListUgcPosts para obtener fechas exactas (timestamps en microsegundos).
"""

import json
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
    'Somma Plaza Ñuñoa, Santiago, Chile',
    'Somma Inés de Suárez, Santiago, Chile',
    'Somma Asturias, Santiago, Chile',
    'Ronda Santo Domingo Santo Domingo, Santiago, Chile',
    'Somma Plaza Bustamante, Santiago, Chile',
    'Nativo Riesco, Santiago, Chile',
    'Nomad Holley, Santiago, Chile',
    'Nomad Bellet, Santiago, Chile',
    'IMU San Cristóbal, Santiago, Chile',
    'Spot Nueva Kennedy, Santiago, Chile',
    'Soho Barrio Italia, Santiago, Chile',
    'Park Santiago Santo Domingo, Santiago, Chile',
    'Edificio The Place - Grupo Coloso',
    'Somma Las Clarisas, Las Condes, Santiago, Chile',
    'Spot Residence Manquehue, Las Condes, Santiago, Chile',
    'Blend Apoquindo, Las Condes, Santiago, Chile',
    'Collective Bustamante, Ñuñoa, Santiago, Chile',
    'Collective Santiago San Francisco, Santiago, Chile',
    'Switch Vespucio, Las Condes, Santiago, Chile',
    'Edificio Brooklyn La Florida, La Florida, Santiago, Chile',
    'Somma Vista Calán, Las Condes, Santiago, Chile',
    'Boldo Club de Campo, Vitacura, Santiago, Chile',
]

# ---------------------------------------------------------------------------
# Funciones puras (sin red, testeables)
# ---------------------------------------------------------------------------

_NAME_ALIASES = {
    'park santiago santo domingo':          'park santiago',
    'the place la gloria':                  'the place',
    'edificio the place - grupo coloso':    'the place',
    'ronda santo domingo santo domingo':    'ronda santo domingo',
}

def normalize_building_name(building_query: str) -> str:
    raw = building_query.split(',')[0].strip().lower()
    return _NAME_ALIASES.get(raw, raw)


def is_park_santiago_false_positive(text: str) -> bool:
    lt = (text or '').lower()
    if 'parque' in lt:
        return True
    if re.search(r'\bpark\b', lt) and 'park santiago' not in lt:
        return True
    return False


def parse_review(raw: dict, building_query: str) -> dict:
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
# Parseo de fechas relativas (fallback si la intercepción falla)
# ---------------------------------------------------------------------------

_RELATIVE_DATE_MAP = {
    'segundo': 'seconds', 'segundos': 'seconds',
    'minuto': 'minutes',  'minutos': 'minutes',
    'hora': 'hours',      'horas': 'hours',
    'día': 'days',        'días': 'days',
    'dia': 'days',        'dias': 'days',
    'semana': 'weeks',    'semanas': 'weeks',
    'mes': 'months',      'meses': 'months',
    'año': 'years',       'años': 'years',
    'ano': 'years',       'anos': 'years',
    'second': 'seconds',  'seconds': 'seconds',
    'minute': 'minutes',  'minutes': 'minutes',
    'hour': 'hours',      'hours': 'hours',
    'day': 'days',        'days': 'days',
    'week': 'weeks',      'weeks': 'weeks',
    'month': 'months',    'months': 'months',
    'year': 'years',      'years': 'years',
}

_RELATIVE_KEYWORDS = {'hace', 'ago', 'un', 'una'}

def parse_relative_date(text: str) -> datetime | None:
    if not text:
        return None
    text = text.strip().lower()

    is_relative = any(kw in text for kw in _RELATIVE_KEYWORDS)
    if not is_relative:
        try:
            d = parse_date(text, fuzzy=True)
            return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
        except Exception:
            pass

    match = re.search(r'(\d+)\s+(\w+)', text)
    if not match:
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

    return datetime.now(timezone.utc) - relativedelta(**{unit: n})


# ---------------------------------------------------------------------------
# Parseo de respuestas XHR — formato batchexecute de Google Maps
# ---------------------------------------------------------------------------
# El endpoint real es /maps/_/MapsWizUi/data/batchexecute
# La respuesta tiene el formato:
#   )]}'\n
#   SIZE\n
#   [["wrb.fr","/MapsUgcPostService.ListUgcPosts","<JSON_INNER>",...]]\n
#   SIZE\n
#   [["di",...]]
#   ...
# El JSON de reseñas está codificado como STRING dentro de [0][2].
# ---------------------------------------------------------------------------

def _safe_get(data, *keys, default=None):
    cur = data
    for k in keys:
        try:
            cur = cur[k]
        except (IndexError, TypeError, KeyError):
            return default
    return cur


def _is_microsecond_timestamp(val) -> bool:
    return isinstance(val, int) and 1_400_000_000_000_000 <= val <= 2_000_000_000_000_000


def _extract_reviews_from_inner(inner) -> list:
    """
    Extrae reseñas del JSON interno de ListUgcPosts.
    Estructura: inner = [null, null, [[item1], [item2], ...]]
    Cada item = [review_data, ...]
    review_data = [REVIEW_ID, meta, rating_block, ...]
      meta[2]       = timestamp microsegundos
      meta[4][5][0] = nombre del autor
      rating_block[0][0]    = rating (1-5)
      rating_block[15][0][0]= texto de la reseña
    """
    review_list = _safe_get(inner, 2)
    if not isinstance(review_list, list):
        return []

    reviews = []
    for item in review_list:
        try:
            review_data = item[0]
            meta         = review_data[1]

            ts = meta[2]
            if not _is_microsecond_timestamp(ts):
                continue
            fecha = datetime.fromtimestamp(ts / 1_000_000, tz=timezone.utc)

            author = _safe_get(meta, 4, 5, 0) or ''
            if not isinstance(author, str):
                author = ''

            rating_block = review_data[2]
            rating = _safe_get(rating_block, 0, 0)
            if not isinstance(rating, int) or not (1 <= rating <= 5):
                rating = None

            # texto en rating_block[15][0][0]; puede no existir
            text = _safe_get(rating_block, 15, 0, 0) or ''
            if not isinstance(text, str):
                text = ''

            reviews.append({
                'author': author,
                'rating': rating,
                'date':   fecha,
                'text':   text,
            })
        except Exception:
            continue

    return reviews


def _parse_batchexecute_response(raw_text: str) -> list:
    """
    Parsea la respuesta del endpoint batchexecute de Google Maps.

    Formato:
      )]}'\n
      \n
      SIZE\n          ← número de bytes del chunk siguiente
      CHUNK_JSON\n    ← puede ocupar múltiples líneas
      SIZE\n
      CHUNK_JSON\n
      ...

    Usa el número de bytes para extraer cada chunk exactamente,
    en lugar de splitlines(), porque Google puede partir el JSON.
    """
    # Remover prefijo de seguridad )]}' y espacios iniciales
    text = raw_text
    idx = text.find(")]}'\n")
    if idx >= 0:
        text = text[idx + 5:]
    text = text.lstrip('\n')

    results = []
    lines = text.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        if not line.isdigit():
            i += 1
            continue

        chunk_size = int(line)
        i += 1

        # Reconstruir el chunk acumulando líneas hasta completar chunk_size bytes
        chunk_lines = []
        accumulated = 0
        while i < len(lines) and accumulated < chunk_size:
            chunk_lines.append(lines[i])
            accumulated += len(lines[i].encode('utf-8')) + 1  # +1 por el \n
            i += 1

        chunk_text = '\n'.join(chunk_lines)

        if 'MapsUgcPostService.ListUgcPosts' not in chunk_text:
            continue

        try:
            outer     = json.loads(chunk_text)
            inner_str = outer[0][2]
            inner     = json.loads(inner_str)
        except Exception as e:
            print(f"[UGC] Error parseando chunk ListUgcPosts: {e}")
            continue

        reviews = _extract_reviews_from_inner(inner)
        results.extend(reviews)

    return results


# ---------------------------------------------------------------------------
# Selectores Google Maps (DOM fallback)
# ---------------------------------------------------------------------------

SEL_REVIEWS_TAB    = 'button[role="tab"][data-tab-index="1"]'
SEL_SORT_BUTTON    = 'button[aria-label*="rdenar"], button[aria-label*="ort review"]'
SEL_SORT_NEWEST    = '[data-index="1"]'
SEL_REVIEW_CARD    = 'div.jftiEf'
SEL_AUTHOR         = 'div.d4r55'
SEL_RATING         = 'span.kvMYJc'
SEL_DATE           = 'span.rsqaWe'
SEL_TEXT           = 'span.wiI7pd'
SEL_EXPAND_TEXT    = 'button.w8nwRe'
SEL_SCROLL_PANEL   = 'div.m6QErb.DxyBCb'

MAX_SCROLL_ATTEMPTS = 40
SCROLL_PAUSE_MS     = 1200


# ---------------------------------------------------------------------------
# Extracción fallback desde el DOM (fechas relativas)
# ---------------------------------------------------------------------------

async def _extract_reviews_from_dom(page: Page, building_query: str) -> list:
    """Fallback: extrae reseñas del DOM cuando la intercepción XHR no retorna datos."""
    base_name = normalize_building_name(building_query)
    is_park = 'park santiago' in base_name
    reviews = []

    cards = await page.query_selector_all(SEL_REVIEW_CARD)
    for card in cards:
        try:
            expand_btn = await card.query_selector(SEL_EXPAND_TEXT)
            if expand_btn:
                await expand_btn.click()
                await page.wait_for_timeout(300)
        except Exception:
            pass

        author_el = await card.query_selector(SEL_AUTHOR)
        author = (await author_el.inner_text()).strip() if author_el else ''

        rating_el = await card.query_selector(SEL_RATING)
        rating = None
        if rating_el:
            aria = await rating_el.get_attribute('aria-label') or ''
            m = re.search(r'(\d+)', aria)
            rating = int(m.group(1)) if m else None

        date_el = await card.query_selector(SEL_DATE)
        fecha = None
        if date_el:
            aria_date = await date_el.get_attribute('aria-label') or ''
            if aria_date:
                try:
                    fecha = parse_date(aria_date)
                    if fecha.tzinfo is None:
                        fecha = fecha.replace(tzinfo=timezone.utc)
                except Exception:
                    fecha = None
            if not fecha:
                date_text = (await date_el.inner_text()).strip()
                fecha = parse_relative_date(date_text)

        text_el = await card.query_selector(SEL_TEXT)
        text = (await text_el.inner_text()).strip() if text_el else ''

        if is_park and is_park_santiago_false_positive(text):
            continue

        reviews.append({
            'Edificio': base_name,
            'Fecha': fecha,
            'Score': float(rating) if rating is not None else 0.0,
            'Texto': str(text),
            'Usuario': str(author),
        })

    return reviews


# ---------------------------------------------------------------------------
# Fetch con Playwright + intercepción XHR
# ---------------------------------------------------------------------------

MAX_RETRIES   = 3
RETRY_BACKOFF = 5


async def _fetch_once(building_query: str, headless: bool, debug: bool) -> list:
    """Intento único de scraping con intercepción de ListUgcPosts."""
    intercepted_raw: list[dict] = []

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

        # --- Interceptor de respuestas XHR ---
        async def on_response(response):
            if 'batchexecute' not in response.url:
                return
            try:
                body = await response.text()
                if 'MapsUgcPostService.ListUgcPosts' not in body:
                    return
                parsed = _parse_batchexecute_response(body)
                if parsed:
                    print(f"[XHR] ListUgcPosts: {len(parsed)} reseñas interceptadas")
                    intercepted_raw.extend(parsed)
                elif debug:
                    print(f"[XHR-DEBUG] chunk ListUgcPosts sin reseñas parseadas")
            except Exception as e:
                if debug:
                    print(f"[XHR] Error: {type(e).__name__}: {e}")

        page.on('response', on_response)

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
                print("[DEBUG] Screenshot: debug_01_after_search.png")

            # 2b. Si hay lista de resultados, clic en el primero
            try:
                first_result = page.locator('a[href*="/maps/place/"]').first
                await first_result.wait_for(timeout=5000)
                await first_result.click()
                await page.wait_for_timeout(2000)
                if debug:
                    await page.screenshot(path="debug_02_after_click_result.png", full_page=True)
            except Exception:
                pass

            # 3. Esperar URL final de Maps y recargar para estabilizar
            await page.wait_for_timeout(5000)
            final_url = page.url
            await page.goto(final_url, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(3000)

            # 4. Clic en pestaña de Reseñas
            try:
                reviews_tab = page.locator(SEL_REVIEWS_TAB).first
                await reviews_tab.wait_for(timeout=10000)
                await reviews_tab.click()
                await page.wait_for_timeout(2000)
                if debug:
                    await page.screenshot(path="debug_03_reviews_tab.png", full_page=True)
            except PlaywrightTimeout:
                if debug:
                    await page.screenshot(path="debug_03_reviews_tab_NOT_FOUND.png", full_page=True)
                    buttons = await page.query_selector_all('button')
                    print(f"[DEBUG] Botones encontrados ({len(buttons)}):")
                    for btn in buttons[:20]:
                        label = await btn.get_attribute('aria-label') or ''
                        text = (await btn.inner_text()).strip()[:50]
                        print(f"  aria-label='{label}' | text='{text}'")
                print(f"[WARN] No se encontró pestaña de reseñas: {building_query}")
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
                pass

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

            # 7. Scroll para cargar todas las reseñas (dispara paginación XHR)
            # Buscar el panel de scroll con múltiples selectores alternativos
            SCROLL_PANEL_SELECTORS = [
                'div.m6QErb.DxyBCb',
                'div.m6QErb[aria-label]',
                'div[role="feed"]',
                'div.section-scrollbox',
            ]
            scroll_panel = None
            for sel in SCROLL_PANEL_SELECTORS:
                candidate = page.locator(sel).first
                try:
                    await candidate.wait_for(timeout=3000)
                    scroll_panel = candidate
                    if debug:
                        print(f"[SCROLL] Panel encontrado con selector: {sel}")
                    break
                except Exception:
                    continue

            if scroll_panel is None and debug:
                print("[SCROLL] No se encontró panel de scroll con ningún selector conocido")

            prev_count = 0
            stable_rounds = 0

            for _ in range(MAX_SCROLL_ATTEMPTS):
                if scroll_panel is not None:
                    try:
                        await scroll_panel.evaluate('el => { el.scrollTop = el.scrollHeight; el.scrollBy(0, 3000); }')
                    except Exception:
                        pass
                # Scroll de respaldo: último review card visible
                try:
                    last_card = page.locator(SEL_REVIEW_CARD).last
                    await last_card.scroll_into_view_if_needed()
                except Exception:
                    pass

                await page.wait_for_timeout(SCROLL_PAUSE_MS)

                current_count = await page.locator(SEL_REVIEW_CARD).count()
                print(f"[SCROLL] DOM: {current_count} | XHR: {len(intercepted_raw)} / {total_reviews or '?'}")

                if total_reviews and len(intercepted_raw) >= total_reviews:
                    break

                if current_count == prev_count:
                    stable_rounds += 1
                    if stable_rounds >= 3:
                        break
                else:
                    stable_rounds = 0
                prev_count = current_count

            # 8. Construir lista final de reseñas
            base_name = normalize_building_name(building_query)
            is_park = 'park santiago' in base_name

            if intercepted_raw:
                print(f"[OK] Usando {len(intercepted_raw)} reseñas de intercepción XHR")
                seen = set()
                reviews = []
                for raw in intercepted_raw:
                    text = raw.get('text', '')
                    if is_park and is_park_santiago_false_positive(text):
                        continue
                    # Deduplicar por (autor, texto) — la misma reseña puede llegar
                    # en distintas páginas con timestamps ligeramente distintos
                    key = (raw.get('author', ''), ' '.join(text.lower().split())[:60])
                    if key in seen:
                        continue
                    seen.add(key)
                    rating = raw.get('rating')
                    reviews.append({
                        'Edificio': base_name,
                        'Fecha': raw.get('date'),
                        'Score': float(rating) if rating is not None else 0.0,
                        'Texto': str(text),
                        'Usuario': str(raw.get('author', '')),
                    })
            else:
                print(f"[WARN] Sin datos XHR para {building_query}, usando fallback DOM")
                reviews = await _extract_reviews_from_dom(page, building_query)

        except Exception:
            await browser.close()
            raise
        finally:
            await browser.close()

    return reviews


async def fetch_reviews(building_query: str, headless: bool = True, debug: bool = False) -> list:
    """
    Descarga reseñas de Google Maps con reintentos automáticos (máx. MAX_RETRIES).
    Usa intercepción XHR de ListUgcPosts para fechas exactas.
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return await _fetch_once(building_query, headless=headless, debug=debug)
        except Exception as e:
            wait = RETRY_BACKOFF * attempt
            if attempt < MAX_RETRIES:
                print(f"[RETRY {attempt}/{MAX_RETRIES}] {building_query}: {type(e).__name__} — reintentando en {wait}s")
                await asyncio.sleep(wait)
            else:
                print(f"[FAILED] {building_query}: agotados {MAX_RETRIES} intentos. Último error: {type(e).__name__}: {e}")

    return []


async def fetch_all_buildings(
    buildings: list = BUILDINGS,
    max_workers: int = 3,
    filter_month: bool = True,
) -> tuple[list, dict]:
    """
    Descarga reseñas de todos los edificios en paralelo (máx. max_workers simultáneos).
    Retorna (all_reviews, counts_per_building).
    """
    sem = asyncio.Semaphore(max_workers)

    async def fetch_limited(query):
        async with sem:
            print(f"[>>] Scrapeando: {query}")
            result = await fetch_reviews(query)
            print(f"[OK] {query}: {len(result)} reseñas")
            return result

    tasks = [fetch_limited(b) for b in buildings]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_reviews = []
    counts = {}
    for b, res in zip(buildings, results):
        if isinstance(res, Exception):
            print(f"[ERROR] {b}: {res}")
            counts[b] = -1
        else:
            counts[b] = len(res)
            all_reviews.extend(res)

    if filter_month:
        before = len(all_reviews)
        all_reviews = filter_last_month(all_reviews)
        print(f"[FILTRO] {before} reseñas totales → {len(all_reviews)} del último mes")

    return all_reviews, counts
