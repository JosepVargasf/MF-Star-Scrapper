import { useState, useMemo, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import MonthRangePicker from './MonthRangePicker'
import ExportPanel from './ExportPanel'

const PALETTE = [
  '#96323C','#5B6670','#A26579','#2D3334','#D7A1A7',
  '#51313C','#800000','#70262D','#444C54','#7A4C5B',
  '#C0848A','#BDC2C6','#DAC1C9','#3D252D','#9DA3A9',
]

function hexOpacity(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${alpha})`
}

function CustomTooltip({ active, payload, label }) {
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
          <div className="tt-ed-name"><span className="tt-dot" style={{ background: v.color }} />{ed}</div>
          <div className="tt-ed-vals">
            <span className="tt-pos-val">👍 {v.pos}</span>
            <span className="tt-neg-val">👎 {v.neg}</span>
            <span className="tt-tot-val">= {v.pos + v.neg}</span>
          </div>
        </div>
      ))}
      <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>Doble clic para ver detalle diario</p>
    </div>
  )
}

function DrillTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const pos = payload.find(p => p.dataKey === 'pos')?.value ?? 0
  const neg = payload.find(p => p.dataKey === 'neg')?.value ?? 0
  return (
    <div className="chart-tooltip">
      <p className="tt-title">Día {label}</p>
      <div className="tt-ed-vals">
        <span className="tt-pos-val">👍 {pos}</span>
        <span className="tt-neg-val">👎 {neg}</span>
        <span className="tt-tot-val">= {pos + neg}</span>
      </div>
    </div>
  )
}

function DrillDown({ mes, edificio, color, reviews, onBack, fontSize }) {
  const data = useMemo(() => {
    const filtered = reviews.filter(r =>
      r.fecha?.slice(0, 7) === mes &&
      (edificio === '__todos__' || r.edificio === edificio)
    )
    const byDay = {}
    for (const r of filtered) {
      const day = r.fecha?.slice(8, 10)
      if (!day) continue
      if (!byDay[day]) byDay[day] = { dia: day, pos: 0, neg: 0 }
      if (r.sentimiento === 'Positiva') byDay[day].pos++
      else if (r.sentimiento === 'Negativa') byDay[day].neg++
    }
    return Object.values(byDay).sort((a, b) => a.dia.localeCompare(b.dia))
  }, [mes, edificio, reviews])

  const titulo = edificio === '__todos__' ? `Todos los edificios — ${mes}` : `${edificio} — ${mes}`

  return (
    <div className="card card-full">
      <div className="card-header">
        <div>
          <button className="drill-back" onClick={onBack}>← Volver</button>
          <h2 style={{ marginTop: 8 }}>Distribución diaria</h2>
          <p className="card-sub">{titulo}</p>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="empty">Sin reseñas para este período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip content={<DrillTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="pos" stackId="a" fill={color} maxBarSize={32} />
            <Bar dataKey="neg" stackId="a" fill={hexOpacity(color, 0.35)} radius={[3,3,0,0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function VolumenReseñas({ reviews }) {
  const allEdificios = [...new Set(reviews.map(r => r.edificio))].sort()
  const [selectedEds, setSelectedEds] = useState(new Set(allEdificios.slice(0, 5)))
  const [drill, setDrill]   = useState(null)
  const [fontSize, setFontSize] = useState(11)
  const chartRef = useRef(null)

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
        const edMes = reviews.filter(r => r.edificio === ed && r.fecha?.slice(0, 7) === mes)
        row[`${ed}||pos`] = edMes.filter(r => r.sentimiento === 'Positiva').length
        row[`${ed}||neg`] = edMes.filter(r => r.sentimiento === 'Negativa').length
      }
      return row
    })
  }, [reviews, activeEds, availableMonths, range])

  if (drill) {
    return (
      <DrillDown
        mes={drill.mes} edificio={drill.edificio} color={drill.color}
        reviews={reviews} onBack={() => setDrill(null)} fontSize={fontSize}
      />
    )
  }

  return (
    <div className="card card-full">
      <div ref={chartRef}>
        <div className="card-header">
          <div>
            <h2>Volumen de Reseñas por Mes</h2>
            <p className="card-sub">Reseñas positivas y negativas por edificio · doble clic para ver detalle diario</p>
          </div>
          <MonthRangePicker value={range} onChange={setRange} availableMonths={availableMonths} />
        </div>

        <div className="vr-filter">
          <button
            className={`kpi-chip${selectedEds.size === allEdificios.length ? ' active' : ''}`}
            onClick={() => setSelectedEds(selectedEds.size === allEdificios.length ? new Set() : new Set(allEdificios))}
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
          <ResponsiveContainer width="100%" height={Math.max(320, activeEds.length * 28)}>
            <BarChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              {activeEds.map((ed) => {
                const color = PALETTE[allEdificios.indexOf(ed) % PALETTE.length]
                const colorIdx = allEdificios.indexOf(ed)
                return [
                  <Bar key={`${ed}-pos`} dataKey={`${ed}||pos`} stackId={ed}
                    fill={color} maxBarSize={24}
                    onDoubleClick={(rowData) => { if (rowData?.mes) setDrill({ mes: rowData.mes, edificio: ed, color: PALETTE[colorIdx % PALETTE.length] }) }}
                    style={{ cursor: 'pointer' }}
                  />,
                  <Bar key={`${ed}-neg`} dataKey={`${ed}||neg`} stackId={ed}
                    fill={hexOpacity(color, 0.35)} radius={[3,3,0,0]} maxBarSize={24}
                    onDoubleClick={(rowData) => { if (rowData?.mes) setDrill({ mes: rowData.mes, edificio: ed, color: PALETTE[colorIdx % PALETTE.length] }) }}
                    style={{ cursor: 'pointer' }}
                  />,
                ]
              })}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <ExportPanel chartRef={chartRef} chartName="volumen-resenias" fontSize={fontSize} onFontSizeChange={setFontSize} />
    </div>
  )
}
