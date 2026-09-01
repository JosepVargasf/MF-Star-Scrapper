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

const HEADER_H = 64
const FOOTER_H = 36
const PAD = 28

async function loadImage(src) {
  return new Promise(resolve => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.src = src
  })
}

// Compone el screenshot crudo del gráfico dentro de una tarjeta de reporte
// con encabezado de marca, título y pie de fecha, lista para presentación.
async function composeReport(rawSrc, title, bg) {
  const img = await loadImage(rawSrc)
  const innerW = img.width, innerH = img.height
  const w = innerW + PAD * 2
  const h = innerH + PAD * 2 + HEADER_H + FOOTER_H

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#96323C'
  ctx.font = '700 22px system-ui, -apple-system, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('MF Star', PAD, HEADER_H / 2 - 8)
  ctx.fillStyle = '#0f172a'
  ctx.font = '600 15px system-ui, -apple-system, sans-serif'
  ctx.fillText(title, PAD, HEADER_H / 2 + 16)

  const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  ctx.textAlign = 'right'
  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 12px system-ui, -apple-system, sans-serif'
  ctx.fillText(dateStr, w - PAD, HEADER_H / 2)
  ctx.textAlign = 'left'

  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, HEADER_H); ctx.lineTo(w - PAD, HEADER_H); ctx.stroke()

  if (bg === 'transparent') {
    ctx.clearRect(PAD, HEADER_H + PAD / 2, innerW, innerH)
  }
  ctx.drawImage(img, PAD, HEADER_H + PAD / 2, innerW, innerH)

  ctx.fillStyle = '#cbd5e1'
  ctx.font = '500 11px system-ui, -apple-system, sans-serif'
  ctx.fillText('Análisis de Reseñas · Edificios multifamily · Chile', PAD, h - FOOTER_H / 2)

  return canvas
}

async function captureWithRatio(el, bg, ratio, title) {
  const raw = await toPng(el, {
    backgroundColor: bg === 'white' ? '#ffffff' : undefined,
    pixelRatio: 3,
  })

  const reportCanvas = await composeReport(raw, title, bg)
  if (ratio === 'auto') return reportCanvas.toDataURL('image/png')

  const img = await loadImage(reportCanvas.toDataURL('image/png'))
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

export default function ExportPanel({ chartRef, chartName = 'grafico', title, fontSize, onFontSizeChange }) {
  const reportTitle = title ?? chartName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const [ratio,       setRatio]       = useState('auto')
  const [bg,          setBg]          = useState('white')
  const [preview,     setPreview]     = useState(null)
  const [copying,     setCopying]     = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function getDataUrl() {
    if (!chartRef.current) return null
    return captureWithRatio(chartRef.current, bg, ratio, reportTitle)
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
            <input type="range" min={7} max={50} value={fontSize}
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
