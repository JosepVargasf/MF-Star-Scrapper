import { useEffect } from 'react'

const STARS = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))

const SENTIMENT_STYLE = {
  'Positiva': { bg: '#f0fdf4', color: '#166534', label: '👍 Positiva' },
  'Negativa': { bg: '#fff1f2', color: '#991b1b', label: '👎 Negativa' },
  'Neutra':   { bg: '#fefce8', color: '#854d0e', label: '😐 Neutra'   },
}

function Avatar({ name }) {
  const initials = name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const hue = (name?.charCodeAt(0) ?? 0) * 37 % 360
  return (
    <div className="rm-avatar" style={{ background: `hsl(${hue}, 55%, 55%)` }}>
      {initials}
    </div>
  )
}

export default function ReviewModal({ reviews, tema, sentimiento, edificio, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = reviews
    .filter(r => {
      if (edificio && edificio !== 'todos' && r.edificio !== edificio) return false
      if (sentimiento && r.sentimiento !== sentimiento) return false
      return [...(r.temas ?? []), ...(r.amenidades ?? [])].includes(tema)
    })
    .sort((a, b) => b.fecha?.localeCompare(a.fecha))

  const sStyle = SENTIMENT_STYLE[sentimiento] ?? SENTIMENT_STYLE['Neutra']

  return (
    <div className="rm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rm-panel">
        <div className="rm-header">
          <div className="rm-header-left">
            <div className="rm-badge" style={{ background: sStyle.bg, color: sStyle.color }}>
              {sStyle.label}
            </div>
            <div>
              <h2 className="rm-title">"{tema}"</h2>
              <p className="rm-sub">{filtered.length} reseña{filtered.length !== 1 ? 's' : ''} · {(!edificio || edificio === 'todos') ? 'Todos los edificios' : edificio}</p>
            </div>
          </div>
          <button className="rm-close" onClick={onClose}>✕</button>
        </div>

        <div className="rm-list">
          {filtered.length === 0 && (
            <p className="empty">No hay reseñas con texto para este tema.</p>
          )}
          {filtered.map((r, i) => (
            <div key={i} className="rm-card">
              <div className="rm-card-top">
                <Avatar name={r.usuario} />
                <div className="rm-user-info">
                  <span className="rm-user-name">{r.usuario}</span>
                  <span className="rm-user-meta">{r.fecha}</span>
                </div>
                <div className="rm-score-block">
                  <span className="rm-stars" style={{ color: r.score >= 4 ? '#f59e0b' : r.score >= 3 ? '#94a3b8' : '#ef4444' }}>
                    {STARS(r.score)}
                  </span>
                  <span className="rm-score-num">{r.score?.toFixed(1)}</span>
                </div>
              </div>

              {r.texto ? (
                <p className="rm-text">"{r.texto}"</p>
              ) : (
                <p className="rm-text rm-text-empty">Sin comentario escrito.</p>
              )}

              {r.temas?.length > 0 && (
                <div className="rm-tags">
                  {r.temas.filter(t => t !== 'Sin Comentario').map(t => (
                    <span key={t} className={`rm-tag${t === tema ? ' rm-tag-active' : ''}`}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
