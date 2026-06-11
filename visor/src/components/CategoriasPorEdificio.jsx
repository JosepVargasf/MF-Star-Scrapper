import { useMemo, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, Legend,
} from 'recharts'
import ExportPanel from './ExportPanel'

const PALETTE = [
  '#96323C','#5B6670','#A26579','#2D3334','#D7A1A7',
  '#800000','#51313C','#70262D','#444C54','#7A4C5B',
  '#C0848A','#BDC1C5','#3A4A52','#6B3040','#E8C4C7',
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip" style={{ maxWidth: 220 }}>
      <p className="tt-title" style={{ marginBottom: 6 }}>{label}</p>
      {[...payload].reverse().map(p => (
        p.value > 0 && (
          <p key={p.dataKey} className="tt-row">
            <span style={{ color: p.fill }}>■ {p.name}</span>
            <strong>{p.value}%</strong>
          </p>
        )
      ))}
    </div>
  )
}

function renderCustomLabel({ x, y, width, height, value }) {
  if (!value || value < 5 || height < 14) return null
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize={9}
      fontWeight={700}
    >
      {value}%
    </text>
  )
}

export default function CategoriasPorEdificio({ reviews }) {
  const [sentimiento, setSentimiento] = useState('Positiva')
  const [fontSize, setFontSize] = useState(10)
  const chartRef = useRef(null)

  // Construir datos: por edificio, % de cada tema
  const { data, temas } = useMemo(() => {
    const edificios = [...new Set(reviews.map(r => r.edificio))].sort()

    // Contar menciones por edificio + tema
    const raw = {}
    for (const r of reviews) {
      if (r.sentimiento !== sentimiento) continue
      if (!raw[r.edificio]) raw[r.edificio] = {}
      for (const t of r.temas ?? []) {
        if (t === 'Sin Comentario') continue
        raw[r.edificio][t] = (raw[r.edificio][t] ?? 0) + 1
      }
    }

    // Todos los temas presentes, ordenados por frecuencia global
    const globalCount = {}
    for (const ed of Object.values(raw))
      for (const [t, n] of Object.entries(ed))
        globalCount[t] = (globalCount[t] ?? 0) + n

    const temas = Object.entries(globalCount)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)

    // Convertir a porcentajes por edificio
    const data = edificios
      .filter(ed => raw[ed])
      .map(ed => {
        const totMenciones = Object.values(raw[ed] ?? {}).reduce((s, n) => s + n, 0) || 1
        const row = { edificio: ed }
        for (const t of temas)
          row[t] = raw[ed]?.[t] ? Math.round((raw[ed][t] / totMenciones) * 100) : 0
        return row
      })

    return { data, temas }
  }, [reviews, sentimiento])

  const barHeight = 52
  const chartHeight = Math.max(320, data.length * barHeight + 80)

  return (
    <div className="card card-full">
      <div ref={chartRef}>
        <div className="card-header">
          <div>
            <h2>Categorías según Comentarios por Edificio</h2>
            <p className="card-sub">% de menciones por tema en cada edificio · 100% apilado</p>
          </div>
          <div className="tab-group">
            <button
              className={`tab${sentimiento === 'Positiva' ? ' active' : ''}`}
              onClick={() => setSentimiento('Positiva')}
            >👍 Positivos</button>
            <button
              className={`tab${sentimiento === 'Negativa' ? ' active' : ''}`}
              onClick={() => setSentimiento('Negativa')}
            >👎 Negativos</button>
          </div>
        </div>

        {data.length === 0 ? (
          <p className="empty">Sin datos.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.max(700, data.length * 58) }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 8, left: 148 }}
                  barSize={barHeight - 10}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={v => `${v}%`}
                    tick={{ fontSize, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="edificio"
                    width={140}
                    tick={{ fontSize, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Legend
                    wrapperStyle={{ fontSize: fontSize - 1, paddingTop: 12 }}
                    iconType="square"
                    iconSize={10}
                  />
                  {temas.map((tema, i) => (
                    <Bar
                      key={tema}
                      dataKey={tema}
                      name={tema}
                      stackId="a"
                      fill={PALETTE[i % PALETTE.length]}
                      radius={i === temas.length - 1 ? [0, 3, 3, 0] : 0}
                    >
                      <LabelList content={renderCustomLabel} />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      <ExportPanel
        chartRef={chartRef}
        chartName={`categorias-${sentimiento.toLowerCase()}`}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
      />
    </div>
  )
}
