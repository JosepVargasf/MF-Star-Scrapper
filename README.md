# MF Star Scrapper

Scraper mensual de reseñas de Google Maps para edificios multifamily en Santiago, Chile. Descarga reseñas vía la API de Outscraper, las procesa y exporta un informe Excel con análisis de sentimiento, keywords y categorización por temáticas.

## ¿Qué hace?

- Descarga reseñas de Google Maps para una lista de edificios configurada en el script
- Procesa y limpia los datos (fechas, géneros, idioma)
- Clasifica reseñas por categorías temáticas (arriendo, amenidades, ruido, etc.)
- Calcula polaridad de sentimiento con TextBlob
- Extrae keywords relevantes con RAKE
- Exporta todo a un archivo Excel listo para Power BI

## Requisitos

- Python 3.9+
- Cuenta y API Key de [Outscraper](https://outscraper.com/)

## Instalación

```bash
pip install -r requirements.txt
```

Crea un archivo `.env` en la raíz del proyecto (puedes copiar `.env.example`):

```
OUTSCRAPER_API_KEY=tu_api_key_aqui
```

## Uso

```bash
python Scrapper_Estrellas_v4.0.py
```

El informe se genera en `data/informe_multifamily.xlsx`.

## Edificios monitoreados

Configurados en la variable `BUILDINGS` del script. Actualmente incluye proyectos INSITU, Somma, Ronda, Nativo, Nomad, IMU, Spot, Soho y Park Santiago.

## Estructura del proyecto

```
├── Scrapper_Estrellas_v4.0.py   # Script principal
├── requirements.txt
├── .env.example
├── data/
│   └── informe_multifamily.xlsx # Informe generado
└── old/                         # Versiones anteriores
```
