import { useState, useRef, useEffect } from 'react'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmt(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return `${MONTHS[+m - 1]} ${y}`
}

export default function MonthRangePicker({ value, onChange, availableMonths }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(null)
  const [selecting, setSelecting] = useState(null) // first click selected
  const years = [...new Set(availableMonths.map(m => m.slice(0, 4)))].sort()
  const [year, setYear] = useState(years[years.length - 1] ?? new Date().getFullYear().toString())
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleMonthClick(ym) {
    if (!availableMonths.includes(ym)) return
    if (!selecting) {
      setSelecting(ym)
    } else {
      const from = ym < selecting ? ym : selecting
      const to   = ym < selecting ? selecting : ym
      onChange({ from, to })
      setSelecting(null)
      setOpen(false)
    }
  }

  const preview = selecting ? {
    from: hovered && hovered < selecting ? hovered : selecting,
    to:   hovered && hovered > selecting ? hovered : selecting,
  } : value

  const label = value.from === value.to
    ? fmt(value.from)
    : `${fmt(value.from)} → ${fmt(value.to)}`

  return (
    <div className="mrp-wrap" ref={ref}>
      <button className="mrp-trigger" onClick={() => { setOpen(o => !o); setSelecting(null) }}>
        <span className="mrp-trigger-icon">📅</span>
        <span>{label || 'Seleccionar período'}</span>
        <span className="mrp-trigger-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mrp-popover">
          <div className="mrp-nav">
            <button className="mrp-nav-btn" onClick={() => setYear(y => String(+y - 1))} disabled={year <= years[0]}>‹</button>
            <span className="mrp-nav-year">{year}</span>
            <button className="mrp-nav-btn" onClick={() => setYear(y => String(+y + 1))} disabled={year >= years[years.length - 1]}>›</button>
          </div>

          {selecting && <p className="mrp-hint">Ahora selecciona el mes final</p>}

          <div className="mrp-grid">
            {MONTHS.map((name, i) => {
              const mm  = String(i + 1).padStart(2, '0')
              const ym  = `${year}-${mm}`
              const avail   = availableMonths.includes(ym)
              const isFrom  = ym === preview?.from
              const isTo    = ym === preview?.to
              const inRange = preview && ym > preview.from && ym < preview.to
              const isSelected = isFrom || isTo

              return (
                <button
                  key={mm}
                  className={[
                    'mrp-cell',
                    !avail    ? 'mrp-cell-off'   : '',
                    isSelected ? 'mrp-cell-sel'  : '',
                    inRange   ? 'mrp-cell-range' : '',
                    isFrom    ? 'mrp-cell-from'  : '',
                    isTo      ? 'mrp-cell-to'    : '',
                  ].join(' ')}
                  onClick={() => handleMonthClick(ym)}
                  onMouseEnter={() => selecting && setHovered(ym)}
                  onMouseLeave={() => setHovered(null)}
                  disabled={!avail}
                >
                  {name}
                </button>
              )
            })}
          </div>

          <div className="mrp-footer">
            <button className="mrp-reset" onClick={() => {
              onChange({ from: availableMonths[0], to: availableMonths[availableMonths.length - 1] })
              setSelecting(null)
              setOpen(false)
            }}>Todo el período</button>
          </div>
        </div>
      )}
    </div>
  )
}
