import { useState, useMemo } from 'react'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import { useData } from './hooks/useData'
import KpiCards from './components/KpiCards'
import RankingEdificios from './components/RankingEdificios'
import EvolucionMensual from './components/EvolucionMensual'
import DistribucionEstrellas from './components/DistribucionEstrellas'
import KeywordsCategorias from './components/KeywordsCategorias'
import SentimientoTemas from './components/SentimientoTemas'
import VolumenReseñas from './components/VolumenReseñas'
import TemasGenero from './components/TemasGenero'
import HeatmapTemas from './components/HeatmapTemas'
import MetricasDetalladas from './components/MetricasDetalladas'
import ClasificacionValoracion from './components/ClasificacionValoracion'
import EvolucionEstrellas from './components/EvolucionEstrellas'
import TiposReseñas from './components/TiposReseñas'
import CategoriasPorEdificio from './components/CategoriasPorEdificio'
import ResumenComunas from './components/ResumenComunas'
import './App.css'

export default function App() {
  const { user, error: authError, login, logout } = useAuth()
  if (user === undefined) return <div className="splash"><div className="spinner" /></div>
  if (!user) return <LoginScreen onLogin={login} error={authError} />
  return <Dashboard user={user} onLogout={logout} />
}

function Dashboard({ user, onLogout }) {
  const { metrics, reviews, loading, error, comunas, operadores } = useData()
  const [selectedProjects, setSelectedProjects] = useState(new Set())
  const [filterComuna,     setFilterComuna]     = useState('todas')
  const [filterOperador,   setFilterOperador]   = useState('todos')

  // Todos los hooks ANTES de cualquier return condicional
  const edificiosActivos = useMemo(() => new Set(
    reviews
      .filter(r =>
        (filterComuna   === 'todas' || r.comuna   === filterComuna) &&
        (filterOperador === 'todos' || r.operador === filterOperador)
      )
      .map(r => r.edificio)
  ), [reviews, filterComuna, filterOperador])

  const reviewsFiltradas = useMemo(() =>
    reviews.filter(r => edificiosActivos.has(r.edificio))
  , [reviews, edificiosActivos])

  const metricsFiltradas = useMemo(() =>
    metrics.filter(m => edificiosActivos.has(m.edificio))
  , [metrics, edificiosActivos])

  const lastUpdate = useMemo(() => {
    const iso = reviews.reduce((max, r) => r.fecha > max ? r.fecha : max, '')
    if (!iso) return ''
    const [y, m, d] = iso.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
  }, [reviews])

  if (loading) return <div className="splash"><div className="spinner" /><p>Cargando datos...</p></div>
  if (error)   return <div className="splash error">Error al cargar datos: {String(error)}</div>

  function handleToggle(ed) {
    if (ed === null) { setSelectedProjects(new Set()); return }
    setSelectedProjects(prev => {
      const next = new Set(prev)
      next.has(ed) ? next.delete(ed) : next.add(ed)
      return next
    })
  }

  const hasFilter = filterComuna !== 'todas' || filterOperador !== 'todos'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">★</div>
          <div>
            <div className="brand-name">MF Star</div>
            <div className="brand-sub">Reseñas multifamily</div>
          </div>
        </div>
        <nav className="nav">
          <a href="#kpis"         className="nav-item"><span className="nav-icon" />Resumen</a>
          <a href="#resumen-comunas" className="nav-item"><span className="nav-icon" />Comunas</a>
          <a href="#ranking"      className="nav-item"><span className="nav-icon" />Ranking</a>
          <a href="#metricas"     className="nav-item"><span className="nav-icon" />Métricas</a>
          <a href="#volumen"      className="nav-item"><span className="nav-icon" />Volumen</a>
          <a href="#evolucion"    className="nav-item"><span className="nav-icon" />Evolución</a>
          <a href="#tipos"        className="nav-item"><span className="nav-icon" />Tipos</a>
          <a href="#categorias"   className="nav-item"><span className="nav-icon" />Categorías</a>
          <a href="#causas"       className="nav-item"><span className="nav-icon" />Causas</a>
          <a href="#temasgenero"  className="nav-item"><span className="nav-icon" />Género</a>
          <a href="#clasifval"    className="nav-item"><span className="nav-icon" />Valoración</a>
          <a href="#evolestrellas" className="nav-item"><span className="nav-icon" />Estrellas</a>
          <a href="#heatmap"      className="nav-item"><span className="nav-icon" />Heatmap</a>
          <a href="#distribucion" className="nav-item"><span className="nav-icon" />Distribución</a>
          <a href="#temas"        className="nav-item"><span className="nav-icon" />Temas</a>
        </nav>
        <div className="sidebar-footer">
          {lastUpdate && <>
            <p className="footer-label">Última actualización</p>
            <p className="footer-date">{lastUpdate}</p>
          </>}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h1>Análisis de Reseñas</h1>
            <p>Opinión de arrendatarios · Edificios multifamily · Chile</p>
          </div>

          <div className="topbar-filters">
            <select
              className="topbar-select"
              value={filterComuna}
              onChange={e => { setFilterComuna(e.target.value); setSelectedProjects(new Set()) }}
            >
              <option value="todas">Todas las comunas</option>
              {comunas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="topbar-select"
              value={filterOperador}
              onChange={e => { setFilterOperador(e.target.value); setSelectedProjects(new Set()) }}
            >
              <option value="todos">Todos los operadores</option>
              {operadores.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {hasFilter && (
              <button className="topbar-clear" onClick={() => { setFilterComuna('todas'); setFilterOperador('todos'); setSelectedProjects(new Set()) }}>
                ✕ Limpiar
              </button>
            )}
          </div>

          {lastUpdate && <div className="topbar-badge">Datos a {lastUpdate}</div>}
          <div className="topbar-user">
            <img src={user.photoURL} className="user-avatar" alt={user.displayName} referrerPolicy="no-referrer" />
            <span className="user-name">{user.displayName?.split(' ')[0]}</span>
            <button className="logout-btn" onClick={onLogout} title="Cerrar sesión">↩</button>
          </div>
        </header>

        <div className="content">
          <div id="kpis">
            <KpiCards metrics={metricsFiltradas} reviews={reviewsFiltradas} selected={selectedProjects} onToggle={handleToggle} />
          </div>
          <div id="resumen-comunas">
            <ResumenComunas metrics={metricsFiltradas} reviews={reviewsFiltradas} />
          </div>
          <div id="ranking">
            <RankingEdificios metrics={metricsFiltradas} reviews={reviewsFiltradas} />
          </div>
          <div id="metricas">
            <MetricasDetalladas metrics={metricsFiltradas} />
          </div>
          <div id="volumen">
            <VolumenReseñas reviews={reviewsFiltradas} />
          </div>
          <div id="evolucion">
            <EvolucionMensual reviews={reviewsFiltradas} />
          </div>
          <div id="clasifval">
            <ClasificacionValoracion reviews={reviewsFiltradas} />
          </div>
          <div id="evolestrellas">
            <EvolucionEstrellas reviews={reviewsFiltradas} />
          </div>
          <div id="tipos">
            <TiposReseñas reviews={reviewsFiltradas} />
          </div>
          <div id="categorias">
            <CategoriasPorEdificio reviews={reviewsFiltradas} />
          </div>
          <div id="causas">
            <SentimientoTemas reviews={reviewsFiltradas} />
          </div>
          <div id="temasgenero">
            <TemasGenero reviews={reviewsFiltradas} />
          </div>
          <div id="heatmap">
            <HeatmapTemas reviews={reviewsFiltradas} />
          </div>
          <div className="grid-2" id="distribucion">
            <DistribucionEstrellas reviews={reviewsFiltradas} />
            <div id="temas">
              <KeywordsCategorias reviews={reviewsFiltradas} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
