import { useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import ExportPanel from './ExportPanel'

const PALETTE = ['#96323C','#2D3334','#D7A1A7','#5B6670','#800000','#A26579','#51313C']
const COMUNAS_ORDEN = ['Las Condes', 'Providencia', 'Ñuñoa', 'Santiago']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="tt-title">{label}</p>
      {payload.filter(p => p.value != null).map((p, i) => (
        <p key={i} className="tt-row">
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color, marginRight: 6 }} />
            {p.name}
          </span>
          <strong>{p.value?.toFixed(2)} ★</strong>
        </p>
      ))}
    </div>
  )
}

function ComunaPanel({ comuna, data, edificios, colors, fontSize }) {
  return (
    <div className="evol-est-panel">
      <div className="evol-est-titulo">{`Evolución Estrellas Edificios – ${comuna}`}</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize, fill: '#94a3b8' }}
            axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={[0, 5]} tickCount={6} tick={{ fontSize, fill: '#94a3b8' }}
            axisLine={false} tickLine={false} width={28} />
          <ReferenceLine y={4} stroke="#e2e8f0" strokeDasharray="4 3" />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="plainline" iconSize={16} verticalAlign="top"
            wrapperStyle={{ fontSize, paddingBottom: 8 }} />
          {edificios.map((ed, i) => (
            <Line key={ed} type="monotone" dataKey={ed}
              stroke={colors[i % colors.length]}
              strokeWidth={i === 0 ? 2.5 : 2}
              strokeDasharray={i >= 4 ? '6 3' : undefined}
              dot={false} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function EvolucionEstrellas({ reviews }) {
  const [fontSize, setFontSize] = useState(10)
  const chartRef = useRef(null)

  const byComuna = useMemo(() => {
    const map = {}
    for (const r of reviews) {
      if (!r.fecha || !r.score || !r.comuna || !r.edificio) continue
      const mes = r.fecha.slice(0, 7)
      if (!map[r.comuna]) map[r.comuna] = {}
      if (!map[r.comuna][r.edificio]) map[r.comuna][r.edificio] = {}
      if (!map[r.comuna][r.edificio][mes]) map[r.comuna][r.edificio][mes] = []
      map[r.comuna][r.edificio][mes].push(r.score)
    }
    return map
  }, [reviews])

  const comunas = COMUNAS_ORDEN.filter(c => byComuna[c])
  if (!comunas.length) return null

  const panels = comunas.map(comuna => {
    const edificios = Object.keys(byComuna[comuna]).sort()
    const mesesSet = new Set()
    edificios.forEach(ed => Object.keys(byComuna[comuna][ed]).forEach(m => mesesSet.add(m)))
    const meses = [...mesesSet].sort()

    const acumSum = {}; const acumCount = {}
    edificios.forEach(ed => { acumSum[ed] = 0; acumCount[ed] = 0 })

    const data = meses.map(mes => {
      const label = mes.replace(/^(\d{4})-(\d{2})$/, (_, y, m) => {
        const names = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
        return `${names[+m - 1]}-${y.slice(2)}`
      })
      const row = { mes: label }
      edificios.forEach(ed => {
        const scores = byComuna[comuna][ed][mes] ?? []
        acumSum[ed]   += scores.reduce((a, b) => a + b, 0)
        acumCount[ed] += scores.length
        if (acumCount[ed]) row[ed] = +(acumSum[ed] / acumCount[ed]).toFixed(2)
      })
      return row
    })
    return { comuna, edificios, data }
  })

  return (
    <div className="card card-full">
      <div ref={chartRef}>
        <div className="card-header">
          <div>
            <h2>Evolución Estrellas Edificios</h2>
            <p className="card-sub">Rating promedio acumulado por edificio y comuna</p>
          </div>
        </div>
        <div className="evol-est-grid">
          {panels.map(({ comuna, edificios, data }) => (
            <ComunaPanel
              key={comuna} comuna={comuna} data={data}
              edificios={edificios} colors={PALETTE} fontSize={fontSize}
            />
          ))}
        </div>
      </div>
      <ExportPanel chartRef={chartRef} chartName="evolucion-estrellas" fontSize={fontSize} onFontSizeChange={setFontSize} />
    </div>
  )
}
