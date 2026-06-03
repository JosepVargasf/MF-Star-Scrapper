import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, ReferenceLine,
} from 'recharts'

function ratingColor(r) {
  if (r >= 4.5) return '#10b981'
  if (r >= 4.0) return '#34d399'
  if (r >= 3.5) return '#f59e0b'
  return '#ef4444'
}

function CustomTooltip({ active, payload }) {
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

export default function RankingEdificios({ metrics }) {
  // Deduplicar por edificio: quedarse con el de mayor calif_actual
  const deduped = Object.values(
    metrics
      .filter(m => m.calif_actual != null)
      .reduce((acc, m) => {
        if (!acc[m.edificio] || m.calif_actual > acc[m.edificio].calif_actual)
          acc[m.edificio] = m
        return acc
      }, {})
  ).sort((a, b) => b.calif_actual - a.calif_actual)

  const chartHeight = Math.max(280, deduped.length * 44)

  return (
    <div className="card card-full">
      <div className="card-header">
        <div>
          <h2>Ranking por Rating Promedio</h2>
          <p className="card-sub">Ordenado de mejor a peor evaluado este mes</p>
        </div>
        <div className="legend-inline">
          <span className="dot green" /> ≥ 4.5
          <span className="dot amber" /> ≥ 3.5
          <span className="dot red" /> &lt; 3.5
        </div>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={deduped} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" domain={[0, 5]} tickCount={6} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="edificio" width={160} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <ReferenceLine x={4} stroke="#e2e8f0" strokeDasharray="4 2" />
          <Bar dataKey="calif_actual" name="Rating" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {deduped.map((entry, i) => (
              <Cell key={i} fill={ratingColor(entry.calif_actual)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
