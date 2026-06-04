import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const STAR_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#84cc16', 5: '#10b981' }

function ratingColor(r) {
  if (r >= 4.5) return '#10b981'
  if (r >= 4.0) return '#34d399'
  if (r >= 3.5) return '#f59e0b'
  return '#ef4444'
}

function TooltipRating({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <p className="tt-title">{d.edificio}</p>
      <p className="tt-row"><span>Rating actual</span><strong>{d.calif_actual?.toFixed(2)}</strong></p>
      {d.calif_previo != null && <p className="tt-row"><span>Mes anterior</span><strong>{d.calif_previo?.toFixed(2)}</strong></p>}
      {d.variacion != null && (
        <p className="tt-row">
          <span>Variación</span>
          <strong className={d.variacion >= 0 ? 'positive' : 'negative'}>
            {d.variacion >= 0 ? '+' : ''}{d.variacion?.toFixed(2)}
          </strong>
        </p>
      )}
      <p className="tt-row"><span>Total reseñas</span><strong>{d.resenastot}</strong></p>
    </div>
  )
}

function TooltipEstrellas({ active, payload, star }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <p className="tt-title">{d.edificio}</p>
      <p className="tt-row"><span>{'★'.repeat(star)} reseñas</span><strong>{d.count}</strong></p>
      <p className="tt-row"><span>% del total</span><strong>{d.pct?.toFixed(1)}%</strong></p>
      <p className="tt-row"><span>Total reseñas</span><strong>{d.total}</strong></p>
    </div>
  )
}

export default function RankingEdificios({ metrics, reviews }) {
  const [mode, setMode] = useState('rating') // 'rating' | 'estrellas'
  const [star, setStar]  = useState(5)

  // Modo rating: deduplicar por edificio
  const sortedRating = useMemo(() => Object.values(
    metrics
      .filter(m => m.calif_actual != null)
      .reduce((acc, m) => {
        if (!acc[m.edificio] || m.calif_actual > acc[m.edificio].calif_actual)
          acc[m.edificio] = m
        return acc
      }, {})
  ).sort((a, b) => b.calif_actual - a.calif_actual), [metrics])

  // Modo estrellas: contar por edificio cuántos tienen X estrella
  const sortedEstrellas = useMemo(() => {
    const counts = {}
    for (const r of reviews) {
      if (!r.score) continue
      const s = Math.round(r.score)
      if (!counts[r.edificio]) counts[r.edificio] = { total: 0 }
      counts[r.edificio].total++
      counts[r.edificio][s] = (counts[r.edificio][s] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([edificio, c]) => ({
        edificio,
        count: c[star] ?? 0,
        total: c.total,
        pct:   c.total ? +((c[star] ?? 0) / c.total * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [reviews, star])

  const data        = mode === 'rating' ? sortedRating : sortedEstrellas
  const chartHeight = Math.max(280, data.length * 44)
  const starColor   = STAR_COLORS[star]

  return (
    <div className="card card-full">
      <div className="card-header">
        <div>
          <h2>Ranking de Edificios</h2>
          <p className="card-sub">
            {mode === 'rating'
              ? 'Ordenado por rating promedio'
              : `Ordenado por % de reseñas de ${'★'.repeat(star)}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mode === 'estrellas' && (
            <div className="tab-group">
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  className={`tab${star === s ? ' active' : ''}`}
                  style={star === s ? { background: STAR_COLORS[s], borderColor: 'transparent' } : {}}
                  onClick={() => setStar(s)}
                >
                  {'★'.repeat(s)}
                </button>
              ))}
            </div>
          )}
          <div className="tab-group">
            <button className={`tab${mode === 'rating'    ? ' active' : ''}`} onClick={() => setMode('rating')}>Rating</button>
            <button className={`tab${mode === 'estrellas' ? ' active' : ''}`} onClick={() => setMode('estrellas')}>Estrellas</button>
          </div>
        </div>
      </div>

      {mode === 'rating' && (
        <div className="legend-inline" style={{ marginBottom: 12 }}>
          <span className="dot green" /> ≥ 4.5
          <span className="dot amber" /> ≥ 3.5
          <span className="dot red" /> &lt; 3.5
        </div>
      )}

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis
            type="number"
            domain={mode === 'rating' ? [0, 5] : [0, 100]}
            tickCount={mode === 'rating' ? 6 : 5}
            unit={mode === 'estrellas' ? '%' : ''}
            tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          />
          <YAxis type="category" dataKey="edificio" width={160} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
          {mode === 'rating'
            ? <Tooltip content={<TooltipRating />} cursor={{ fill: '#f8fafc' }} />
            : <Tooltip content={<TooltipEstrellas star={star} />} cursor={{ fill: '#f8fafc' }} />
          }
          {mode === 'rating' && <ReferenceLine x={4} stroke="#e2e8f0" strokeDasharray="4 2" />}
          <Bar
            dataKey={mode === 'rating' ? 'calif_actual' : 'pct'}
            radius={[0, 6, 6, 0]}
            maxBarSize={26}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={mode === 'rating' ? ratingColor(entry.calif_actual) : starColor}
                fillOpacity={mode === 'estrellas' ? 0.3 + (entry.pct / 100) * 0.7 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
