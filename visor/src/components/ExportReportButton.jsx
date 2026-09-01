import { useEffect, useRef, useState } from 'react'
import { exportFullReport } from '../lib/reportExport'
import { exportToPowerPoint } from '../lib/pptxExport'

export default function ExportReportButton({ subtitle }) {
  const [status, setStatus] = useState(null)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function run(fn) {
    setOpen(false)
    try {
      await fn({ subtitle, onProgress: setStatus })
    } finally {
      setStatus(null)
    }
  }

  return (
    <div className="topbar-export-wrap" ref={ref}>
      <button className="topbar-export" onClick={() => setOpen(o => !o)} disabled={!!status}>
        {status ? `Generando… ${status}` : '📤 Exportar reporte'}
      </button>
      {open && (
        <div className="topbar-export-menu">
          <button onClick={() => run(exportToPowerPoint)}>🖥️ PowerPoint (.pptx)</button>
          <button onClick={() => run(exportFullReport)}>📄 PDF</button>
        </div>
      )}
    </div>
  )
}
