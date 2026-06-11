import { useMemo, useRef, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ExportPanel from './ExportPanel'

const PALETTE = ['#96323C','#2D3334','#D7A1A7','#5B6670','#800000','#A26579','#51313C','#70262D','#444C54','#7A4C5B','#C0848A','#BDC1C5','#E8C4C7','#3A4A52','#6B3040']

const GENDER_COLORS = { female: '#A26579', male: '#5B6670', otros: '#BDC1C5' }

function DonutChart({ data, title, centerLabel, fontSize, overlayLeft = '38%' }) {
  const RADIAN = Math.PI / 180
  function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
    if (percent < 0.03) return null
    const r = innerRadius + (outerRadius - innerRadius) * 0.55
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
        fontSize={fontSize} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="tr-panel">
      <div className="tr-panel-title">{title}</div>
      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="45%"
              cy="50%"
              innerRadius="40%"
              outerRadius="65%"
              dataKey="value"
              labelLine={false}
              label={renderLabel}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} menciones`, name]}
              contentStyle={{ fontSize: fontSize - 1, borderRadius: 6, border: '1px solid #e2e8f0' }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="square"
              iconSize={10}
              wrapperStyle={{ fontSize: fontSize - 1, paddingLeft: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centro del donut: pie cx=40%, cy=50% de 300px → left=40%, top=150px */}
        <div style={{
          position: 'absolute',
          left: overlayLeft,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          fontSize: fontSize + 1,
          fontWeight: 800,
          color: '#2D3334',
          textAlign: 'center',
          lineHeight: 1,
        }}>
          {centerLabel}
        </div>
      </div>
    </div>
  )
}

function GenderDonut({ reviews, fontSize, overlayLeft = '40%' }) {
  const counts = useMemo(() => {
    let female = 0, male = 0, otros = 0
    for (const r of reviews) {
      const s = r.sexo || ''
      if (s === 'female' || s === 'mostly_female') female++
      else if (s === 'male' || s === 'mostly_male') male++
      else otros++
    }
    return { female, male, otros }
  }, [reviews])

  const total = counts.female + counts.male + counts.otros || 1
  const data = [
    { name: '♀ Mujer',    value: counts.female },
    { name: '♂ Hombre',   value: counts.male },
    { name: 'Sin clasificar', value: counts.otros },
  ].filter(d => d.value > 0)

  const RADIAN = Math.PI / 180
  function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
    if (percent < 0.03) return null
    const r = innerRadius + (outerRadius - innerRadius) * 0.55
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
        fontSize={fontSize} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const COLORS = [GENDER_COLORS.female, GENDER_COLORS.male, GENDER_COLORS.otros]

  return (
    <div className="tr-panel">
      <div className="tr-panel-title">Proporción general por género</div>
      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="40%"
              cy="50%"
              innerRadius="40%"
              outerRadius="65%"
              dataKey="value"
              labelLine={false}
              label={renderLabel}
            >
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} reseñas (${((value/total)*100).toFixed(1)}%)`, name]}
              contentStyle={{ fontSize: fontSize - 1, borderRadius: 6, border: '1px solid #e2e8f0' }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="square"
              iconSize={10}
              wrapperStyle={{ fontSize: fontSize - 1, paddingLeft: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute',
          left: overlayLeft,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          textAlign: 'center',
          lineHeight: 1.2,
        }}>
          <div style={{ fontSize: fontSize + 4, fontWeight: 800, color: '#2D3334' }}>{reviews.length}</div>
          <div style={{ fontSize: fontSize - 1, color: '#5B6670' }}>reseñas</div>
        </div>
      </div>
    </div>
  )
}

export default function TiposReseñas({ reviews }) {
  const [fontSize, setFontSize] = useState(11)
  const chartRef = useRef(null)

  const temasPos = useMemo(() => {
    const counts = {}
    for (const r of reviews) {
      if (r.sentimiento !== 'Positiva') continue
      for (const t of r.temas ?? []) {
        if (t === 'Sin Comentario') continue
        counts[t] = (counts[t] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [reviews])

  const temasNeg = useMemo(() => {
    const counts = {}
    for (const r of reviews) {
      if (r.sentimiento !== 'Negativa') continue
      for (const t of r.temas ?? []) {
        if (t === 'Sin Comentario') continue
        counts[t] = (counts[t] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [reviews])

  const amenidades = useMemo(() => {
    const counts = {}
    for (const r of reviews) {
      for (const a of r.amenidades ?? []) {
        if (a === 'Sin Comentario') continue
        counts[a] = (counts[a] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [reviews])

  const totalPos = temasPos.reduce((s, d) => s + d.value, 0)
  const totalNeg = temasNeg.reduce((s, d) => s + d.value, 0)

  if (!temasPos.length && !temasNeg.length) return null

  return (
    <div className="card card-full">
      <div ref={chartRef}>
        <div className="card-header">
          <div>
            <h2>Tipo de Reseñas Realizadas</h2>
            <p className="card-sub">Distribución de temas mencionados en reseñas positivas y negativas · Amenidades · Género</p>
          </div>
        </div>

        <div className="tr-grid">
          {temasPos.length > 0 && (
            <DonutChart
              data={temasPos}
              title="👍 POSITIVAS"
              centerLabel="POSITIVAS"
              fontSize={fontSize}
              overlayLeft="38%"
            />
          )}
          {temasNeg.length > 0 && (
            <DonutChart
              data={temasNeg}
              title="👎 NEGATIVAS"
              centerLabel="NEGATIVAS"
              fontSize={fontSize}
              overlayLeft="39%"
            />
          )}
          {amenidades.length > 0 && (
            <DonutChart
              data={amenidades}
              title="🏢 AMENIDADES"
              centerLabel="AMENIDADES"
              fontSize={fontSize}
              overlayLeft="41%"
            />
          )}
          <GenderDonut reviews={reviews} fontSize={fontSize} overlayLeft="36%" />
        </div>

        <p className="tr-source">Fuente: Google Reviews</p>
      </div>
      <ExportPanel chartRef={chartRef} chartName="tipos-reseñas" fontSize={fontSize} onFontSizeChange={setFontSize} />
    </div>
  )
}
