import { useState, useEffect } from 'react'

const BASE = import.meta.env.BASE_URL

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
        setMetrics(m)
        setReviews(r)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  return { metrics, reviews, loading, error }
}
