import { useState, useMemo, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import ExportPanel from './ExportPanel'

const STAR_COLORS = { 1: '#5B6670', 2: '#A26579', 3: '#D7A1A7', 4: '#C0848A', 5: '#96323C' }
const ROW_HEIGHT = 40 // alto fijo por fila/barra: nunca cambia con el tamaño de letra

function ratingColor(r) {
  if (r >= 4.5) return '#96323C'
  if (r >= 4.0) return '#C0848A'
  if (r >= 3.5) return '#A26579'
  return '#5B6670'
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
  const [mode, setMode] = useState('rating')
  const [star, setStar]  = useState(5)
  const [fontSize, setFontSize] = useState(11)
  const chartRef = useRef(null)

  const sortedRating = useMemo(() => Object.values(
    metrics.filter(m => m.calif_actual != null).reduce((acc, m) => {
      if (!acc[m.edificio] || m.calif_actual > acc[m.edificio].calif_actual) acc[m.edificio] = m
      return acc
    }, {})
  ).sort((a, b) => b.calif_actual - a.calif_actual), [metrics])

  const sortedEstrellas = useMemo(() => {
    const counts = {}
    for (const r of reviews) {
      if (!r.score) continue
      const s = Math.round(r.score)
      if (!counts[r.edificio]) counts[r.edificio] = { total: 0 }
      counts[r.edificio].total++
      counts[r.edificio][s] = (counts[r.edificio][s] ?? 0) + 1
    }
    return Object.entries(counts).map(([edificio, c]) => ({
      edificio, count: c[star] ?? 0, total: c.total,
      pct: c.total ? +((c[star] ?? 0) / c.total * 100).toFixed(1) : 0,
    })).sort((a, b) => b.pct - a.pct)
  }, [reviews, star])

  const data        = mode === 'rating' ? sortedRating : sortedEstrellas
  const maxNameLen  = data.reduce((m, d) => Math.max(m, (d.edificio ?? '').length), 0)
  const yAxisWidth  = Math.max(120, Math.round(maxNameLen * fontSize * 0.62) + 16)
  const chartHeight = data.length * ROW_HEIGHT + 24 // alto total = filas fijas + margen, nunca achica las barras
  const starColor   = STAR_COLORS[star]

  return (
    <div className="card card-full">
      <div ref={chartRef}>
        <div className="card-header">
          <div>
            <h2>Ranking de Edificios</h2>
            <p className="card-sub">
              {mode === 'rating' ? 'Ordenado por rating promedio' : `Ordenado por % de reseñas de ${'★'.repeat(star)}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {mode === 'estrellas' && (
              <div className="tab-group">
                {[1,2,3,4,5].map(s => (
                  <button key={s} className={`tab${star === s ? ' active' : ''}`}
                    style={star === s ? { background: STAR_COLORS[s], borderColor: 'transparent' } : {}}
                    onClick={() => setStar(s)}>{'★'.repeat(s)}</button>
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
            <XAxis type="number"
              domain={mode === 'rating' ? [0, 5] : [0, 100]}
              tickCount={mode === 'rating' ? 6 : 5}
              unit={mode === 'estrellas' ? '%' : ''}
              tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false}
            />
            <YAxis type="category" dataKey="edificio" width={yAxisWidth} tick={{ fontSize, fill: '#475569' }} axisLine={false} tickLine={false} />
            {mode === 'rating'
              ? <Tooltip content={<TooltipRating />} cursor={{ fill: '#f8fafc' }} />
              : <Tooltip content={<TooltipEstrellas star={star} />} cursor={{ fill: '#f8fafc' }} />}
            {mode === 'rating' && <ReferenceLine x={4} stroke="#e2e8f0" strokeDasharray="4 2" />}
            <Bar dataKey={mode === 'rating' ? 'calif_actual' : 'pct'} radius={[0, 6, 6, 0]} maxBarSize={26}>
              {data.map((entry, i) => (
                <Cell key={i}
                  fill={mode === 'rating' ? ratingColor(entry.calif_actual) : starColor}
                  fillOpacity={mode === 'estrellas' ? 0.3 + (entry.pct / 100) * 0.7 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ExportPanel chartRef={chartRef} chartName="ranking-edificios" fontSize={fontSize} onFontSizeChange={setFontSize} />
    </div>
  )
}
