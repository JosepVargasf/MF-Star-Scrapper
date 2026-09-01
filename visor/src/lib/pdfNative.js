import autoTable from 'jspdf-autotable'
import { svg2pdf } from 'svg2pdf.js'
import { BRAND } from './reportSections'

function parseRgb(cssColor) {
  const m = (cssColor || '').match(/\d+/g)
  return m ? [+m[0], +m[1], +m[2]] : null
}

function rgbOf(el) {
  return parseRgb(getComputedStyle(el).backgroundColor)
}

// Cualquier <table> HTML (Métricas, Resumen por comuna, Heatmap) se vuelca
// como tabla PDF nativa: texto real seleccionable, no una foto de la tabla.
// withCellColor=true además copia el color de fondo de cada <td> (heatmap).
export function renderTable(pdf, tableEl, x, y, availW, availH, { withCellColor = false, fontSize = 8 } = {}) {
  const head = [[...tableEl.querySelectorAll('thead th')].map(th => th.textContent.trim())]
  const rows = [...tableEl.querySelectorAll('tbody tr')]
  const body = rows.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()))

  autoTable(pdf, {
    head, body,
    startY: y,
    margin: { left: x, right: pdf.internal.pageSize.getWidth() - x - availW },
    tableWidth: availW,
    styles: { fontSize, cellPadding: 4, textColor: '#1e293b', lineColor: '#e2e8f0', lineWidth: 0.5 },
    headStyles: { fillColor: BRAND, textColor: '#ffffff', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#f8fafc' },
    didParseCell(data) {
      if (!withCellColor || data.section !== 'body') return
      const td = rows[data.row.index]?.querySelectorAll('td')[data.column.index]
      if (!td) return
      const rgb = rgbOf(td)
      if (rgb) { data.cell.styles.fillColor = rgb; data.cell.styles.textColor = '#1e293b' }
    },
  })
}

// Fila de KPIs: 5 tarjetas (ícono + valor + label) leídas del DOM y
// redibujadas como texto + rectángulo nativos.
export function renderKpiRow(pdf, el, x, y, availW, availH) {
  const cards = [...el.querySelectorAll('.kpi-card')]
  if (!cards.length) return
  const gap = 10
  const w = (availW - gap * (cards.length - 1)) / cards.length
  cards.forEach((card, i) => {
    const cx = x + i * (w + gap)
    const value = card.querySelector('.kpi-value')?.textContent?.trim() ?? ''
    const label = card.querySelector('.kpi-label')?.textContent?.trim() ?? ''
    pdf.setFillColor(BRAND)
    pdf.rect(cx, y, 3, availH, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor('#0f172a')
    pdf.text(value, cx + 12, y + availH / 2 - 4)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor('#64748b')
    pdf.text(label.toUpperCase(), cx + 12, y + availH / 2 + 12, { maxWidth: w - 16 })
  })
}

// Listas tipo "ranking de temas" (barra proporcional + conteos), usadas en
// Temas Más Relevantes y Sentimiento por Tema. Se leen los <div ...row>
// del DOM (label, ancho de barra en %, conteos) y se redibujan como
// rectángulos + texto nativos en vez de rasterizar la tabla.
export function renderBarRows(pdf, rowEls, x, y, availW, rowH, { barColor = BRAND, labelWidth = 140, countWidth = 40 } = {}) {
  const barX = x + labelWidth
  const barW = availW - labelWidth - countWidth
  rowEls.forEach((row, i) => {
    const ry = y + i * rowH
    const label = row.querySelector('[class*="label"]')?.textContent?.trim() ?? ''
    const countEl = row.querySelector('[class*="total"], [class*="count"]')
    const count = countEl?.textContent?.trim() ?? ''
    const barFillEl = row.querySelector('[class*="bar"][style*="width"], [class*="seg"][style*="width"]')
    const pct = barFillEl ? parseFloat(barFillEl.style.width) || 0 : 0

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor('#334155')
    pdf.text(label, x, ry + rowH / 2, { maxWidth: labelWidth - 8 })

    pdf.setFillColor('#f1f5f9')
    pdf.roundedRect(barX, ry + rowH / 2 - 3, barW, 6, 1, 1, 'F')
    if (pct > 0) {
      pdf.setFillColor(barColor)
      pdf.roundedRect(barX, ry + rowH / 2 - 3, Math.max(2, barW * pct / 100), 6, 1, 1, 'F')
    }

    pdf.setTextColor('#0f172a')
    pdf.text(count, barX + barW + 6, ry + rowH / 2 + 3)
  })
}

// Un gráfico Recharts renderiza el gráfico Y, aparte, un <svg> chiquito
// por cada ícono de su leyenda — hay que distinguir "el gráfico" (el svg
// más grande) de esos íconos, o el detector de "un solo svg" nunca calza.
function mainChartSvg(container) {
  let best = null, bestArea = 0
  for (const svg of container.querySelectorAll('svg')) {
    const r = svg.getBoundingClientRect()
    const area = r.width * r.height
    if (area > bestArea) { best = svg; bestArea = area }
  }
  return best
}

// La leyenda de Recharts vive fuera del <svg>, como HTML — se lee tal cual
// (texto + color de cada ítem) para redibujarla nativa junto al vector.
function readLegend(container) {
  return [...container.querySelectorAll('.recharts-legend-item')].map(li => {
    const icon = li.querySelector('.recharts-legend-icon')
    const color = icon ? (icon.getAttribute('fill') === 'none' ? icon.getAttribute('stroke') : icon.getAttribute('fill')) : null
    return { text: li.querySelector('.recharts-legend-item-text')?.textContent?.trim() ?? '', color: color || '#94a3b8' }
  })
}

// Los donuts dibujan su número central como un <div> HTML posicionado
// encima del svg (no es parte del gráfico) — se lee su texto y su
// posición relativa al svg para reponerlo como texto nativo.
function readOverlayLabel(container, svg) {
  const svgRect = svg.getBoundingClientRect()
  const overlay = [...container.querySelectorAll(':scope > div > div[style*="position: absolute"], :scope div[style*="position:absolute"]')]
    .find(d => d.textContent.trim() && !d.querySelector('svg'))
  if (!overlay) return null
  const r = overlay.getBoundingClientRect()
  return {
    lines: (overlay.innerText || overlay.textContent).split('\n').map(s => s.trim()).filter(Boolean),
    relX: (r.left + r.width / 2 - svgRect.left) / svgRect.width,
    relY: (r.top + r.height / 2 - svgRect.top) / svgRect.height,
  }
}

function drawLegendRow(pdf, legend, x, y, availW) {
  pdf.setFontSize(6.5)
  let lx = x
  const maxX = x + availW
  for (const item of legend) {
    const w = pdf.getTextWidth(item.text) + 14
    if (lx + w > maxX) { lx = x; y += 9 }
    const isRgbString = typeof item.color === 'string' && item.color.startsWith('rgb')
    const rgb = Array.isArray(item.color) ? item.color : isRgbString ? parseRgb(item.color) : null
    if (rgb) pdf.setFillColor(...rgb); else pdf.setFillColor(item.color)
    pdf.rect(lx, y - 4, 5, 5, 'F')
    pdf.setTextColor('#475569')
    pdf.text(item.text, lx + 7, y)
    lx += w
  }
}

// Leyenda HTML fija (no generada por Recharts, p.ej. ".legend-dot" +
// ".legend-label" en Clasificación por Comuna) — se lee y redibuja igual
// que una leyenda de Recharts.
export function drawStaticLegend(pdf, container, dotSelector, labelSelector, x, y, availW) {
  const dots = [...container.querySelectorAll(dotSelector)]
  const legend = dots.map(dot => ({
    color: getComputedStyle(dot).backgroundColor,
    text: dot.nextElementSibling?.matches(labelSelector) ? dot.nextElementSibling.textContent.trim() : '',
  })).filter(item => item.text)
  if (legend.length) drawLegendRow(pdf, legend, x, y, availW)
  return legend.length ? 16 : 0
}

// Incrusta el gráfico principal de un contenedor como vector, más su
// leyenda (si tiene) redibujada como texto nativo al pie.
export async function renderChartWithLegend(pdf, container, x, y, w, h) {
  const svg = mainChartSvg(container)
  if (!svg) return false
  const legend = readLegend(container)
  const legendH = legend.length ? 12 : 0
  const rect = svg.getBoundingClientRect()
  if (!rect.width || !rect.height) return false
  const chartH = h - legendH
  const scale = Math.min(w / rect.width, chartH / rect.height, 1.4)
  const cw = rect.width * scale, ch = rect.height * scale
  const cx = x + (w - cw) / 2, cy = y + (chartH - ch) / 2
  await svg2pdf(svg, pdf, { x: cx, y: cy, width: cw, height: ch })

  const overlay = readOverlayLabel(container, svg)
  if (overlay) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor('#2D3334')
    pdf.text(overlay.lines.join('\n'), cx + overlay.relX * cw, cy + overlay.relY * ch, { align: 'center' })
  }

  if (legend.length) drawLegendRow(pdf, legend, x, y + chartH + 10, w)
  return true
}

// Grilla de N paneles, cada uno con título + un gráfico (+ leyenda/overlay
// si tiene) — Clasificación por Comuna, Evolución Estrellas, Tipos de
// Reseñas, Temas por Género. Cada panel se incrusta como vector real.
export async function renderChartPanels(pdf, el, x, y, availW, availH, { panelSelector, titleSelector, columns = 2 }) {
  const panels = [...el.querySelectorAll(panelSelector)]
  if (!panels.length) return false
  const cols = Math.min(columns, panels.length)
  const rows = Math.ceil(panels.length / cols)
  const gap = 14
  const cellW = (availW - gap * (cols - 1)) / cols
  const cellH = (availH - gap * (rows - 1)) / rows

  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i]
    const col = i % cols, row = Math.floor(i / cols)
    const cx = x + col * (cellW + gap)
    const cy = y + row * (cellH + gap)

    let chartTop = cy
    const titleText = panel.querySelector(titleSelector)?.textContent?.trim()
    if (titleText) {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor('#0f172a')
      pdf.text(titleText, cx, cy + 8, { maxWidth: cellW })
      chartTop = cy + 16
    }

    await renderChartWithLegend(pdf, panel, cx, chartTop, cellW, cellH - (chartTop - cy))
  }
  return true
}
