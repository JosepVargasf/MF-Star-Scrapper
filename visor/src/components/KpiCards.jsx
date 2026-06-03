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
  const ratingColor = ratingProm >= 4 ? 'kpi-green' : ratingProm >= 3 ? 'kpi-amber' : 'kpi-red'

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

      <div className="kpi-row">
        <KpiCard icon="🏢" label="Proyectos"          value={active.length}                        suffix={`de ${metrics.length}`} color="kpi-blue" />
        <KpiCard icon="💬" label="Reseñas totales"    value={totalReseñas.toLocaleString('es-CL')}                                 color="kpi-indigo" />
        <KpiCard icon="⭐" label="Rating promedio"    value={ratingProm}                           suffix="/ 5"                    color={ratingColor} highlight />
        <KpiCard icon="👍" label="Sentimiento positivo" value={`${posPct}%`}                                                       color="kpi-green" />
        <KpiCard icon="📅" label="Reseñas este mes"  value={nuevasMes.toLocaleString('es-CL')}                                    color="kpi-purple" />
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, suffix, color, highlight }) {
  return (
    <div className={`kpi-card ${color}${highlight ? ' kpi-highlight' : ''}`}>
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
