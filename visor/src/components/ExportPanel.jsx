import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'

const RATIOS = ['auto', '16:9', '4:3', '1:1', '4:1', '6:1']

function PreviewModal({ src, chartName, onClose, onDownload }) {
  return createPortal(
    <div className="ep-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ep-preview-modal">
        <div className="ep-pm-header">
          <span>Vista previa — {chartName}</span>
          <button className="ep-pm-close" onClick={onClose}>✕</button>
        </div>
        <div className="ep-pm-body">
          <img src={src} alt="preview" />
        </div>
        <div className="ep-pm-footer">
          <button className="ep-btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="ep-btn-primary" onClick={onDownload}>⬇ Descargar PNG</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

async function captureWithRatio(el, bg, ratio) {
  const raw = await toPng(el, {
    backgroundColor: bg === 'white' ? '#ffffff' : undefined,
    pixelRatio: 2,
  })
  if (ratio === 'auto') return raw

  const img = await new Promise(resolve => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.src = raw
  })

  const [rw, rh] = ratio.split(':').map(Number)
  const targetW = 1920
  const targetH = Math.round(targetW * rh / rw)
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (bg === 'white') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, targetW, targetH) }
  const scale = Math.min(targetW / img.width, targetH / img.height)
  ctx.drawImage(img, (targetW - img.width * scale) / 2, (targetH - img.height * scale) / 2, img.width * scale, img.height * scale)
  return canvas.toDataURL('image/png')
}

export default function ExportPanel({ chartRef, chartName = 'grafico', fontSize, onFontSizeChange }) {
  const [ratio,       setRatio]       = useState('auto')
  const [bg,          setBg]          = useState('white')
  const [preview,     setPreview]     = useState(null)
  const [copying,     setCopying]     = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function getDataUrl() {
    if (!chartRef.current) return null
    return captureWithRatio(chartRef.current, bg, ratio)
  }

  async function handlePreview() {
    const url = await getDataUrl()
    if (url) setPreview(url)
  }

  async function handleCopy() {
    setCopying(true)
    try {
      const url = await getDataUrl()
      if (!url) return
      const blob = await (await fetch(url)).blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard no disponible */ } finally { setCopying(false) }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const url = await getDataUrl()
      if (!url) return
      const a = document.createElement('a')
      a.href = url; a.download = `${chartName}.png`; a.click()
    } finally { setDownloading(false) }
  }

  return (
    <>
      <div className="ep-panel">
        <div className="ep-group">
          <span className="ep-label">Proporción</span>
          <div className="ep-btn-row">
            {RATIOS.map(r => (
              <button key={r} className={`ep-toggle${ratio === r ? ' active' : ''}`} onClick={() => setRatio(r)}>{r}</button>
            ))}
          </div>
        </div>

        <div className="ep-group">
          <span className="ep-label">Fondo</span>
          <div className="ep-btn-row">
            {[['white','Blanco'],['transparent','Transp.']].map(([v,l]) => (
              <button key={v} className={`ep-toggle${bg === v ? ' active' : ''}`} onClick={() => setBg(v)}>{l}</button>
            ))}
          </div>
        </div>

        {fontSize !== undefined && onFontSizeChange && (
          <div className="ep-group">
            <span className="ep-label">Texto</span>
            <input type="range" min={7} max={20} value={fontSize}
              onChange={e => onFontSizeChange(+e.target.value)} className="ep-slider" />
            <span className="ep-slider-val">{fontSize}px</span>
          </div>
        )}

        <div className="ep-actions">
          <button className="ep-btn-ghost" onClick={handlePreview}>Vista previa</button>
          <button
            className={`ep-btn-ghost${copied ? ' ep-copied' : ''}`}
            onClick={handleCopy} disabled={copying}
          >
            {copying ? 'Copiando…' : copied ? '✓ Copiado' : 'Copiar'}
          </button>
          <button className="ep-btn-primary" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Descargando…' : '⬇ Descargar PNG'}
          </button>
        </div>
      </div>

      {preview && (
        <PreviewModal
          src={preview} chartName={chartName}
          onClose={() => setPreview(null)}
          onDownload={() => { handleDownload(); setPreview(null) }}
        />
      )}
    </>
  )
}
