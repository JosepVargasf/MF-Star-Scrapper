import { useState, useEffect, useCallback, useRef } from 'react'
import html2canvas from 'html2canvas'

const RATIOS = [
  { label: '16:9', w: 1920, h: 1080 },
  { label: '4:3',  w: 1600, h: 1200 },
  { label: '1:1',  w: 1000, h: 1000 },
  { label: '4:1',  w: 1600, h: 400  },
  { label: '6:1',  w: 1800, h: 300  },
]

const PREVIEW_W = 560

function FontSlider({ label, value, onChange }) {
  return (
    <div className="em-slider-row">
      <span className="em-slider-label">{label}</span>
      <input
        type="range" min={7} max={22} value={value}
        onChange={e => onChange(+e.target.value)}
        className="em-slider"
      />
      <span className="em-slider-val">{value}px</span>
    </div>
  )
}

async function captureChart(el, fontAxis, fontLabel, fontLegend, ratio) {
  const styleId = '__em_export_style__'
  let style = document.getElementById(styleId)
  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    document.head.appendChild(style)
  }

  style.textContent = `
    [data-em-export] .recharts-cartesian-axis-tick text { font-size: ${fontAxis}px !important; }
    [data-em-export] .recharts-label { font-size: ${fontLabel}px !important; }
    [data-em-export] .recharts-label-list text { font-size: ${fontLabel}px !important; }
    [data-em-export] .recharts-legend-item-text { font-size: ${fontLegend}px !important; }
  `
  el.setAttribute('data-em-export', 'true')

  const raw = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    ignoreElements: (node) => node.hasAttribute?.('data-html2canvas-ignore'),
  })

  el.removeAttribute('data-em-export')
  style.textContent = ''

  const out = document.createElement('canvas')
  out.width  = ratio.w
  out.height = ratio.h
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ratio.w, ratio.h)

  const scale = Math.min(ratio.w / raw.width, ratio.h / raw.height)
  const sw = raw.width  * scale
  const sh = raw.height * scale
  ctx.drawImage(raw, (ratio.w - sw) / 2, (ratio.h - sh) / 2, sw, sh)

  return out
}

export default function ExportModal({ targetRef, onClose }) {
  const [ratio,      setRatio]      = useState(RATIOS[0])
  const [fontAxis,   setFontAxis]   = useState(11)
  const [fontLabel,  setFontLabel]  = useState(11)
  const [fontLegend, setFontLegend] = useState(11)
  const [preview,    setPreview]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [copying,    setCopying]    = useState(false)
  const [error,      setError]      = useState(null)
  const debounceRef = useRef(null)

  const regenerate = useCallback(() => {
    if (!targetRef.current) return
    clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const canvas = await captureChart(targetRef.current, fontAxis, fontLabel, fontLegend, ratio)
        setPreview(canvas.toDataURL('image/png'))
      } catch (e) {
        setError('Error al generar la vista previa.')
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [targetRef, ratio, fontAxis, fontLabel, fontLegend])

  useEffect(() => { regenerate() }, [regenerate])

  async function handleCopy() {
    if (!targetRef.current) return
    setCopying(true)
    setError(null)
    try {
      const canvas = await captureChart(targetRef.current, fontAxis, fontLabel, fontLegend, ratio)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      onClose()
    } catch (e) {
      setError('No se pudo copiar. Intenta con Chrome o Edge.')
    } finally {
      setCopying(false)
    }
  }

  const previewH = Math.round(PREVIEW_W * (ratio.h / ratio.w))

  return (
    <div className="em-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="em-modal">

        <div className="em-header">
          <h3>Exportar gráfico</h3>
          <button className="em-close" onClick={onClose}>✕</button>
        </div>

        <div className="em-body">

          <div className="em-controls">
            <div className="em-section">
              <p className="em-section-title">Proporción</p>
              <div className="em-ratio-group">
                {RATIOS.map(r => (
                  <button
                    key={r.label}
                    className={`em-ratio-btn${ratio.label === r.label ? ' active' : ''}`}
                    onClick={() => setRatio(r)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="em-dim">{ratio.w} × {ratio.h} px</p>
            </div>

            <div className="em-section">
              <p className="em-section-title">Tamaño de texto</p>
              <FontSlider label="Ejes"      value={fontAxis}   onChange={setFontAxis} />
              <FontSlider label="Etiquetas" value={fontLabel}  onChange={setFontLabel} />
              <FontSlider label="Leyendas"  value={fontLegend} onChange={setFontLegend} />
            </div>
          </div>

          <div className="em-preview-col">
            <p className="em-section-title">Vista previa</p>
            <div className="em-preview-box" style={{ width: PREVIEW_W, height: previewH }}>
              {loading && <div className="em-preview-loading"><span className="spinner" />Generando…</div>}
              {!loading && preview && (
                <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
            </div>
          </div>

        </div>

        {error && <p className="em-error">{error}</p>}

        <div className="em-footer">
          <button className="em-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="em-btn-copy" onClick={handleCopy} disabled={copying || loading}>
            {copying ? 'Copiando…' : '📋 Copiar al portapapeles'}
          </button>
        </div>

      </div>
    </div>
  )
}
