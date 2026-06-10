# MF Star Scrapper

Plataforma de análisis de reseñas Google Maps para edificios multifamily en Santiago, Chile. Combina un scraper Playwright con un visor web React para monitorear reputación, sentimiento y tendencias por edificio.

## Arquitectura

```
scraper_playwright.py   # Scraper (Playwright + XHR interception)
pipeline.py             # Procesamiento, análisis y exportación
visor/                  # Dashboard React/Vite con auth Firebase
data/                   # reviews.json, metrics.json, Excel
```

## Scraper (`scraper_playwright.py`)

Usa Playwright para navegar Google Maps e interceptar llamadas XHR internas (`batchexecute → MapsUgcPostService.ListUgcPosts`) para obtener **timestamps exactos** de cada reseña en microsegundos.

- Extrae: autor, fecha exacta, rating, texto, sentimiento, temas
- Deduplicación por `(autor, text[:60])` para evitar duplicados en paginación
- Fallback a scraping DOM si XHR no retorna datos
- 23 edificios monitoreados (INSITU, Somma, Greystar, LarGroup, Grupo Coloso, Renovate)

### Uso

```bash
# Scrape completo
python pipeline.py

# Solo edificios específicos
python pipeline.py --buildings "somma plaza bustamante" "ronda santo domingo"

# Refinar fechas históricas con timestamps exactos
python pipeline.py --refine
```

## Pipeline (`pipeline.py`)

Orquesta scraping, procesamiento y exportación.

- **Análisis de sentimiento** (TextBlob + heurísticas en español)
- **Categorización temática**: arriendo, amenidades, ruido, seguridad, servicio, etc.
- **Backup automático** de `reviews.json` antes de cada escritura (`data/backups/`)
- **`refine_historical_dates()`**: actualiza fechas aproximadas con timestamps exactos del scraper
- **`deduplicate_historical()`**: elimina duplicados históricos conservando la fecha más reciente
- Exporta a `data/reviews.json`, `data/metrics.json` y `data/informe_multifamily.xlsx`
- Normalización de operadores: `Greystar`, `LarGroup` (variantes históricas unificadas)

## Visor (`visor/`)

Dashboard React + Vite con autenticación Google (Firebase). Lee los JSON desde `visor/public/data/`.

### Secciones

| Sección | Descripción |
|---|---|
| **Resumen KPI** | Total reseñas, rating promedio, % positivas/negativas, filtros por comuna y operador |
| **Ranking** | Edificios ordenados por rating con tendencia |
| **Métricas detalladas** | Tabla comparativa con rating, volumen, sentimiento y variación |
| **Volumen de reseñas** | Barras mensuales apiladas por edificio · **doble clic** para ver distribución diaria |
| **Evolución del rating** | Línea de tiempo mensual/acumulada/anual · rango dinámico según edificios seleccionados |
| **¿Por qué califican así?** | Temas frecuentes en reseñas positivas y negativas · doble clic para leer reseñas |
| **Temas por género** | Comparativa de temáticas entre reseñas de hombres y mujeres |
| **Heatmap de temas** | Intensidad de temas por edificio |
| **Distribución estrellas** | Histograma de ratings 1–5 |
| **Keywords** | Palabras clave más frecuentes con sentimiento asociado |

### Características responsive

- Sidebar sticky con navegación horizontal scrollable en móvil
- Topbar en 2 filas en pantallas pequeñas (título + filtros)
- Tablas con scroll horizontal táctil
- Targets táctiles mínimos de 30–36px

### Deploy

```bash
cd visor
npm install
npm run build   # genera visor/dist/
```

El build se despliega automáticamente al hacer push a `master`.

## Flujo de actualización de datos

```bash
# 1. Correr el pipeline localmente
python pipeline.py

# 2. Copiar JSON al visor
cp data/reviews.json visor/public/data/reviews.json
cp data/metrics.json visor/public/data/metrics.json

# 3. Commit y push → dispara deploy automático
git add data/ visor/public/data/
git commit -m "data: actualización mensual"
git push origin master
```

## Requisitos

```bash
pip install -r requirements.txt
playwright install chromium
```

Firebase config en `visor/src/firebase.js` (no incluido en repo).

## Estructura

```
├── scraper_playwright.py     # Scraper principal (Playwright + XHR)
├── pipeline.py               # Orquestador: scraping → análisis → exportación
├── requirements.txt
├── data/
│   ├── reviews.json          # Base histórica de reseñas
│   ├── metrics.json          # Métricas agregadas por edificio
│   ├── informe_multifamily.xlsx
│   └── backups/              # Backups automáticos pre-escritura
└── visor/
    ├── src/
    │   ├── App.jsx / App.css
    │   ├── components/       # KpiCards, VolumenReseñas, EvolucionMensual, etc.
    │   └── hooks/            # useData, useAuth
    └── public/data/          # JSON servidos al visor en producción
```
