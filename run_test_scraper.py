"""
Script de prueba manual del scraper.
Corre un solo edificio y muestra los resultados en consola.

Uso:
    python run_test_scraper.py
    python run_test_scraper.py "Nomad Bellet, Santiago, Chile"
"""

import asyncio
import sys
from scraper_playwright import fetch_reviews, BUILDINGS

async def main():
    building = sys.argv[1] if len(sys.argv) > 1 else BUILDINGS[0]

    print(f"\n{'='*60}")
    print(f"Scrapeando: {building}")
    print(f"{'='*60}\n")

    # headless=False abre el browser visible para que puedas ver qué hace
    reviews = await fetch_reviews(building, headless=False, debug=True)

    if not reviews:
        print("No se encontraron reseñas.")
        return

    print(f"\nTotal reseñas capturadas: {len(reviews)}\n")
    print(f"{'─'*60}")

    for i, r in enumerate(reviews, 1):
        fecha = r['Fecha'].strftime('%Y-%m-%d') if r['Fecha'] else 'Sin fecha'
        score = '⭐' * int(r['Score']) if r['Score'] else '?'
        texto = r['Texto'][:80] + '...' if len(r['Texto']) > 80 else r['Texto']
        print(f"[{i:03d}] {fecha} | {score} | {r['Usuario']}")
        print(f"      {texto}")
        print()

    print(f"{'─'*60}")
    print(f"Total: {len(reviews)} reseñas")

if __name__ == '__main__':
    asyncio.run(main())
