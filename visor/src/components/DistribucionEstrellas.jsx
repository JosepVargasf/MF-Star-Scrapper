import { useState, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import ExportPanel from './ExportPanel'

const STAR_COLORS = { 1: '#5B6670', 2: '#A26579', 3: '#D7A1A7', 4: '#C0848A', 5: '#96323C' }

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <p className="tt-title">{d.estrellas}</p>
      <p className="tt-row"><span>Reseñas</span><strong>{d.cantidad}</strong></p>
      <p className="tt-row"><span>Porcentaje</span><strong>{d.pct}%</strong></p>
    </div>
  )
}

export default function DistribucionEstrellas({ reviews }) {
  const edificios = [...new Set(reviews.map(r => r.edificio))].sort()
  const [selected, setSelected] = useState(edificios[0] ?? '')
  const [fontSize, setFontSize] = useState(11)
  const chartRef = useRef(null)

  const filtered = reviews.filter(r => r.edificio === selected && r.score)
  const total = filtered.length || 1
  const dist = [5, 4, 3, 2, 1].map(star => {
    const cantidad = filtered.filter(r => Math.round(r.score) === star).length
    return { estrellas: '★'.repeat(star), star, cantidad, pct: +((cantidad / total) * 100).toFixed(1) }
  })
  const posCount = filtered.filter(r => r.sentimiento === 'Positiva').length
  const negCount = filtered.filter(r => r.sentimiento === 'Negativa').length
  const neuCount = filtered.length - posCount - negCount

  return (
    <div className="card">
        <div className="card-header">
          <div>
            <h2>Distribución de Estrellas</h2>
            <p className="card-sub">Polarización de opiniones por edificio</p>
          </div>
        </div>
        <select value={selected} onChange={e => setSelected(e.target.value)} className="select">
          {edificios.map(ed => <option key={ed} value={ed}>{ed}</option>)}
        </select>
      <div ref={chartRef} id="content-distribucion-estrellas">
        <p className="chart-context">{selected}</p>
        <div className="sentiment-row">
          <div className="sentiment-pill green">👍 {posCount} positivas</div>
          <div className="sentiment-pill amber">😐 {neuCount} neutras</div>
          <div className="sentiment-pill red">👎 {negCount} negativas</div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dist} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="estrellas" width={55} tick={{ fontSize: fontSize + 2 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="pct" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {dist.map((entry, i) => <Cell key={i} fill={STAR_COLORS[entry.star]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ExportPanel chartRef={chartRef} chartName="distribucion-estrellas" title="Distribución de Estrellas" fontSize={fontSize} onFontSizeChange={setFontSize} />
    </div>
  )
}
