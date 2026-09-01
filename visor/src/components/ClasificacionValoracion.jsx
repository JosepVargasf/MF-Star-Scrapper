import { useMemo, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import ExportPanel from './ExportPanel'

const COLOR_POS = '#96323C'
const COLOR_NEG = '#5B6670'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const pos = payload.find(p => p.dataKey === 'pct_pos')
  const neg = payload.find(p => p.dataKey === 'pct_neg')
  return (
    <div className="chart-tooltip">
      <p className="tt-title">{label}</p>
      {pos && <p className="tt-row"><span style={{ color: COLOR_POS }}>■ Positivo</span><strong>{pos.value}%</strong></p>}
      {neg && <p className="tt-row"><span style={{ color: COLOR_NEG }}>■ Negativo</span><strong>{neg.value}%</strong></p>}
    </div>
  )
}

export default function ClasificacionValoracion({ reviews }) {
  const [fontSize, setFontSize] = useState(11)
  const chartRef = useRef(null)
  const comunasOrden = ['Las Condes', 'Providencia', 'Ñuñoa', 'Santiago']

  const byComuna = useMemo(() => {
    const map = {}
    for (const r of reviews) {
      if (!r.sentimiento || !r.edificio || !r.comuna) continue
      if (!map[r.comuna]) map[r.comuna] = {}
      if (!map[r.comuna][r.edificio]) map[r.comuna][r.edificio] = { pos: 0, neg: 0 }
      if (r.sentimiento === 'Positiva') map[r.comuna][r.edificio].pos++
      else map[r.comuna][r.edificio].neg++
    }
    return map
  }, [reviews])

  const comunas = comunasOrden.filter(c => byComuna[c])
  if (!comunas.length) return null

  return (
    <div className="card card-full">
        <div className="card-header">
          <div>
            <h2>Clasificación Reseñas por Edificio</h2>
            <p className="card-sub">Porcentaje de reseñas positivas y negativas por edificio</p>
          </div>
        </div>

      <div ref={chartRef} id="content-clasificacion-valoracion">
        <div className="evol-legend">
          <span className="legend-dot" style={{ background: COLOR_POS }} />
          <span className="legend-label">Positivo</span>
          <span className="legend-dot" style={{ background: COLOR_NEG, marginLeft: 12 }} />
          <span className="legend-label">Negativo</span>
        </div>

        <div className="clasif-grid">
          {comunas.map(comuna => {
            const data = Object.entries(byComuna[comuna] || {}).map(([ed, { pos, neg }]) => {
              const total = pos + neg
              return { edificio: ed, pct_pos: total ? Math.round((pos / total) * 100) : 0, pct_neg: total ? Math.round((neg / total) * 100) : 0 }
            }).sort((a, b) => b.pct_pos - a.pct_pos)

            return (
              <div key={comuna} className="clasif-panel">
                <div className="clasif-panel-title">{comuna.toUpperCase()}</div>
                <ResponsiveContainer width="100%" height={Math.max(200, data.length * 70 + 40)}>
                  <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                      tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="edificio" width={130}
                      tick={{ fontSize, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="pct_pos" stackId="a" fill={COLOR_POS} radius={0}>
                      <LabelList dataKey="pct_pos" position="insideLeft"
                        style={{ fontSize, fontWeight: 700, fill: '#fff' }}
                        formatter={v => v > 8 ? `${v}%` : ''} />
                    </Bar>
                    <Bar dataKey="pct_neg" stackId="a" fill={COLOR_NEG} radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="pct_neg" position="insideRight"
                        style={{ fontSize, fontWeight: 700, fill: '#fff' }}
                        formatter={v => v > 5 ? `${v}%` : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      </div>
      <ExportPanel chartRef={chartRef} chartName="clasificacion-valoracion" title="Clasificación Reseñas por Edificio" fontSize={fontSize} onFontSizeChange={setFontSize} />
    </div>
  )
}
