import { useState, useMemo } from 'react'

const TOP_N = 10

function buildMatrix(reviews, sentimiento) {
  const edificios = [...new Set(reviews.map(r => r.edificio))].sort()

  // Contar temas globalmente para elegir los top N
  const globalCount = {}
  for (const r of reviews) {
    if (r.sentimiento !== sentimiento) continue
    for (const t of r.temas ?? []) {
      if (t === 'Sin Comentario') continue
      globalCount[t] = (globalCount[t] ?? 0) + 1
    }
  }
  const topTemas = Object.entries(globalCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([t]) => t)

  // Construir matriz edificio × tema
  const matrix = {}
  for (const r of reviews) {
    if (r.sentimiento !== sentimiento) continue
    if (!matrix[r.edificio]) matrix[r.edificio] = {}
    for (const t of r.temas ?? []) {
      if (!topTemas.includes(t)) continue
      matrix[r.edificio][t] = (matrix[r.edificio][t] ?? 0) + 1
    }
  }

  const maxVal = Math.max(1, ...edificios.flatMap(ed =>
    topTemas.map(t => matrix[ed]?.[t] ?? 0)
  ))

  return { edificios, temas: topTemas, matrix, maxVal }
}

function cellColor(val, max, sentimiento) {
  if (!val) return '#f8fafc'
  const intensity = val / max
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
  const [mode, setMode] = useState('Positiva')

  const { edificios, temas, matrix, maxVal } = useMemo(
    () => buildMatrix(reviews, mode),
    [reviews, mode]
  )

  return (
    <div className="card card-full">
      <div className="card-header">
        <div>
          <h2>Heatmap de temas por edificio</h2>
          <p className="card-sub">Top {TOP_N} temas · intensidad = número de menciones</p>
        </div>
        <div className="tab-group">
          <button className={`tab${mode === 'Positiva' ? ' active' : ''}`} onClick={() => setMode('Positiva')}>👍 Positivos</button>
          <button className={`tab${mode === 'Negativa' ? ' active' : ''}`} onClick={() => setMode('Negativa')}>👎 Negativos</button>
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
            {edificios.map(ed => {
              const rowMax = Math.max(1, ...temas.map(t => matrix[ed]?.[t] ?? 0))
              const rowTotal = temas.reduce((s, t) => s + (matrix[ed]?.[t] ?? 0), 0)
              return (
                <tr key={ed}>
                  <td className="hm-td hm-td-edificio">{ed}</td>
                  {temas.map(t => {
                    const val = matrix[ed]?.[t] ?? 0
                    return (
                      <td
                        key={t}
                        className="hm-td hm-td-cell"
                        style={{ background: cellColor(val, maxVal, mode) }}
                        title={`${ed} · ${t}: ${val} menciones`}
                      >
                        {val > 0 ? val : ''}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="hm-legend">
        <span className="hm-leg-label">Menos menciones</span>
        <div className="hm-leg-gradient" style={{
          background: mode === 'Positiva'
            ? 'linear-gradient(to right, #f8fafc, #16a34a)'
            : 'linear-gradient(to right, #f8fafc, #dc2626)'
        }} />
        <span className="hm-leg-label">Más menciones</span>
      </div>
    </div>
  )
}
