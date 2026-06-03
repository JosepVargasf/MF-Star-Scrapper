import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import MonthRangePicker from './MonthRangePicker'

const PALETTE = [
  '#6366f1','#10b981','#f59e0b','#0ea5e9','#a855f7',
  '#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4',
  '#8b5cf6','#22c55e','#e11d48','#0284c7','#d97706',
]

function hexOpacity(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${alpha})`
}

function CustomTooltip({ active, payload, label, edificios }) {
  if (!active || !payload?.length) return null
  const byEd = {}
  for (const p of payload) {
    const [ed, type] = p.dataKey.split('||')
    if (!byEd[ed]) byEd[ed] = { pos: 0, neg: 0, color: p.fill }
    byEd[ed][type] = p.value ?? 0
  }
  return (
    <div className="chart-tooltip" style={{ minWidth: 200 }}>
      <p className="tt-title">{label}</p>
      {Object.entries(byEd).filter(([,v]) => v.pos + v.neg > 0).map(([ed, v]) => (
        <div key={ed} className="tt-ed-block">
          <div className="tt-ed-name">
            <span className="tt-dot" style={{ background: v.color }} />
            {ed}
          </div>
          <div className="tt-ed-vals">
            <span className="tt-pos-val">👍 {v.pos}</span>
            <span className="tt-neg-val">👎 {v.neg}</span>
            <span className="tt-tot-val">= {v.pos + v.neg}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function VolumenReseñas({ reviews }) {
  const allEdificios = [...new Set(reviews.map(r => r.edificio))].sort()
  const [selectedEds, setSelectedEds] = useState(new Set(allEdificios.slice(0, 5)))

  const availableMonths = useMemo(() => {
    const set = new Set(reviews.filter(r => r.fecha).map(r => r.fecha.slice(0, 7)))
    return [...set].sort()
  }, [reviews])

  const [range, setRange] = useState({
    from: availableMonths[0] ?? '',
    to:   availableMonths[availableMonths.length - 1] ?? '',
  })

  function toggleEdificio(ed) {
    setSelectedEds(prev => {
      const next = new Set(prev)
      next.has(ed) ? next.delete(ed) : next.add(ed)
      return next
    })
  }

  const activeEds = allEdificios.filter(ed => selectedEds.has(ed))

  const data = useMemo(() => {
    const months = availableMonths.filter(m => m >= range.from && m <= range.to)
    return months.map(mes => {
      const row = { mes }
      for (const ed of activeEds) {
        const edMes = reviews.filter(r =>
          r.edificio === ed && r.fecha?.slice(0, 7) === mes
        )
        row[`${ed}||pos`] = edMes.filter(r => r.sentimiento === 'Positiva').length
        row[`${ed}||neg`] = edMes.filter(r => r.sentimiento === 'Negativa').length
      }
      return row
    })
  }, [reviews, activeEds, availableMonths, range])

  return (
    <div className="card card-full">
      <div className="card-header">
        <div>
          <h2>Volumen de Reseñas por Mes</h2>
          <p className="card-sub">Reseñas positivas y negativas por edificio · agrupadas por mes</p>
        </div>
        <MonthRangePicker value={range} onChange={setRange} availableMonths={availableMonths} />
      </div>

      <div className="vr-filter">
        <button
          className={`kpi-chip${selectedEds.size === allEdificios.length ? ' active' : ''}`}
          onClick={() => setSelectedEds(new Set(allEdificios))}
        >
          Todos
        </button>
        {allEdificios.map((ed, i) => (
          <button
            key={ed}
            className={`kpi-chip${selectedEds.has(ed) ? ' active' : ''}`}
            style={selectedEds.has(ed) ? { background: PALETTE[i % PALETTE.length], borderColor: 'transparent' } : {}}
            onClick={() => toggleEdificio(ed)}
          >
            {ed}
          </button>
        ))}
      </div>

      <div className="vr-legend">
        <span className="vr-leg-item"><span className="vr-swatch vr-pos" />Positivas (color lleno)</span>
        <span className="vr-leg-item"><span className="vr-swatch vr-neg" />Negativas (color suave)</span>
      </div>

      {data.length === 0 || activeEds.length === 0 ? (
        <p className="empty">Selecciona al menos un edificio.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(320, activeEds.length * 28 * data.length / Math.max(data.length, 1))}>
          <BarChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }} barCategoryGap="20%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            {activeEds.map((ed, i) => {
              const color = PALETTE[allEdificios.indexOf(ed) % PALETTE.length]
              return [
                <Bar key={`${ed}-pos`} dataKey={`${ed}||pos`} name={`${ed} pos`} stackId={ed}
                  fill={color} radius={[0,0,0,0]} maxBarSize={24} />,
                <Bar key={`${ed}-neg`} dataKey={`${ed}||neg`} name={`${ed} neg`} stackId={ed}
                  fill={hexOpacity(color, 0.35)} radius={[3,3,0,0]} maxBarSize={24} />,
              ]
            })}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
