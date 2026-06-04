import { useState, useMemo } from 'react'

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

function cellColor(val, max, sentimiento, field) {
  if (!val) return '#f8fafc'
  const intensity = val / max
  if (field === 'amenidades') {
    const b = Math.round(180 + intensity * 75)
    const rg = Math.round(240 - intensity * 120)
    return `rgb(${rg}, ${rg}, ${b})`
  }
  if (sentimiento === 'Positiva') {
    const g = Math.round(180 + intensity * 75)
    const rb = Math.round(240 - intensity * 120)
    return `rgb(${rb}, ${g}, ${rb})`
  } else {
    const r = Math.round(220 + intensity * 35)
    const gb = Math.round(230 - intensity * 130)
    return `rgb(${r}, ${gb}, ${gb})`
  }
}

export default function HeatmapTemas({ reviews }) {
  const [field, setField]   = useState('temas')       // 'temas' | 'amenidades'
  const [mode,  setMode]    = useState('Positiva')    // 'Positiva' | 'Negativa'

  const { edificios, temas, matrix, maxVal } = useMemo(
    () => buildMatrix(reviews, mode, field),
    [reviews, mode, field]
  )

  const legendColor = field === 'amenidades'
    ? 'linear-gradient(to right, #f8fafc, #2563eb)'
    : mode === 'Positiva'
      ? 'linear-gradient(to right, #f8fafc, #16a34a)'
      : 'linear-gradient(to right, #f8fafc, #dc2626)'

  return (
    <div className="card card-full">
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
    </div>
  )
}
