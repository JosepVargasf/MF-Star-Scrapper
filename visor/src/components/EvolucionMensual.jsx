import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const PALETTE = ['#6366f1','#10b981','#f59e0b','#0ea5e9','#a855f7','#ec4899','#14b8a6','#f97316']

function CustomTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) return null
  const items = payload.filter(p => p.value != null)
  return (
    <div className="chart-tooltip">
      <p className="tt-title">{label}</p>
      {items.map((p, i) => (
        <p key={i} className="tt-row">
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color, marginRight: 6 }} />
            {p.name}
          </span>
          <strong>{p.value?.toFixed(2)} ★</strong>
        </p>
      ))}
      {mode === 'acumulado' && <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 4 }}>Promedio acumulado hasta este mes</p>}
    </div>
  )
}

export default function EvolucionMensual({ reviews }) {
  const edificios = [...new Set(reviews.map(r => r.edificio))].sort()
  const [primary, setPrimary]   = useState(edificios[0] ?? '')
  const [compare, setCompare]   = useState('')
  const [mode, setMode]         = useState('mensual') // 'mensual' | 'acumulado'

  const byEdificio = useMemo(() => {
    const map = {}
    for (const r of reviews) {
      if (!r.fecha || !r.score) continue
      const mes = r.fecha.slice(0, 7)
      if (!map[r.edificio]) map[r.edificio] = {}
      if (!map[r.edificio][mes]) map[r.edificio][mes] = []
      map[r.edificio][mes].push(r.score)
    }
    return map
  }, [reviews])

  const meses = useMemo(() =>
    [...new Set(reviews.map(r => r.fecha?.slice(0, 7)).filter(Boolean))].sort()
  , [reviews])

  function mensualSeries(ed) {
    return meses.map(mes => {
      const sc = byEdificio[ed]?.[mes] ?? []
      return sc.length ? +(sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(2) : null
    })
  }

  function acumuladoSeries(ed) {
    let sum = 0, count = 0
    return meses.map(mes => {
      const sc = byEdificio[ed]?.[mes] ?? []
      sum   += sc.reduce((a, b) => a + b, 0)
      count += sc.length
      return count ? +(sum / count).toFixed(2) : null
    })
  }

  const data = useMemo(() => {
    const seriesFn = mode === 'acumulado' ? acumuladoSeries : mensualSeries
    const pSeries  = seriesFn(primary)
    const cSeries  = compare ? seriesFn(compare) : null

    return meses.map((mes, i) => {
      const row = { mes, [primary]: pSeries[i] }
      if (compare) row[compare] = cSeries[i]
      return row
    })
  }, [meses, byEdificio, primary, compare, mode])

  function stats(ed) {
    const seriesFn = mode === 'acumulado' ? acumuladoSeries : mensualSeries
    const vals = seriesFn(ed).filter(v => v != null)
    if (!vals.length) return null
    const avg   = vals.reduce((a, b) => a + b, 0) / vals.length
    const max   = Math.max(...vals)
    const min   = Math.min(...vals)
    const trend = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0
    return { avg, max, min, trend }
  }

  const stP    = stats(primary)
  const stC    = compare ? stats(compare) : null
  const colorP = PALETTE[0]
  const colorC = PALETTE[1]

  return (
    <div className="card card-full">
      <div className="card-header">
        <div>
          <h2>Evolución del Rating</h2>
          <p className="card-sub">
            {mode === 'mensual'
              ? 'Promedio de calificación mes a mes'
              : 'Promedio acumulado de todas las reseñas hasta cada mes'}
          </p>
        </div>
        <div className="tab-group">
          <button className={`tab${mode === 'mensual'    ? ' active' : ''}`} onClick={() => setMode('mensual')}>Mensual</button>
          <button className={`tab${mode === 'acumulado'  ? ' active' : ''}`} onClick={() => setMode('acumulado')}>Acumulado</button>
        </div>
      </div>

      <div className="evol-controls">
        <div className="evol-selector">
          <div className="evol-dot" style={{ background: colorP }} />
          <select value={primary} onChange={e => setPrimary(e.target.value)} className="select" style={{ marginBottom: 0 }}>
            {edificios.map(ed => <option key={ed} value={ed}>{ed}</option>)}
          </select>
        </div>
        <div className="evol-vs">vs</div>
        <div className="evol-selector">
          <div className="evol-dot" style={{ background: compare ? colorC : '#e2e8f0' }} />
          <select value={compare} onChange={e => setCompare(e.target.value)} className="select" style={{ marginBottom: 0 }}>
            <option value="">Sin comparar</option>
            {edificios.filter(ed => ed !== primary).map(ed => <option key={ed} value={ed}>{ed}</option>)}
          </select>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ left: 0, right: 16, top: 12, bottom: 4 }}>
          <defs>
            <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={colorP} stopOpacity={0.15} />
              <stop offset="95%" stopColor={colorP} stopOpacity={0} />
            </linearGradient>
            {compare && (
              <linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colorC} stopOpacity={0.15} />
                <stop offset="95%" stopColor={colorC} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis domain={[1, 5]} tickCount={5} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
          <ReferenceLine y={4} stroke="#cbd5e1" strokeDasharray="5 3" label={{ value: '4★', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
          <Tooltip content={<CustomTooltip mode={mode} />} />
          <Area type="monotone" dataKey={primary} stroke={colorP} strokeWidth={2.5}
            fill="url(#gradP)" dot={{ r: 3.5, fill: colorP, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} connectNulls />
          {compare && (
            <Area type="monotone" dataKey={compare} stroke={colorC} strokeWidth={2.5}
              fill="url(#gradC)" dot={{ r: 3.5, fill: colorC, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} connectNulls />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <div className="evol-stats">
        <StatBlock label={primary} s={stP} color={colorP} mode={mode} />
        {stC && <StatBlock label={compare} s={stC} color={colorC} mode={mode} />}
      </div>
    </div>
  )
}

function StatBlock({ label, s, color, mode }) {
  if (!s) return null
  const trendUp = s.trend > 0.05
  const trendDn = s.trend < -0.05
  return (
    <div className="evol-stat-block" style={{ borderTopColor: color }}>
      <p className="evol-stat-name" style={{ color }}>{label}</p>
      <div className="evol-stat-row">
        <div className="evol-stat-item">
          <span className="evol-stat-val">{s.avg.toFixed(2)}</span>
          <span className="evol-stat-key">{mode === 'acumulado' ? 'Prom. del acumulado' : 'Promedio'}</span>
        </div>
        <div className="evol-stat-item">
          <span className="evol-stat-val">{s.max.toFixed(2)}</span>
          <span className="evol-stat-key">Máximo</span>
        </div>
        <div className="evol-stat-item">
          <span className="evol-stat-val">{s.min.toFixed(2)}</span>
          <span className="evol-stat-key">Mínimo</span>
        </div>
        <div className="evol-stat-item">
          <span className={`evol-stat-val ${trendUp ? 'positive' : trendDn ? 'negative' : ''}`}>
            {trendUp ? '↑' : trendDn ? '↓' : '→'} {Math.abs(s.trend).toFixed(2)}
          </span>
          <span className="evol-stat-key">{mode === 'acumulado' ? 'Δ acumulado' : 'Tendencia'}</span>
        </div>
      </div>
    </div>
  )
}
