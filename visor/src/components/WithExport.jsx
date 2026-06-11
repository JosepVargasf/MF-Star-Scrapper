import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ExportModal from './ExportModal'

export default function WithExport({ children }) {
  const ref  = useRef(null)
  const [open, setOpen] = useState(false)

  return (
    <div className="with-export-wrap" ref={ref}>
      {children}
      <button
        className="with-export-btn"
        onClick={() => setOpen(true)}
        title="Exportar gráfico"
        data-html2canvas-ignore
      >
        ⬇ Exportar
      </button>
      {open && createPortal(
        <ExportModal targetRef={ref} onClose={() => setOpen(false)} />,
        document.body
      )}
    </div>
  )
}
