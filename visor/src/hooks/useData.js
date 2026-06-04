import { useState, useEffect } from 'react'

const BASE = import.meta.env.BASE_URL

// Palabras que no se capitalizan en títulos
const LOWER_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'en'])

function titleCase(str) {
  return str
    .split(' ')
    .map((w, i) => (i === 0 || !LOWER_WORDS.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ')
}

function normalizeEdificio(name) {
  return titleCase((name || '').toLowerCase())
}

export function useData() {
  const [metrics, setMetrics] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}data/metrics.json`).then(r => r.json()),
      fetch(`${BASE}data/reviews.json`).then(r => r.json()),
    ])
      .then(([m, r]) => {
        setMetrics(m.map(x => ({ ...x, edificio: normalizeEdificio(x.edificio) })))
        setReviews(r.map(x => ({ ...x, edificio: normalizeEdificio(x.edificio) })))
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  // Extraer comunas y operadores únicos
  const comunas   = [...new Set(reviews.map(r => r.comuna).filter(Boolean))].sort()
  const operadores = [...new Set(reviews.map(r => r.operador).filter(Boolean))].sort()

  return { metrics, reviews, loading, error, comunas, operadores }
}
