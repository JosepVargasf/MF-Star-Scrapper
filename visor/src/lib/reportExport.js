import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { SECTIONS, BRAND } from './reportSections'
import { renderTable, renderKpiRow, renderBarRows, renderChartWithLegend, renderChartPanels, drawStaticLegend } from './pdfNative'

// Cada sección se redibuja nativa (vector + texto real), no se rasteriza.
// El único caso sin renderer nativo es el fallback de más abajo.
const NATIVE_RENDERERS = {
  'content-kpis':               (pdf, el, x, y, w, h) => renderKpiRow(pdf, el, x, y, w, Math.min(h, 70)),
  'content-resumen-comunas':    (pdf, el, x, y, w) => renderTable(pdf, el.querySelector('table'), x, y, w),
  'content-metricas-detalladas':(pdf, el, x, y, w) => renderTable(pdf, el.querySelector('table'), x, y, w, undefined, { fontSize: 7 }),
  'content-heatmap-temas':      (pdf, el, x, y, w) => renderTable(pdf, el.querySelector('table'), x, y, w, undefined, { withCellColor: true, fontSize: 7 }),
  'content-temas-relevantes':   (pdf, el, x, y, w) => renderBarRows(pdf, [...el.querySelectorAll('.kt-row')], x, y, w, 20),
  'content-sentimiento-temas':  (pdf, el, x, y, w) => {
    const cols = [...el.querySelectorAll('.sentemas-col')]
    const colW = (w - 24) / 2
    cols.forEach((col, i) => {
      const cx = x + i * (colW + 24)
      const title = col.querySelector('h3')?.textContent?.trim() ?? ''
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor('#0f172a')
      pdf.text(title, cx, y + 10)
      renderBarRows(pdf, [...col.querySelectorAll('.bl-row')], cx, y + 26, colW, 18, {
        barColor: i === 0 ? BRAND : '#5B6670', labelWidth: colW * 0.55, countWidth: 30,
      })
    })
  },
  // Un solo gráfico Recharts: se incrusta como vector real (detecta el svg
  // del gráfico y lo distingue de los mini-svg de los íconos de leyenda).
  'content-ranking-edificios':        (pdf, el, x, y, w, h) => renderChartWithLegend(pdf, el, x, y, w, h),
  'content-evolucion-rating':         (pdf, el, x, y, w, h) => renderChartWithLegend(pdf, el, x, y, w, h),
  'content-categorias-edificio':      (pdf, el, x, y, w, h) => renderChartWithLegend(pdf, el, x, y, w, h),
  'content-distribucion-estrellas':   (pdf, el, x, y, w, h) => renderChartWithLegend(pdf, el, x, y, w, h),
  'content-volumen-resenas':          (pdf, el, x, y, w, h) => renderChartWithLegend(pdf, el, x, y, w, h),
  // Grillas de varios gráficos a la vez: un panel (título + gráfico vector
  // + leyenda/overlay) por comuna/categoría.
  'content-clasificacion-valoracion': (pdf, el, x, y, w, h) => {
    const legendH = drawStaticLegend(pdf, el, '.legend-dot', '.legend-label', x, y + 6, w)
    return renderChartPanels(pdf, el, x, y + legendH, w, h - legendH, { panelSelector: '.clasif-panel', titleSelector: '.clasif-panel-title' })
  },
  'content-evolucion-estrellas':      (pdf, el, x, y, w, h) => renderChartPanels(pdf, el, x, y, w, h, { panelSelector: '.evol-est-panel', titleSelector: '.evol-est-titulo' }),
  'content-tipos-resenas':            (pdf, el, x, y, w, h) => renderChartPanels(pdf, el, x, y, w, h, { panelSelector: '.tr-panel', titleSelector: '.tr-panel-title' }),
  'content-temas-genero':             (pdf, el, x, y, w, h) => renderChartPanels(pdf, el, x, y, w, h, { panelSelector: '.tg-chart-wrap', titleSelector: '.tg-chart-title' }),
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = src
  })
}

// Único fallback: si una sección no tiene renderer nativo (o el DOM no
// trae lo esperado), se captura en alta resolución (3x) como antes.
async function renderRasterSection(pdf, el, x, y, availW, availH) {
  const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 3 })
  const img = await loadImage(dataUrl)
  const scale = Math.min(availW / img.width, availH / img.height, 1)
  const w = img.width * scale
  const h = img.height * scale
  pdf.addImage(dataUrl, 'PNG', x + (availW - w) / 2, y + (availH - h) / 2, w, h)
}

function drawHeader(pdf, pageW, margin, title) {
  pdf.setFillColor(BRAND)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(BRAND)
  pdf.text('MF Star', margin, margin)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor('#64748b')
  pdf.text(title, margin, margin + 16)
  const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  pdf.setFontSize(9)
  pdf.setTextColor('#94a3b8')
  pdf.text(dateStr, pageW - margin, margin, { align: 'right' })
  pdf.setDrawColor('#e2e8f0')
  pdf.line(margin, margin + 24, pageW - margin, margin + 24)
}

function drawFooter(pdf, pageW, pageH, margin, pageNum) {
  pdf.setFontSize(8)
  pdf.setTextColor('#cbd5e1')
  pdf.text('Análisis de Reseñas · Edificios multifamily · Chile', margin, pageH - margin / 2)
  pdf.text(String(pageNum), pageW - margin, pageH - margin / 2, { align: 'right' })
}

function drawCoverPage(pdf, pageW, pageH, subtitle) {
  pdf.setFillColor('#ffffff')
  pdf.rect(0, 0, pageW, pageH, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(30)
  pdf.setTextColor(BRAND)
  pdf.text('MF Star', pageW / 2, pageH / 2 - 40, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(16)
  pdf.setTextColor('#334155')
  pdf.text('Análisis de Reseñas — Edificios multifamily · Chile', pageW / 2, pageH / 2 - 10, { align: 'center' })
  if (subtitle) {
    pdf.setFontSize(11)
    pdf.setTextColor('#94a3b8')
    pdf.text(subtitle, pageW / 2, pageH / 2 + 14, { align: 'center' })
  }
  const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  pdf.setFontSize(10)
  pdf.setTextColor('#cbd5e1')
  pdf.text(`Generado el ${dateStr}`, pageW / 2, pageH / 2 + 36, { align: 'center' })
}

// Captura cada sección del dashboard (por id) y arma un PDF apaisado
// con portada, encabezado de marca y pie de página, listo para presentar.
export async function exportFullReport({ subtitle, onProgress } = {}) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 32
  const contentTop = margin + 36
  const availW = pageW - margin * 2
  const availH = pageH - contentTop - margin

  drawCoverPage(pdf, pageW, pageH, subtitle)

  let pageNum = 2
  for (const [id, title] of SECTIONS) {
    const el = document.getElementById(id)
    if (!el) continue
    onProgress?.(title)

    pdf.addPage()
    drawHeader(pdf, pageW, margin, title)

    const native = NATIVE_RENDERERS[id]
    const ok = native && await native(pdf, el, margin, contentTop, availW, availH)
    if (ok === false || !native) await renderRasterSection(pdf, el, margin, contentTop, availW, availH)

    drawFooter(pdf, pageW, pageH, margin, pageNum)
    pageNum++
  }

  pdf.save(`reporte-mf-star-${new Date().toISOString().slice(0, 10)}.pdf`)
}
