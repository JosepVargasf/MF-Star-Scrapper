const ICONS = {
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="10" height="18" /><path d="M14 21V8h6v13" />
      <path d="M7 7h1M7 11h1M7 15h1M11 7h1M11 11h1M11 15h1" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  thumb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
}

export default function KpiCards({ metrics, reviews, selected, onToggle }) {
  const active = metrics.filter(m => selected.size === 0 || selected.has(m.edificio))
  const allEdificios = [...new Set(metrics.map(m => m.edificio))].sort()

  const totalReseñas = active.reduce((a, m) => a + (m.resenastot ?? 0), 0)
  const validRating  = active.filter(m => m.calif_actual != null)
  const ratingProm   = validRating.length
    ? (validRating.reduce((a, m) => a + m.calif_actual, 0) / validRating.length).toFixed(2)
    : '-'
  const validPos = active.filter(m => m.pos_pct != null)
  const posPct   = validPos.length
    ? (validPos.reduce((a, m) => a + m.pos_pct, 0) / validPos.length).toFixed(1)
    : '-'
  const nuevasMes  = active.reduce((a, m) => a + (m.nuevas_mes ?? 0), 0)

  return (
    <div className="kpi-section">
      <div className="kpi-filter">
        <span className="kpi-filter-label">Filtrar por proyecto</span>
        <div className="kpi-chips">
          <button
            className={`kpi-chip${selected.size === 0 ? ' active' : ''}`}
            onClick={() => onToggle(null)}
          >
            Todos
          </button>
          {allEdificios.map(ed => (
            <button
              key={ed}
              className={`kpi-chip${selected.has(ed) ? ' active' : ''}`}
              onClick={() => onToggle(ed)}
            >
              {ed}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-row" id="content-kpis">
        <KpiCard icon={ICONS.building} label="Proyectos"          value={active.length}                        suffix={`de ${metrics.length}`} />
        <KpiCard icon={ICONS.chat}     label="Reseñas totales"    value={totalReseñas.toLocaleString('es-CL')} />
        <KpiCard icon={ICONS.star}     label="Rating promedio"    value={ratingProm}                           suffix="/ 5" />
        <KpiCard icon={ICONS.thumb}    label="Sentimiento positivo" value={`${posPct}%`} />
        <KpiCard icon={ICONS.calendar} label="Reseñas este mes"   value={nuevasMes.toLocaleString('es-CL')} />
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, suffix }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">{icon}</span>
      <div className="kpi-body">
        <span className="kpi-value">
          {value}
          {suffix && <span className="kpi-suffix"> {suffix}</span>}
        </span>
        <span className="kpi-label">{label}</span>
      </div>
    </div>
  )
}
