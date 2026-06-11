import { useMemo, useRef } from 'react'
import ExportPanel from './ExportPanel'

const COMUNAS_ORDEN = ['Las Condes', 'Providencia', 'Ñuñoa', 'Santiago']

function ratingColor(v) {
  if (v == null) return '#94a3b8'
  if (v >= 4.5) return '#96323C'
  if (v >= 4.0) return '#C0848A'
  if (v >= 3.5) return '#A26579'
  return '#5B6670'
}

function sentColor(v) {
  if (v == null) return '#94a3b8'
  if (v >= 80) return '#16a34a'
  if (v >= 60) return '#ca8a04'
  return '#dc2626'
}

export default function ResumenComunas({ metrics, reviews }) {
  const chartRef = useRef(null)

  // Mapa edificio → comuna desde reviews
  const edificioComuna = useMemo(() => {
    const map = {}
    for (const r of reviews) if (r.edificio && r.comuna) map[r.edificio] = r.comuna
    return map
  }, [reviews])

  const comunas = useMemo(() => {
    const all = [...new Set(Object.values(edificioComuna).filter(Boolean))]
    const ordered = COMUNAS_ORDEN.filter(c => all.includes(c))
    const rest = all.filter(c => !COMUNAS_ORDEN.includes(c)).sort()
    return [...ordered, ...rest]
  }, [edificioComuna])

  // Mes más reciente en el dataset
  const lastMonth = useMemo(() => {
    return reviews.reduce((max, r) => r.fecha > max ? r.fecha : max, '').slice(0, 7)
  }, [reviews])

  const rows = useMemo(() => comunas.map(comuna => {
    // métricas de edificios que pertenecen a esta comuna
    const mets = metrics.filter(m => edificioComuna[m.edificio] === comuna)
    const edificios = [...new Set(mets.map(m => m.edificio))]

    const totalReseñas = mets.reduce((s, m) => s + (m.resenastot ?? 0), 0)

    const validRating = mets.filter(m => m.calif_actual != null)
    const rating = validRating.length
      ? validRating.reduce((s, m) => s + m.calif_actual, 0) / validRating.length
      : null

    const validPos = mets.filter(m => m.pos_pct != null)
    const posPct = validPos.length
      ? validPos.reduce((s, m) => s + m.pos_pct, 0) / validPos.length
      : null

    const resMes = lastMonth
      ? reviews.filter(r => r.comuna === comuna && r.fecha?.startsWith(lastMonth)).length
      : null

    return { comuna, edificios: edificios.length, totalReseñas, rating, posPct, resMes }
  }), [metrics, reviews, comunas, edificioComuna, lastMonth])

  if (!rows.length) return null

  return (
    <div className="card card-full" ref={chartRef}>
      <div className="card-header">
        <div>
          <h2>Resumen por comuna</h2>
          <p className="card-sub">Métricas agregadas por zona geográfica</p>
        </div>
      </div>

      <div className="rc-table-wrap">
        <table className="rc-table">
          <thead>
            <tr>
              <th className="rc-th rc-th-left">Comuna</th>
              <th className="rc-th">Proyectos</th>
              <th className="rc-th">Reseñas totales</th>
              <th className="rc-th">Rating promedio</th>
              <th className="rc-th">Sentimiento positivo</th>
              <th className="rc-th">Reseñas este mes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.comuna} className={i % 2 === 0 ? 'rc-row-even' : ''}>
                <td className="rc-td rc-td-comuna">
                  <div className="rc-comuna-dot" />
                  {row.comuna}
                </td>
                <td className="rc-td rc-td-center">
                  <span className="rc-badge">{row.edificios}</span>
                </td>
                <td className="rc-td rc-td-center rc-big">{row.totalReseñas.toLocaleString()}</td>
                <td className="rc-td rc-td-center">
                  {row.rating != null ? (
                    <span className="rc-rating" style={{ color: ratingColor(row.rating) }}>
                      ★ {row.rating.toFixed(2)}
                    </span>
                  ) : '—'}
                </td>
                <td className="rc-td rc-td-center">
                  {row.posPct != null ? (
                    <div className="rc-sent-wrap">
                      <div className="rc-sent-bar-bg">
                        <div
                          className="rc-sent-bar-fill"
                          style={{ width: `${row.posPct}%`, background: sentColor(row.posPct) }}
                        />
                      </div>
                      <span className="rc-sent-val" style={{ color: sentColor(row.posPct) }}>
                        {row.posPct.toFixed(1)}%
                      </span>
                    </div>
                  ) : '—'}
                </td>
                <td className="rc-td rc-td-center">
                  {row.resMes != null ? (
                    <span className={row.resMes > 0 ? 'rc-new' : 'rc-muted'}>{row.resMes}</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ExportPanel chartRef={chartRef} chartName="resumen-comunas" />
    </div>
  )
}
