import { useState, useMemo, useRef } from 'react'
import ExportPanel from './ExportPanel'

const COLS = [
  { key: 'edificio',     label: 'Edificio',        align: 'left',   fmt: v => v },
  { key: 'calif_actual', label: 'Rating actual',   align: 'center', fmt: v => v != null ? v.toFixed(2) : '—' },
  { key: 'calif_previo', label: 'Mes anterior',    align: 'center', fmt: v => v != null ? v.toFixed(2) : '—' },
  { key: 'variacion',    label: 'Variación',       align: 'center', fmt: null },
  { key: 'resenastot',   label: 'Total reseñas',   align: 'center', fmt: v => v ?? '—' },
  { key: 'nuevas_mes',   label: 'Nuevas mes',      align: 'center', fmt: v => v ?? '—' },
  { key: 'pos_pct',      label: '% Positivo',      align: 'center', fmt: v => v != null ? `${v.toFixed(1)}%` : '—' },
  { key: 'neg_pct',      label: '% Negativo',      align: 'center', fmt: v => v != null ? `${v.toFixed(1)}%` : '—' },
]

function VariacionCell({ val }) {
  if (val == null) return <span className="md-neutral">—</span>
  const up  = val > 0.01
  const dn  = val < -0.01
  return (
    <span className={up ? 'md-up' : dn ? 'md-dn' : 'md-neutral'}>
      {up ? '↑' : dn ? '↓' : '→'} {Math.abs(val).toFixed(2)}
    </span>
  )
}

function RatingBar({ val, max = 5 }) {
  if (val == null) return null
  const pct = (val / max) * 100
  const color = val >= 4.5 ? '#96323C' : val >= 3.5 ? '#A26579' : '#5B6670'
  return (
    <div className="md-bar-wrap">
      <div className="md-bar" style={{ width: `${pct}%`, background: color }} />
      <span className="md-bar-val">{val.toFixed(2)}</span>
    </div>
  )
}

export default function MetricasDetalladas({ metrics }) {
  const [sortKey, setSortKey]  = useState('calif_actual')
  const [sortDir, setSortDir]  = useState(-1)
  const chartRef = useRef(null)

  // Deduplicar por edificio
  const deduped = useMemo(() => Object.values(
    metrics.reduce((acc, m) => {
      if (!acc[m.edificio] || (m.calif_actual ?? 0) > (acc[m.edificio].calif_actual ?? 0))
        acc[m.edificio] = m
      return acc
    }, {})
  ), [metrics])

  const sorted = useMemo(() =>
    [...deduped].sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === -1 ? -Infinity : Infinity)
      const bv = b[sortKey] ?? (sortDir === -1 ? -Infinity : Infinity)
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir
      return (av - bv) * sortDir
    })
  , [deduped, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(-1) }
  }

  function sortIcon(key) {
    if (sortKey !== key) return <span className="md-sort-icon">↕</span>
    return <span className="md-sort-icon active">{sortDir === -1 ? '↓' : '↑'}</span>
  }

  return (
    <div className="card card-full" ref={chartRef}>
      <div className="card-header">
        <div>
          <h2>Métricas detalladas por edificio</h2>
          <p className="card-sub">Haz clic en el encabezado de cada columna para ordenar</p>
        </div>
      </div>

      <div className="md-wrap">
        <table className="md-table">
          <thead>
            <tr>
              {COLS.map(c => (
                <th
                  key={c.key}
                  className={`md-th ${c.align === 'left' ? 'md-th-left' : ''}`}
                  onClick={() => toggleSort(c.key)}
                >
                  {c.label} {sortIcon(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.edificio} className={i % 2 === 0 ? 'md-row-even' : ''}>
                <td className="md-td md-td-edificio">{row.edificio}</td>
                <td className="md-td md-td-center">
                  <RatingBar val={row.calif_actual} />
                </td>
                <td className="md-td md-td-center md-muted">{row.calif_previo != null ? row.calif_previo.toFixed(2) : '—'}</td>
                <td className="md-td md-td-center"><VariacionCell val={row.variacion} /></td>
                <td className="md-td md-td-center">{row.resenastot ?? '—'}</td>
                <td className="md-td md-td-center">
                  {row.nuevas_mes != null
                    ? <span className={row.nuevas_mes > 0 ? 'md-badge-new' : ''}>{row.nuevas_mes}</span>
                    : '—'}
                </td>
                <td className="md-td md-td-center md-pos">{row.pos_pct != null ? `${row.pos_pct.toFixed(1)}%` : '—'}</td>
                <td className="md-td md-td-center md-neg">{row.neg_pct != null ? `${row.neg_pct.toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ExportPanel chartRef={chartRef} chartName="metricas-detalladas" />
    </div>
  )
}
