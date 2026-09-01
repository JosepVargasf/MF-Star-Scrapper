import { toPng } from 'html-to-image'
import PptxGenJS from 'pptxgenjs'
import { SECTIONS, BRAND } from './reportSections'

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = src
  })
}

// Genera un .pptx real (no una imagen pegada a mano): portada de marca +
// una diapositiva nativa por gráfico, con título editable y la imagen
// del gráfico ya diagramada — se abre listo para presentar en PowerPoint.
export async function exportToPowerPoint({ subtitle, onProgress } = {}) {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'MF_WIDE', width: 13.33, height: 7.5 })
  pptx.layout = 'MF_WIDE'

  const W = 13.33, H = 7.5, MARGIN = 0.5

  const cover = pptx.addSlide()
  cover.background = { color: 'FFFFFF' }
  cover.addText('MF Star', {
    x: 0, y: H / 2 - 1.1, w: W, h: 1, align: 'center',
    fontSize: 44, bold: true, color: BRAND.replace('#', ''), fontFace: 'Arial',
  })
  cover.addText('Análisis de Reseñas — Edificios multifamily · Chile', {
    x: 0, y: H / 2 - 0.05, w: W, h: 0.5, align: 'center',
    fontSize: 18, color: '334155', fontFace: 'Arial',
  })
  if (subtitle) {
    cover.addText(subtitle, {
      x: 0, y: H / 2 + 0.4, w: W, h: 0.4, align: 'center',
      fontSize: 13, color: '94A3B8', fontFace: 'Arial',
    })
  }
  const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  cover.addText(`Generado el ${dateStr}`, {
    x: 0, y: H / 2 + 0.9, w: W, h: 0.4, align: 'center',
    fontSize: 11, color: 'CBD5E1', fontFace: 'Arial',
  })

  for (const [id, title] of SECTIONS) {
    const el = document.getElementById(id)
    if (!el) continue
    onProgress?.(title)
    const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 3 })
    const img = await loadImage(dataUrl)

    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }

    slide.addShape('rect', { x: 0, y: 0, w: 0.12, h: H, fill: { color: BRAND.replace('#', '') }, line: { type: 'none' } })
    slide.addText('MF STAR', {
      x: MARGIN, y: 0.28, w: 4, h: 0.3, fontSize: 11, bold: true,
      color: BRAND.replace('#', ''), fontFace: 'Arial', charSpacing: 1,
    })
    slide.addText(title, {
      x: MARGIN, y: 0.55, w: W - MARGIN * 2, h: 0.5, fontSize: 22, bold: true,
      color: '0F172A', fontFace: 'Arial',
    })
    slide.addText(dateStr, {
      x: W - MARGIN - 2.5, y: 0.3, w: 2.5, h: 0.3, align: 'right',
      fontSize: 10, color: '94A3B8', fontFace: 'Arial',
    })

    const availW = W - MARGIN * 2
    const availH = H - 1.3 - MARGIN
    const scale = Math.min(availW / (img.width / 96), availH / (img.height / 96))
    const w = (img.width / 96) * scale
    const h = (img.height / 96) * scale
    slide.addImage({ data: dataUrl, x: (W - w) / 2, y: 1.2 + (availH - h) / 2, w, h })

    slide.addText('Análisis de Reseñas · Edificios multifamily · Chile', {
      x: MARGIN, y: H - 0.4, w: W - MARGIN * 2, h: 0.3, fontSize: 8, color: 'CBD5E1', fontFace: 'Arial',
    })
  }

  await pptx.writeFile({ fileName: `reporte-mf-star-${new Date().toISOString().slice(0, 10)}.pptx` })
}
