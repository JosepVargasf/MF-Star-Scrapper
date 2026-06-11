import { useState, useMemo, useRef } from 'react'
import ExportPanel from './ExportPanel'

const TOP_N = 10

function buildMatrix(reviews, sentimiento, field) {
  const edificios = [...new Set(reviews.map(r => r.edificio))].sort()

  const globalCount = {}
  for (const r of reviews) {
    if (field === 'temas' && r.sentimiento !== sentimiento) continue
    for (const t of r[field] ?? []) {
      if (t === 'Sin Comentario') continue
      globalCount[t] = (globalCount[t] ?? 0) + 1
    }
  }

  const topItems = Object.entries(globalCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([t]) => t)

  const matrix = {}
  for (const r of reviews) {
    if (field === 'temas' && r.sentimiento !== sentimiento) continue
    if (!matrix[r.edificio]) matrix[r.edificio] = {}
    for (const t of r[field] ?? []) {
      if (!topItems.includes(t)) continue
      matrix[r.edificio][t] = (matrix[r.edificio][t] ?? 0) + 1
    }
  }

  const maxVal = Math.max(1, ...edificios.flatMap(ed =>
    topItems.map(t => matrix[ed]?.[t] ?? 0)
  ))

  return { edificios, temas: topItems, matrix, maxVal }
}

// Interpola entre blanco (#f8fafc) y el color destino según intensidad
function lerpHex(from, to, t) {
  const f = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
  const [r1,g1,b1] = f(from); const [r2,g2,b2] = f(to)
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`
}

function cellColor(val, max, sentimiento, field) {
  if (!val) return '#f8fafc'
  const intensity = val / max
  if (field === 'amenidades') return lerpHex('#f8fafc', '#5B6670', intensity)
  return sentimiento === 'Positiva'
    ? lerpHex('#f8fafc', '#96323C', intensity)
    : lerpHex('#f8fafc', '#2D3334', intensity)
}

export default function HeatmapTemas({ reviews }) {
  const [field, setField]   = useState('temas')
  const [mode,  setMode]    = useState('Positiva')
  const chartRef = useRef(null)

  const { edificios, temas, matrix, maxVal } = useMemo(
    () => buildMatrix(reviews, mode, field),
    [reviews, mode, field]
  )

  const legendColor = field === 'amenidades'
    ? 'linear-gradient(to right, #f8fafc, #5B6670)'
    : mode === 'Positiva'
      ? 'linear-gradient(to right, #f8fafc, #96323C)'
      : 'linear-gradient(to right, #f8fafc, #2D3334)'

  return (
    <div className="card card-full" ref={chartRef}>
      <div className="card-header">
        <div>
          <h2>Heatmap por edificio</h2>
          <p className="card-sub">
            Top {TOP_N} {field === 'temas' ? `temas ${mode === 'Positiva' ? 'positivos' : 'negativos'}` : 'amenidades'} · intensidad = número de menciones
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {field === 'temas' && (
            <div className="tab-group">
              <button className={`tab${mode === 'Positiva' ? ' active' : ''}`} onClick={() => setMode('Positiva')}>👍 Positivos</button>
              <button className={`tab${mode === 'Negativa' ? ' active' : ''}`} onClick={() => setMode('Negativa')}>👎 Negativos</button>
            </div>
          )}
          <div className="tab-group">
            <button className={`tab${field === 'temas'      ? ' active' : ''}`} onClick={() => setField('temas')}>Temas</button>
            <button className={`tab${field === 'amenidades' ? ' active' : ''}`} onClick={() => setField('amenidades')}>Amenidades</button>
          </div>
        </div>
      </div>

      <div className="hm-wrap">
        <table className="hm-table">
          <thead>
            <tr>
              <th className="hm-th hm-th-edificio">Edificio</th>
              {temas.map(t => (
                <th key={t} className="hm-th hm-th-tema">
                  <div className="hm-tema-label">{t}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {edificios.map(ed => (
              <tr key={ed}>
                <td className="hm-td hm-td-edificio">{ed}</td>
                {temas.map(t => {
                  const val = matrix[ed]?.[t] ?? 0
                  return (
                    <td
                      key={t}
                      className="hm-td hm-td-cell"
                      style={{ background: cellColor(val, maxVal, mode, field) }}
                      title={`${ed} · ${t}: ${val} menciones`}
                    >
                      {val > 0 ? val : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hm-legend">
        <span className="hm-leg-label">Menos menciones</span>
        <div className="hm-leg-gradient" style={{ background: legendColor }} />
        <span className="hm-leg-label">Más menciones</span>
      </div>
      <ExportPanel chartRef={chartRef} chartName="heatmap-temas" />
    </div>
  )
}
