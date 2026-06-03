import { useState } from 'react'
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
import './App.css'

export default function App() {
  const { user, error: authError, login, logout } = useAuth()

  // user=undefined → cargando auth; user=null → no autenticado
  if (user === undefined) return <div className="splash"><div className="spinner" /></div>
  if (!user) return <LoginScreen onLogin={login} error={authError} />

  return <Dashboard user={user} onLogout={logout} />
}

function Dashboard({ user, onLogout }) {
  const { metrics, reviews, loading, error } = useData()
  const [selectedProjects, setSelectedProjects] = useState(new Set())

  if (loading) return (
    <div className="splash">
      <div className="spinner" />
      <p>Cargando datos...</p>
    </div>
  )
  if (error) return <div className="splash error">Error al cargar datos: {String(error)}</div>

  const lastUpdate = reviews.reduce((max, r) => r.fecha > max ? r.fecha : max, '')

  function handleToggle(ed) {
    if (ed === null) { setSelectedProjects(new Set()); return }
    setSelectedProjects(prev => {
      const next = new Set(prev)
      next.has(ed) ? next.delete(ed) : next.add(ed)
      return next
    })
  }

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
          <a href="#ranking"      className="nav-item"><span className="nav-icon" />Ranking</a>
          <a href="#volumen"      className="nav-item"><span className="nav-icon" />Volumen</a>
          <a href="#evolucion"    className="nav-item"><span className="nav-icon" />Evolución</a>
          <a href="#causas"       className="nav-item"><span className="nav-icon" />Causas</a>
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
          {lastUpdate && <div className="topbar-badge">Datos a {lastUpdate}</div>}
          <div className="topbar-user">
            <img src={user.photoURL} className="user-avatar" alt={user.displayName} referrerPolicy="no-referrer" />
            <span className="user-name">{user.displayName?.split(' ')[0]}</span>
            <button className="logout-btn" onClick={onLogout} title="Cerrar sesión">↩</button>
          </div>
        </header>

        <div className="content">
          <div id="kpis">
            <KpiCards
              metrics={metrics}
              reviews={reviews}
              selected={selectedProjects}
              onToggle={handleToggle}
            />
          </div>

          <div id="ranking">
            <RankingEdificios metrics={metrics} />
          </div>

          <div id="volumen">
            <VolumenReseñas reviews={reviews} />
          </div>

          <div id="evolucion">
            <EvolucionMensual reviews={reviews} />
          </div>

          <div id="causas">
            <SentimientoTemas reviews={reviews} />
          </div>

          <div className="grid-2" id="distribucion">
            <DistribucionEstrellas reviews={reviews} />
            <div id="temas">
              <KeywordsCategorias reviews={reviews} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
