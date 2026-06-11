import { useState, useMemo, useRef } from 'react'
import ReviewModal from './ReviewModal'
import MonthRangePicker from './MonthRangePicker'
import ExportPanel from './ExportPanel'

function BarList({ items, color, empty, onDoubleClick }) {
  if (!items.length) return <p className="empty">{empty}</p>
  const max = items[0][1]
  return (
    <div className="bl-table">
      <div className="bl-header">
        <span className="bl-h-rank">#</span>
        <span className="bl-h-tema">Tema</span>
        <span className="bl-h-bar" />
        <span className="bl-h-n">Mencs.</span>
      </div>
      {items.map(([tema, count], i) => (
        <div
          key={tema}
          className="bl-row"
          onDoubleClick={() => onDoubleClick(tema)}
          title="Doble clic para leer reseñas"
        >
          <span className="bl-rank">#{i + 1}</span>
          <span className="bl-label" title={tema}>{tema}</span>
          <div className="bl-bar-wrap">
            <div className="bl-bar" style={{ width: `${(count / max) * 100}%`, background: color }} />
          </div>
          <span className="bl-count">{count}</span>
        </div>
      ))}
    </div>
  )
}

export default function SentimientoTemas({ reviews }) {
  const edificios = [...new Set(reviews.map(r => r.edificio))].sort()
  const [edificio, setEdificio] = useState(edificios[0] ?? '')

  const availableMonths = useMemo(() => {
    const set = new Set(
      reviews
        .filter(r => r.edificio === edificio && r.fecha)
        .map(r => r.fecha.slice(0, 7))
    )
    return [...set].sort()
  }, [reviews, edificio])

  const [range, setRange] = useState(() => ({
    from: availableMonths[0] ?? '',
    to:   availableMonths[availableMonths.length - 1] ?? '',
  }))

  // Resetear rango cuando cambia el edificio
  function handleEdificioChange(ed) {
    setEdificio(ed)
    const months = [...new Set(
      reviews.filter(r => r.edificio === ed && r.fecha).map(r => r.fecha.slice(0, 7))
    )].sort()
    setRange({ from: months[0] ?? '', to: months[months.length - 1] ?? '' })
  }

  const filtered = useMemo(() => reviews.filter(r => {
    if (r.edificio !== edificio) return false
    if (!r.fecha) return false
    const mes = r.fecha.slice(0, 7)
    return mes >= range.from && mes <= range.to
  }), [reviews, edificio, range])

  function topTemas(sentimiento) {
    const counts = {}
    for (const r of filtered) {
      if (r.sentimiento !== sentimiento) continue
      for (const t of r.temas ?? []) {
        if (t === 'Sin Comentario') continue
        counts[t] = (counts[t] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }

  const positivos = topTemas('Positiva')
  const negativos = topTemas('Negativa')

  const totalPos = filtered.filter(r => r.sentimiento === 'Positiva').length
  const totalNeg = filtered.filter(r => r.sentimiento === 'Negativa').length
  const total    = filtered.length || 1
  const posPct   = Math.round((totalPos / total) * 100)
  const negPct   = Math.round((totalNeg / total) * 100)

  const [modal, setModal] = useState(null)
  const chartRef = useRef(null)

  const rangeLabel = range.from === range.to
    ? range.from
    : `${range.from} → ${range.to}`

  return (
    <div className="card card-full">
      <div ref={chartRef}>
      <div className="card-header">
        <div>
          <h2>¿Por qué los clientes califican así?</h2>
          <p className="card-sub">Temas que explican el sentimiento · <strong>Doble clic</strong> para leer las reseñas</p>
        </div>
      </div>

      <div className="sentemas-filters">
        <select value={edificio} onChange={e => handleEdificioChange(e.target.value)} className="select" style={{ marginBottom: 0, flex: 1 }}>
          {edificios.map(ed => <option key={ed} value={ed}>{ed}</option>)}
        </select>
        <MonthRangePicker
          value={range}
          onChange={setRange}
          availableMonths={availableMonths}
        />
      </div>

      <div className="sentemas-summary">
        <span className="summary-range">📅 {rangeLabel}</span>
        <span className="summary-count">{filtered.length} reseñas</span>
      </div>

      <div className="sentemas-scorebar">
        <div className="scorebar-track">
          <div className="scorebar-fill green" style={{ width: `${posPct}%` }} />
          <div className="scorebar-fill red"   style={{ width: `${negPct}%` }} />
        </div>
        <div className="scorebar-labels">
          <span className="label-green">👍 {totalPos} positivas ({posPct}%)</span>
          <span className="label-red">👎 {totalNeg} negativas ({negPct}%)</span>
        </div>
      </div>

      <div className="sentemas-cols">
        <div className="sentemas-col">
          <div className="col-header green-header">
            <span className="col-badge green-badge">✓</span>
            <div>
              <h3>Qué valoran positivamente</h3>
              <p>Temas frecuentes en reseñas positivas</p>
            </div>
          </div>
          <BarList items={positivos} color="#96323C" empty="Sin temas positivos en el período." onDoubleClick={tema => setModal({ tema, sentimiento: 'Positiva' })} />
        </div>

        <div className="sentemas-divider" />

        <div className="sentemas-col">
          <div className="col-header red-header">
            <span className="col-badge red-badge">✗</span>
            <div>
              <h3>Qué genera insatisfacción</h3>
              <p>Temas frecuentes en reseñas negativas</p>
            </div>
          </div>
          <BarList items={negativos} color="#5B6670" empty="Sin temas negativos en el período." onDoubleClick={tema => setModal({ tema, sentimiento: 'Negativa' })} />
        </div>
      </div>

      </div>
      <ExportPanel chartRef={chartRef} chartName="sentimiento-temas" />
      {modal && (
        <ReviewModal
          reviews={filtered}
          tema={modal.tema}
          sentimiento={modal.sentimiento}
          edificio={edificio}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
