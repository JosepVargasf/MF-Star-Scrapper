import { useState, useMemo, useRef } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'
import ExportPanel from './ExportPanel'

const PALETTE = ['#96323C','#5B6670','#A26579','#2D3334','#D7A1A7','#51313C','#800000']

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
  const [primary, setPrimary] = useState(edificios[0] ?? '')
  const [compare, setCompare] = useState('')
  const [mode, setMode]       = useState('mensual')
  const [fontSize, setFontSize] = useState(11)
  const chartRef = useRef(null)

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

  const meses = useMemo(() => {
    const eds = [primary, compare].filter(Boolean)
    const set = new Set(reviews.filter(r => eds.includes(r.edificio) && r.fecha).map(r => r.fecha.slice(0, 7)))
    return [...set].sort()
  }, [reviews, primary, compare])

  const años = useMemo(() => [...new Set(meses.map(m => m.slice(0, 4)))].sort(), [meses])

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
      sum += sc.reduce((a, b) => a + b, 0); count += sc.length
      return count ? +(sum / count).toFixed(2) : null
    })
  }

  function anualSeries(ed) {
    return años.map(año => {
      const mesesDelAño = meses.filter(m => m.startsWith(año))
      const scores = mesesDelAño.flatMap(m => byEdificio[ed]?.[m] ?? [])
      return scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : null
    })
  }

  const data = useMemo(() => {
    if (mode === 'anual') {
      const pS = anualSeries(primary); const cS = compare ? anualSeries(compare) : null
      return años.map((año, i) => { const r = { mes: año, [primary]: pS[i] }; if (compare) r[compare] = cS[i]; return r })
    }
    const fn = mode === 'acumulado' ? acumuladoSeries : mensualSeries
    const pS = fn(primary); const cS = compare ? fn(compare) : null
    return meses.map((mes, i) => { const r = { mes, [primary]: pS[i] }; if (compare) r[compare] = cS[i]; return r })
  }, [meses, años, byEdificio, primary, compare, mode])

  function stats(ed) {
    const fn = mode === 'anual' ? anualSeries : mode === 'acumulado' ? acumuladoSeries : mensualSeries
    const vals = fn(ed).filter(v => v != null)
    if (!vals.length) return null
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return { avg, max: Math.max(...vals), min: Math.min(...vals), trend: vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0 }
  }

  const stP = stats(primary); const stC = compare ? stats(compare) : null
  const colorP = PALETTE[0]; const colorC = PALETTE[1]
  const subtitles = { mensual: 'Promedio de calificación mes a mes', acumulado: 'Promedio acumulado de todas las reseñas hasta cada mes', anual: 'Promedio de calificación por año' }

  return (
    <div className="card card-full">
        <div className="card-header">
          <div>
            <h2>Evolución del Rating</h2>
            <p className="card-sub">{subtitles[mode]}</p>
          </div>
          <div className="tab-group">
            <button className={`tab${mode === 'mensual'   ? ' active' : ''}`} onClick={() => setMode('mensual')}>Mensual</button>
            <button className={`tab${mode === 'acumulado' ? ' active' : ''}`} onClick={() => setMode('acumulado')}>Acumulado</button>
            <button className={`tab${mode === 'anual'     ? ' active' : ''}`} onClick={() => setMode('anual')}>Anual</button>
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

      <div ref={chartRef} id="content-evolucion-rating">
        {mode === 'anual' ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ left: 0, right: 16, top: 28, bottom: 4 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 5]} tickCount={5} tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <ReferenceLine y={4} stroke="#cbd5e1" strokeDasharray="5 3" />
              <Tooltip content={<CustomTooltip mode={mode} />} />
              <Bar dataKey={primary} fill={colorP} radius={[6,6,0,0]} maxBarSize={60}>
                <LabelList dataKey={primary} position="top" style={{ fontSize, fontWeight: 700, fill: colorP }} formatter={v => v?.toFixed(2)} />
              </Bar>
              {compare && (
                <Bar dataKey={compare} fill={colorC} radius={[6,6,0,0]} maxBarSize={60}>
                  <LabelList dataKey={compare} position="top" style={{ fontSize, fontWeight: 700, fill: colorC }} formatter={v => v?.toFixed(2)} />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : (
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
              <XAxis dataKey="mes" tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 5]} tickCount={5} tick={{ fontSize, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <ReferenceLine y={4} stroke="#cbd5e1" strokeDasharray="5 3" label={{ value: '4★', position: 'right', fontSize, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip mode={mode} />} />
              <Area type="monotone" dataKey={primary} stroke={colorP} strokeWidth={2.5}
                fill="url(#gradP)" dot={{ r: 3.5, fill: colorP, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} connectNulls />
              {compare && (
                <Area type="monotone" dataKey={compare} stroke={colorC} strokeWidth={2.5}
                  fill="url(#gradC)" dot={{ r: 3.5, fill: colorC, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} connectNulls />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}

        <div className="evol-stats">
          <StatBlock label={primary} s={stP} color={colorP} mode={mode} />
          {stC && <StatBlock label={compare} s={stC} color={colorC} mode={mode} />}
        </div>
      </div>
      <ExportPanel chartRef={chartRef} chartName="evolucion-rating" title="Evolución del Rating" fontSize={fontSize} onFontSizeChange={setFontSize} />
    </div>
  )
}

function StatBlock({ label, s, color, mode }) {
  if (!s) return null
  const trendUp = s.trend > 0.05; const trendDn = s.trend < -0.05
  return (
    <div className="evol-stat-block" style={{ borderTopColor: color }}>
      <p className="evol-stat-name" style={{ color }}>{label}</p>
      <div className="evol-stat-row">
        <div className="evol-stat-item"><span className="evol-stat-val">{s.avg.toFixed(2)}</span><span className="evol-stat-key">Promedio</span></div>
        <div className="evol-stat-item"><span className="evol-stat-val">{s.max.toFixed(2)}</span><span className="evol-stat-key">Máximo</span></div>
        <div className="evol-stat-item"><span className="evol-stat-val">{s.min.toFixed(2)}</span><span className="evol-stat-key">Mínimo</span></div>
        <div className="evol-stat-item">
          <span className={`evol-stat-val ${trendUp ? 'positive' : trendDn ? 'negative' : ''}`}>
            {trendUp ? '↑' : trendDn ? '↓' : '→'} {Math.abs(s.trend).toFixed(2)}
          </span>
          <span className="evol-stat-key">{mode === 'anual' ? 'Δ año a año' : mode === 'acumulado' ? 'Δ acumulado' : 'Tendencia'}</span>
        </div>
      </div>
    </div>
  )
}
