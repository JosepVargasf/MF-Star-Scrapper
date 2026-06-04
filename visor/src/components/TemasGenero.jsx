import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'

const FEMALE_COLOR = '#a855f7'
const MALE_COLOR   = '#0ea5e9'
const OTROS_COLOR  = '#e2e8f0'

function buildData(reviews, sentimiento, edificio) {
  const counts = {}
  const filtered = edificio === 'todos'
    ? reviews
    : reviews.filter(r => r.edificio === edificio)

  for (const r of filtered) {
    if (r.sentimiento !== sentimiento) continue
    const sexo = r.sexo || ''
    for (const t of r.temas ?? []) {
      if (t === 'Sin Comentario') continue
      if (!counts[t]) counts[t] = { female: 0, male: 0, otros: 0, total: 0 }
      counts[t].total++
      if (sexo === 'female' || sexo === 'mostly_female')      counts[t].female++
      else if (sexo === 'male' || sexo === 'mostly_male')     counts[t].male++
      else                                                     counts[t].otros++
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 12)
    .map(([tema, c]) => ({
      tema,
      total: c.total,
      female: c.total ? +((c.female / c.total) * 100).toFixed(1) : 0,
      male:   c.total ? +((c.male   / c.total) * 100).toFixed(1) : 0,
      otros:  c.total ? +((c.otros  / c.total) * 100).toFixed(1) : 0,
    }))
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="chart-tooltip">
      <p className="tt-title">{label}</p>
      <p className="tt-row"><span>Total menciones</span><strong>{d?.total}</strong></p>
      <p className="tt-row"><span style={{color: FEMALE_COLOR}}>♀ Mujer</span><strong>{d?.female}%</strong></p>
      <p className="tt-row"><span style={{color: MALE_COLOR}}>♂ Hombre</span><strong>{d?.male}%</strong></p>
      {d?.otros > 0 && <p className="tt-row"><span>Sin clasificar</span><strong>{d?.otros}%</strong></p>}
    </div>
  )
}

function GenderChart({ data, title, accent }) {
  return (
    <div className="tg-chart-wrap">
      <div className="tg-chart-title" style={{ borderColor: accent }}>
        {title}
      </div>
      {data.length === 0
        ? <p className="empty">Sin datos para el período.</p>
        : (
          <ResponsiveContainer width="100%" height={Math.max(280, data.length * 36)}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="tema" width={150} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="female" name="♀ Mujer"   stackId="a" fill={FEMALE_COLOR} maxBarSize={22} />
              <Bar dataKey="male"   name="♂ Hombre"  stackId="a" fill={MALE_COLOR}   maxBarSize={22} />
              <Bar dataKey="otros"  name="Sin clasif." stackId="a" fill={OTROS_COLOR} maxBarSize={22} radius={[0,4,4,0]}>
                <LabelList dataKey="total" position="right" style={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }
    </div>
  )
}

export default function TemasGenero({ reviews }) {
  const edificios = [...new Set(reviews.map(r => r.edificio))].sort()
  const [edificio, setEdificio] = useState('todos')

  const positivos = useMemo(() => buildData(reviews, 'Positiva', edificio), [reviews, edificio])
  const negativos = useMemo(() => buildData(reviews, 'Negativa', edificio), [reviews, edificio])

  return (
    <div className="card card-full">
      <div className="card-header">
        <div>
          <h2>Temas por género</h2>
          <p className="card-sub">Qué mencionan hombres y mujeres en reseñas positivas y negativas</p>
        </div>
        <select value={edificio} onChange={e => setEdificio(e.target.value)} className="select" style={{ marginBottom: 0, width: 220 }}>
          <option value="todos">Todos los edificios</option>
          {edificios.map(ed => <option key={ed} value={ed}>{ed}</option>)}
        </select>
      </div>

      <div className="tg-legend">
        <span><span className="tg-dot" style={{ background: FEMALE_COLOR }} />Mujer</span>
        <span><span className="tg-dot" style={{ background: MALE_COLOR }} />Hombre</span>
        <span><span className="tg-dot" style={{ background: OTROS_COLOR }} />Sin clasificar</span>
        <span className="tg-note">Barras = % del total de menciones por tema · número a la derecha = total</span>
      </div>

      <div className="tg-cols">
        <GenderChart data={positivos} title="👍 Temas en reseñas positivas" accent="#10b981" />
        <GenderChart data={negativos} title="👎 Temas en reseñas negativas" accent="#ef4444" />
      </div>
    </div>
  )
}
