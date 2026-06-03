import { useState } from 'react'
import ReviewModal from './ReviewModal'

const TEMA_COLORS = ['#6366f1','#10b981','#f59e0b','#0ea5e9','#a855f7','#ec4899','#14b8a6','#f97316','#84cc16','#ef4444']

export default function KeywordsCategorias({ reviews }) {
  const edificios = [...new Set(reviews.map(r => r.edificio))].sort()
  const [edificio, setEdificio] = useState('todos')
  const [view, setView] = useState('temas')
  const [modal, setModal] = useState(null)

  const filtered = edificio === 'todos' ? reviews : reviews.filter(r => r.edificio === edificio)

  // Contar por reseña (no por mención) para evitar doble conteo
  const counts = {}
  for (const r of filtered) {
    const temas = [...new Set(r[view] ?? [])] // deduplicar temas por reseña
    for (const item of temas) {
      if (item === 'Sin Comentario') continue
      if (!counts[item]) counts[item] = { pos: 0, neg: 0, total: 0 }
      counts[item].total++
      if (r.sentimiento === 'Positiva') counts[item].pos++
      if (r.sentimiento === 'Negativa') counts[item].neg++
    }
  }

  const items = Object.entries(counts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 12)
    .map(([tema, c], i) => ({ tema, ...c, color: TEMA_COLORS[i % TEMA_COLORS.length] }))

  const maxTotal = items[0]?.total ?? 1

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Temas más relevantes</h2>
          <p className="card-sub">Menciones por reseña · doble clic para leer</p>
        </div>
        <div className="tab-group">
          <button className={`tab${view === 'temas' ? ' active' : ''}`} onClick={() => setView('temas')}>Temas</button>
          <button className={`tab${view === 'amenidades' ? ' active' : ''}`} onClick={() => setView('amenidades')}>Amenidades</button>
        </div>
      </div>

      <select value={edificio} onChange={e => setEdificio(e.target.value)} className="select">
        <option value="todos">Todos los edificios</option>
        {edificios.map(ed => <option key={ed} value={ed}>{ed}</option>)}
      </select>

      {items.length === 0 ? (
        <p className="empty">Sin datos.</p>
      ) : (
        <>
          <div className="kt-legend-row">
            <span className="kt-leg"><span className="kt-leg-dot" style={{background:'#10b981'}}/>Positivas</span>
            <span className="kt-leg"><span className="kt-leg-dot" style={{background:'#ef4444'}}/>Negativas</span>
            <span className="kt-leg"><span className="kt-leg-dot" style={{background:'#e2e8f0'}}/>Neutras</span>
          </div>
          <div className="kt-list">
            <div className="kt-header-row">
              <span className="kt-h-tema">Tema</span>
              <span className="kt-h-bar" />
              <span className="kt-h-pos">👍</span>
              <span className="kt-h-neg">👎</span>
              <span className="kt-h-n">Total</span>
            </div>
          {items.map((item) => (
            <div
              key={item.tema}
              className="kt-row"
              onDoubleClick={() => setModal(item)}
              title="Doble clic para ver reseñas"
            >
              <span className="kt-label">{item.tema}</span>

              <div className="kt-stacked">
                <div className="kt-seg kt-pos" style={{ width: `${item.total ? (item.pos / item.total) * 100 : 0}%` }} />
                <div className="kt-seg kt-neg" style={{ width: `${item.total ? (item.neg / item.total) * 100 : 0}%` }} />
              </div>

              <span className="kt-pos-n">{item.pos}</span>
              <span className="kt-neg-n">{item.neg}</span>
              <span className="kt-total">{item.total}</span>
            </div>
          ))}
          </div>
        </>
      )}

      {modal && (
        <ReviewModal
          reviews={reviews}
          tema={modal.tema}
          sentimiento={null}
          edificio={edificio}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
