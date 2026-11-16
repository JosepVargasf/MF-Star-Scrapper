import PptxGenJS from 'pptxgenjs'
import logo from '../assets/insitu/logo.png?inline'
import iBuilding from '../assets/insitu/icon3.svg?raw'
import iChat from '../assets/insitu/icon4.svg?raw'
import iStar from '../assets/insitu/icon5.svg?raw'
import iThumb from '../assets/insitu/icon6.svg?raw'
import iCalendar from '../assets/insitu/icon7.svg?raw'

// Láminas "Estrellas" de INSITU: mismo formato que
// "0826 – Jose Pedro - Láminas Estrellas.pptx" (13.33 x 7.5), condensado a 6 láminas.
// Todo es nativo y editable en PowerPoint: gráficos, tablas, KPIs y bullets.

const RED = '800000', GREY = '5B727F', TXT = '262626', F = 'Calibri'
const PALETTE = ['96323C', '2D3334', 'D7A1A7', '5B6670', '800000', 'A26579', '51313C', '70262D', '444C54', '7A4C5B', 'C0848A', 'BDC1C5', 'E8C4C7', '3A4A52']
const svg = raw => 'data:image/svg+xml;base64,' + btoa(raw)

// ── helpers de datos ─────────────────────────────────────────────────────────
const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0)
const num = (v, d = 2) => String(Number(v.toFixed(d)))
const isInsitu = e => /^insitu/i.test(e)
const star = e => (isInsitu(e) ? `★ ${e}` : e)

function countBy(reviews, field, sent) {
  const c = {}
  for (const r of reviews) {
    if (sent && r.sentimiento !== sent) continue
    for (const t of r[field] ?? []) if (t !== 'Sin Comentario') c[t] = (c[t] ?? 0) + 1
  }
  return Object.entries(c).sort((a, b) => b[1] - a[1])
}

function gender(reviews) {
  let m = 0, f = 0, o = 0
  for (const r of reviews) {
    const s = r.sexo || ''
    if (s === 'female' || s === 'mostly_female') f++
    else if (s === 'male' || s === 'mostly_male') m++
    else o++
  }
  return { m, f, o, t: m + f + o }
}

function kpis(metrics) {
  const avg = k => { const v = metrics.filter(m => m[k] != null); return v.length ? v.reduce((a, m) => a + m[k], 0) / v.length : null }
  const rating = avg('calif_actual'), pos = avg('pos_pct')
  return [
    { icon: iBuilding, value: String(metrics.length), suffix: `de ${metrics.length}`, label: 'PROYECTOS' },
    { icon: iChat, value: metrics.reduce((a, m) => a + (m.resenastot ?? 0), 0).toLocaleString('es-CL'), label: 'RESEÑAS TOTALES' },
    { icon: iStar, value: rating == null ? '-' : rating.toFixed(2), suffix: '/5', label: 'RATING PROMEDIO' },
    { icon: iThumb, value: pos == null ? '-' : `${pos.toFixed(1)}%`, label: 'SENTIMIENTO POSITIVO' },
    { icon: iCalendar, value: metrics.reduce((a, m) => a + (m.nuevas_mes ?? 0), 0).toLocaleString('es-CL'), label: 'RESEÑAS ESTE MES' },
  ]
}

// "**negrita** normal" → runs de pptxgenjs
function runs(s) {
  return s.split('**').map((text, k) => ({ text, options: { bold: k % 2 === 1 } })).filter(r => r.text)
}
function bullets(items, header) {
  const out = header ? [{ text: header, options: { align: 'center', breakLine: true, bullet: false } }] : []
  for (const s of items) {
    const r = runs(s)
    r[0].options.bullet = { indent: 18 }
    r[r.length - 1].options.breakLine = true
    out.push(...r)
  }
  return out
}

// Líder del ranking + posición de cada edificio Insitu (formato de las láminas 2 y 5).
function rankLines(rows, val, lead, other) {
  const sorted = [...rows].sort((a, b) => val(b) - val(a))
  if (!sorted.length) return []
  const lines = [lead(sorted[0])]
  sorted.forEach((r, i) => { if (i > 0 && isInsitu(r.edificio)) lines.push(other(r, i + 1)) })
  return lines
}

// ── helpers de diseño ────────────────────────────────────────────────────────
function card(s, x, y, w, h, k) {
  s.addShape('roundRect', { x, y, w, h, rectRadius: 0.06, fill: { color: 'FFFFFF' }, line: { color: 'D9D9D9', width: 0.75 }, shadow: { type: 'outer', color: '000000', opacity: 0.1, blur: 3, offset: 1, angle: 90 } })
  s.addShape('roundRect', { x, y: y + 0.08, w: 0.06, h: 0.32, rectRadius: 0.03, fill: { color: RED }, line: { type: 'none' } })
  s.addImage({ data: svg(k.icon), x: x + 0.11, y: y + 0.095, w: 0.31, h: 0.31 })
  const tx = x + 0.44
  s.addText([
    { text: k.value, options: { bold: true, color: RED, fontSize: 10.5, breakLine: !k.suffix } },
    ...(k.suffix ? [{ text: ` ${k.suffix}`, options: { color: '595959', fontSize: 7, breakLine: true } }] : []),
    { text: k.label, options: { bold: true, color: '595959', fontSize: 7 } },
  ], { x: tx, y, w: w - (tx - x) - 0.05, h, fontFace: F, valign: 'middle', margin: 0 })
}

const STRIP = [[3.78, 1.17], [5.06, 1.4], [6.6, 1.4], [8.14, 1.69], [9.97, 1.46]]

function slide(pptx, title, fecha, ks) {
  const s = pptx.addSlide({ masterName: 'INSITU' })
  s.addText(title, { x: 0.21, y: 0.61, w: 3.6, h: 0.39, fontFace: F, fontSize: 16, color: GREY, margin: 0, fit: 'shrink' })
  ks.forEach((k, i) => card(s, STRIP[i][0], 0.42, STRIP[i][1], 0.5, k))
  s.addText([{ text: 'Fuente: Google ' }, { text: 'Reviews', options: { italic: true } }, { text: `, ${fecha}` }],
    { x: 0.26, y: 7.1, w: 5.48, h: 0.24, fontFace: F, fontSize: 8, color: '595959', margin: 0 })
  return s
}

function section(s, text, x, y, w) {
  s.addText(text, { x, y, w, h: 0.33, fontFace: F, fontSize: 14, bold: true, color: TXT, margin: 0 })
  s.addShape('line', { x, y: y + 0.36, w, h: 0, line: { color: RED, width: 2 } })
}

function box(s, items, x, y, w, h, header, fontSize = 14) {
  s.addText(bullets(items, header), {
    x, y, w, h, fontFace: F, fontSize, color: TXT, valign: 'middle', margin: [6, 10, 6, 10],
    fill: { color: 'F2F2F2' }, line: { color: 'BFBFBF', width: 0.75 }, paraSpaceAfter: 4,
  })
}

const ratingColor = r => (r >= 4.5 ? '96323C' : r >= 4 ? 'C0848A' : r >= 3.5 ? 'A26579' : '5B6670')
const sentColor = v => (v >= 80 ? '16A34A' : v >= 60 ? 'CA8A04' : 'DC2626')
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const COMUNAS_ORDEN = ['Las Condes', 'Providencia', 'Ñuñoa', 'Santiago']
const axis = (sz = 9) => ({ catAxisLabelFontFace: F, catAxisLabelFontSize: sz, catAxisLabelColor: '5B6670', valAxisLabelFontFace: F, valAxisLabelFontSize: 8, valAxisLabelColor: '5B6670', valGridLine: { color: 'E5E7EB', size: 0.5 }, catGridLine: { style: 'none' } })

// Ranking: tabla de métricas detalladas con posición
function metricasTabla(s, rows, x, y, w) {
  const hd = (t, a = 'center') => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: '96323C' }, align: a } })
  const fx = v => (v == null ? '—' : v.toFixed(2))
  const vari = v => {
    if (v == null) return { text: '—', options: {} }
    const up = v > 0.01, dn = v < -0.01
    return { text: `${up ? '+' : dn ? '−' : ''}${Math.abs(v).toFixed(2)}`, options: { bold: true, color: up ? '16A34A' : dn ? 'DC2626' : '94A3B8' } }
  }
  s.addTable([
    [hd('#'), hd('EDIFICIO', 'left'), hd('RATING'), hd('MES ANT.'), hd('VARIACIÓN'), hd('RESEÑAS'), hd('NUEVAS'), hd('% POS.'), hd('% NEG.')],
    ...rows.map((m, i) => {
      const fill = { color: isInsitu(m.edificio) ? 'F3DDDF' : i % 2 ? 'F8FAFC' : 'FFFFFF' }
      const c = (t, o = {}) => ({ text: String(t), options: { fill, align: 'center', ...o } })
      const v = vari(m.variacion)
      return [
        c(`${i + 1}º`, { bold: true, color: RED }), c(m.edificio, { align: 'left', bold: true }), c(fx(m.calif_actual), { bold: true, color: ratingColor(m.calif_actual) }), c(fx(m.calif_previo), { color: '94A3B8' }),
        c(v.text, v.options), c(m.resenastot ?? '—'), c(m.nuevas_mes ?? '—'),
        c(m.pos_pct != null ? `${m.pos_pct.toFixed(1)}%` : '—', { color: '16A34A', bold: true }), c(m.neg_pct != null ? `${m.neg_pct.toFixed(1)}%` : '—', { color: 'DC2626', bold: true }),
      ]
    }),
  ], { x, y, w, colW: [0.45, 2.45, 0.85, 0.85, 1.0, 0.85, 0.75, 1.05, 1.05].map(v => (v * w) / 9.3), rowH: Math.min(0.22, 5.8 / (rows.length + 1)), fontFace: F, fontSize: 8, color: TXT, margin: [0, 0.05, 0, 0.05], valign: 'middle', border: { type: 'solid', pt: 0.5, color: 'E5E7EB' } })
}

// Sentimiento por comuna: tablas con la comuna en celda combinada (rowspan)
function valoracionTablas(s, metrics, comunaDe, x, y, w) {
  const by = {}
  for (const m of metrics) if (m.pos_pct != null) (by[comunaDe[m.edificio] ?? 'Sin comuna'] ??= []).push(m)
  const groups = [...COMUNAS_ORDEN.filter(c => by[c]), ...Object.keys(by).filter(c => !COMUNAS_ORDEN.includes(c)).sort()]
    .map(c => ({ c, rows: by[c].sort((a, b) => b.pos_pct - a.pos_pct) }))
  // dos tablas lado a lado, repartiendo comunas completas para equilibrar filas
  const half = Math.ceil(groups.reduce((a, g) => a + g.rows.length, 0) / 2)
  const cols = [[], []]
  let n = 0
  for (const g of groups) {
    if (cols[1].length || (n && n + g.rows.length / 2 > half)) cols[1].push(g)
    else { cols[0].push(g); n += g.rows.length }
  }
  const hd = (t, a = 'center') => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: '96323C' }, align: a } })
  const gap = 0.3, tw = (w - gap) / 2
  const maxRows = Math.max(...cols.map(cg => cg.reduce((a, g) => a + g.rows.length, 0)))
  cols.forEach((cg, k) => {
    if (!cg.length) return
    const body = cg.flatMap(g => g.rows.map((m, i) => {
      const fill = { color: isInsitu(m.edificio) ? 'F3DDDF' : 'FFFFFF' }
      const c = (t, o = {}) => ({ text: String(t), options: { fill, align: 'center', ...o } })
      return [
        ...(i === 0 ? [{ text: g.c, options: { rowspan: g.rows.length, bold: true, fill: { color: 'F2F2F2' }, align: 'center', valign: 'middle' } }] : []),
        c(`${i + 1}º`, { bold: true, color: RED }), c(star(m.edificio), { align: 'left', bold: isInsitu(m.edificio) }), c(m.resenastot ?? '—'),
        c(`${m.pos_pct.toFixed(1)}%`, { bold: true, color: sentColor(m.pos_pct) }), c(m.neg_pct != null ? `${m.neg_pct.toFixed(1)}%` : '—', { color: '5B6670' }),
      ]
    }))
    s.addTable([[hd('COMUNA'), hd('#'), hd('EDIFICIO', 'left'), hd('RESEÑAS'), hd('% POS.'), hd('% NEG.')], ...body], {
      x: x + k * (tw + gap), y, w: tw, colW: [1.2, 0.4, 2.3, 0.8, 0.8, 0.8].map(v => (v * tw) / 6.3), rowH: Math.min(0.3, 4.2 / (maxRows + 1)),
      fontFace: F, fontSize: 9, color: TXT, margin: [0, 0.05, 0, 0.05], valign: 'middle', border: { type: 'solid', pt: 0.5, color: 'D9D9D9' },
    })
  })
}

// Lámina 6: rating acumulado mes a mes de los edificios Insitu (o los 4 con más reseñas) + tarjetas
function evolucionChart(pptx, s, reviews, metrics, x, y, w, h) {
  const by = {}
  for (const r of reviews) {
    if (!r.fecha || !r.score || !r.edificio) continue
    ;((by[r.edificio] ??= {})[r.fecha.slice(0, 7)] ??= []).push(r.score)
  }
  const all = Object.keys(by)
  const ins = all.filter(isInsitu).sort()
  const eds = ins.length ? ins : all.sort((a, b) => Object.keys(by[b]).length - Object.keys(by[a]).length).slice(0, 4)
  if (!eds.length) return
  const meses = [...new Set(eds.flatMap(e => Object.keys(by[e])))].sort()
  const labels = meses.map(m => `${MESES[+m.slice(5) - 1]}-${m.slice(2, 4)}`)
  const cols = ['96323C', '5B6670', 'D7A1A7', '2D3334']
  const series = eds.map(e => {
    let sum = 0, n = 0
    return { name: e, labels, values: meses.map(m => { const sc = by[e][m] ?? []; sum += sc.reduce((a, b) => a + b, 0); n += sc.length; return n ? +(sum / n).toFixed(2) : null }) }
  })
  const chartH = h - 1.15
  s.addChart(pptx.charts.LINE, series, {
    x, y, w, h: chartH, titleFontFace: F, chartColors: cols, lineSize: 2.5, lineDataSymbolSize: 6, valAxisMinVal: 1, valAxisMaxVal: 5, valAxisMajorUnit: 1, valAxisLabelFormatCode: '0',
    displayBlanksAs: 'gap', showLegend: true, legendPos: 't', legendFontFace: F, legendFontSize: 10, legendColor: TXT, ...axis(8),
  })
  const rank = metrics.filter(m => m.calif_actual != null).sort((a, b) => b.calif_actual - a.calif_actual)
  const cw = (w - 0.2 * (series.length - 1)) / series.length
  series.forEach((sr, i) => {
    const m = metrics.find(q => q.edificio === sr.name) ?? {}
    const d = m.variacion ?? 0, p = rank.indexOf(m) + 1
    const f2 = v => (v == null ? '—' : v.toFixed(2))
    const cx = x + i * (cw + 0.2), c = cols[i % cols.length]
    s.addShape('line', { x: cx, y: y + chartH + 0.05, w: cw, h: 0, line: { color: c, width: 1.5 } })
    s.addText(sr.name, { x: cx, y: y + chartH + 0.1, w: cw, h: 0.25, fontFace: F, fontSize: 10, bold: true, color: c, margin: 0 })
    ;[
      ['Rating actual', f2(m.calif_actual), TXT],
      ['Δ vs mes anterior', `${d > 0.004 ? '+' : d < -0.004 ? '−' : ''}${Math.abs(d).toFixed(2)}`, d > 0.004 ? '16A34A' : d < -0.004 ? 'DC2626' : TXT],
      ['Ranking portafolio', p ? `${p}º/${rank.length}` : '—', TXT],
      ['Sentimiento positivo', m.pos_pct != null ? `${m.pos_pct.toFixed(1)}%` : '—', m.pos_pct != null ? sentColor(m.pos_pct) : TXT],
      ['Reseñas (nuevas mes)', `${m.resenastot ?? '—'} (+${m.nuevas_mes ?? 0})`, TXT],
    ].forEach(([l, val, col], k) => {
      const tx = cx + k * (cw / 5)
      s.addText(val, { x: tx, y: y + chartH + 0.38, w: cw / 5, h: 0.3, fontFace: F, fontSize: 14, bold: true, color: col, margin: 0 })
      s.addText(l, { x: tx, y: y + chartH + 0.68, w: cw / 5, h: 0.2, fontFace: F, fontSize: 8, color: '94A3B8', margin: 0 })
    })
  })
}

// Lámina 7: tabla resumen por comuna
function comunasTabla(s, rows, x, y, w) {
  const hd = (t, a = 'center') => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: '96323C' }, align: a } })
  s.addTable([
    [hd('COMUNA', 'left'), hd('PROYECTOS'), hd('RESEÑAS TOTALES'), hd('RATING PROMEDIO'), hd('% POS.'), hd('NUEVAS MES')],
    ...rows.map((r, i) => {
      const fill = { color: i % 2 ? 'F8FAFC' : 'FFFFFF' }
      const c = (t, o = {}) => ({ text: String(t), options: { fill, align: 'center', ...o } })
      return [
        c(r.c, { align: 'left', bold: true }), c(r.n), c(r.vol.toLocaleString('es-CL')),
        c(r.rating.toFixed(2), { bold: true, color: ratingColor(r.rating) }), c(`${r.pos.toFixed(1)}%`, { bold: true, color: sentColor(r.pos) }), c(r.mes),
      ]
    }),
  ], { x, y, w, colW: [2.6, 1.6, 2.3, 2.1, 2.4, 1.81].map(v => (v * w) / 12.81), rowH: 0.3, fontFace: F, fontSize: 9, color: TXT, margin: [0, 0.05, 0, 0.05], valign: 'middle', border: { type: 'solid', pt: 0.5, color: 'D9D9D9' } })
}

function donut(pptx, s, items, x, y, w, h, colors = PALETTE) {
  if (!items.length) return
  const top = items.slice(0, 14)
  const rest = items.slice(14).reduce((a, [, v]) => a + v, 0)
  if (rest) top.push(['Resto', rest])
  s.addChart(pptx.charts.DOUGHNUT, [{ name: 'Menciones', labels: top.map(i => i[0]), values: top.map(i => i[1]) }], {
    x, y, w, h, holeSize: 55, titleFontFace: F, chartColors: colors, showPercent: true, showLabel: false, showValue: false, dataLabelFormatCode: '[<0.04]"";0%',
    dataLabelColor: 'FFFFFF', dataLabelFontSize: 9, dataLabelFontBold: true, dataLabelFontFace: F,
    showLegend: true, legendPos: 'r', legendFontFace: F, legendFontSize: 10, legendColor: TXT,
    dataBorder: { pt: 1, color: 'FFFFFF' },
  })
}

// Tabla Tema | Pos. | Neg. | Total
function tabla(s, reviews, field, n, x, y, w) {
  const pos = Object.fromEntries(countBy(reviews, field, 'Positiva'))
  const neg = Object.fromEntries(countBy(reviews, field, 'Negativa'))
  const rows = countBy(reviews, field).slice(0, n)
  const hd = (t, a = 'right') => ({ text: t, options: { bold: true, color: GREY, align: a, fontSize: 8 } })
  const cell = (t, o = {}) => ({ text: String(t), options: { align: 'right', ...o } })
  s.addTable([
    [hd('TEMA', 'left'), hd('POS.'), hd('NEG.'), hd('TOTAL')],
    ...rows.map(([t, v]) => [{ text: t, options: { align: 'left' } }, cell(pos[t] ?? 0, { color: RED, bold: true }), cell(neg[t] ?? 0, { color: '5B6670', bold: true }), cell(v)]),
  ], { x, y, w, colW: [w - 2.1, 0.7, 0.7, 0.7], rowH: 0.19, fontFace: F, fontSize: 9, color: TXT, margin: [0, 0.05, 0, 0.05], valign: 'middle', border: { type: 'solid', pt: 0.5, color: 'E5E7EB' } })
}

// ── deck ─────────────────────────────────────────────────────────────────────
export async function buildDeck({ metrics, reviews }) {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'INSITU', width: 13.33, height: 7.5 })
  pptx.layout = 'INSITU'
  pptx.theme = { headFontFace: F, bodyFontFace: F }
  pptx.defineSlideMaster({
    title: 'INSITU',
    background: { color: 'FFFFFF' },
    objects: [
      { text: { text: 'Documento Privado y Estrictamente Confidencial', options: { x: 0.31, y: 0.02, w: 9.77, h: 0.39, fontFace: F, fontSize: 10, bold: true, color: RED, margin: 0 } } },
      { line: { x: 0.26, y: 1.15, w: 12.81, h: 0, line: { color: RED, width: 2.25 } } },
      { image: { x: 11.59, y: 0.38, w: 1.51, h: 0.62, data: logo } },
    ],
    slideNumber: { x: 9.93, y: 7.08, w: 3.15, h: 0.27, align: 'right', fontFace: F, fontSize: 9, color: '595959' },
  })

  const fecha = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) // fecha de exportación
  const ks = kpis(metrics)
  const comunaDe = {}
  for (const r of reviews) if (r.edificio && r.comuna) comunaDe[r.edificio] = r.comuna
  const mk = t => slide(pptx, t, fecha, ks)

  const calif = metrics.filter(m => m.calif_actual != null)
  const posi = metrics.filter(m => m.pos_pct != null)

  // 1 · Ranking (tabla con posición)
  let s = mk('Ranking de Edificios')
  metricasTabla(s, [...calif].sort((a, b) => b.calif_actual - a.calif_actual), 0.26, 1.25, 9.3)
  box(s, rankLines(calif, m => m.calif_actual,
    m => `**${m.edificio}** **lidera** las reseñas con un promedio de **${num(m.calif_actual)}/5**.`,
    (m, p) => `**${m.edificio}** se encuentra en la **${p}ª posición** con un promedio de **${num(m.calif_actual)}/5**.`),
  9.87, 1.31, 3.26, 2.9, `Al ${fecha}`, 11)

  // 3 · Amenities y temas de reseñas realizadas
  const pos = countBy(reviews, 'temas', 'Positiva'), neg = countBy(reviews, 'temas', 'Negativa'), amen = countBy(reviews, 'amenidades')
  const n = (a, i) => (a[i] ? `**${a[i][0]}**` : '')
  const lista = (a, k) => { const v = a.slice(0, k).map((_, i) => n(a, i)); return v.length > 1 ? `${v.slice(0, -1).join(', ')} y ${v.at(-1)}` : v[0] ?? '' }
  s = mk('Temas y Amenities Mencionados')
  box(s, [
    pos.length > 1 && `${lista(pos, 2)} lideran los aspectos más valorados.`,
    neg.length && `${lista(neg, 4)} son los temas que peor sentimiento tienen.`,
    amen.length && `El ${n(amen, 0)} lidera las menciones en los amenities${amen.length > 1 ? `, seguido por ${lista(amen.slice(1), 2)}` : ''}.`,
  ].filter(Boolean), 0.27, 1.63, 6.14, 2.37, null, 14)
  section(s, 'Amenities mencionados en Reseñas Realizadas', 0.27, 4.08, 6.14)
  donut(pptx, s, amen, 0.27, 4.5, 6.14, 2.55)
  section(s, 'Amenities mencionados en Reseñas Realizadas', 6.75, 1.2, 5.67)
  tabla(s, reviews, 'amenidades', 9, 6.75, 1.7, 5.67)
  section(s, 'Temas de Reseñas Realizadas', 6.78, 4.08, 5.67)
  tabla(s, reviews, 'temas', 12, 6.75, 4.52, 5.67)

  // 4 · Temas positivos / negativos / género
  const g = gender(reviews)
  const tp = pos.reduce((a, [, v]) => a + v, 0), tn = neg.reduce((a, [, v]) => a + v, 0)
  const top3 = (a, t) => a.slice(0, 3).map(([k, v]) => `**${k}** (${pct(v, t)}%)`)
  s = mk('Temas Positivos, Negativos y Género')
  box(s, [
    pos.length && `Los temas más mencionados en reseñas positivas son ${top3(pos, tp).join(', ')}.`,
    neg.length && `${n(neg, 0)} (${pct(neg[0][1], tn)}%) encabeza los temas negativos${neg.length > 2 ? `, seguido de ${top3(neg.slice(1), tn).slice(0, 2).join(' y ')}` : ''}.`,
    g.t && `El **${pct(g.m, g.t)}%** de las reseñas provienen de **hombres** y el **${pct(g.f, g.t)}%** de **mujeres**, con un ${pct(g.o, g.t)}% sin clasificar.`,
  ].filter(Boolean), 0.27, 1.66, 6.14, 2.36, null, 14)
  section(s, 'Temas de Reseñas Positivas', 6.75, 1.26, 6.31)
  donut(pptx, s, pos, 6.75, 1.7, 6.31, 2.3)
  section(s, 'Géneros por Reseñas Realizadas', 0.3, 4.04, 6.11)
  donut(pptx, s, [['Hombre', g.m], ['Mujer', g.f], ['Sin clasificar', g.o]], 0.3, 4.45, 6.11, 2.55, ['5B6670', 'A26579', 'BDC1C5'])
  section(s, 'Temas de Reseñas Negativas', 6.75, 4.08, 6.31)
  donut(pptx, s, neg, 6.75, 4.5, 6.31, 2.55)

  // 4 · Sentimiento por comuna y edificio
  s = mk('Sentimiento por Comuna')
  box(s, rankLines(posi, m => m.pos_pct,
    m => `**${m.edificio}** **lidera** el portafolio completo con **${Math.round(m.pos_pct)}%** de sentimiento positivo${comunaDe[m.edificio] ? ` en **${comunaDe[m.edificio]}**` : ''}.`,
    (m, p) => {
      const c = comunaDe[m.edificio]
      const rk = posi.filter(o => comunaDe[o.edificio] === c && o.pos_pct > m.pos_pct).length + 1
      return `**${m.edificio}** alcanza **${Math.round(m.pos_pct)}%** (puesto **${p}º** del portafolio, **${rk}º** en ${c ?? 'su comuna'}).`
    }),
  0.25, 1.21, 12.81, 0.95, null, 12)
  section(s, 'Sentimiento positivo por edificio, agrupado por comuna', 0.26, 2.18, 12.82)
  valoracionTablas(s, metrics, comunaDe, 0.26, 2.65, 12.81)

  // 6 · Evolución estrellas
  const evo = metrics.filter(m => isInsitu(m.edificio) && m.calif_actual != null).map(m => {
    const v = m.variacion ?? 0
    const mov = v > 0 ? `subiendo **${num(v)}** en el último mes` : v < 0 ? `bajando **${num(-v)}** en el último mes` : 'sin variación en el último mes'
    return `**${m.edificio}** mantiene un rating de **${num(m.calif_actual)}**${comunaDe[m.edificio] ? ` en **${comunaDe[m.edificio]}**` : ''}, ${mov}.`
  })
  s = mk('Evolución Estrellas Edificios')
  box(s, evo.length ? evo : [`El rating promedio del portafolio es **${num(calif.reduce((a, m) => a + m.calif_actual, 0) / (calif.length || 1))}**.`], 0.25, 1.21, 12.81, 0.94, null, 14)
  section(s, 'Evolución Estrellas Edificios', 0.26, 2.16, 12.81)
  evolucionChart(pptx, s, reviews, metrics, 0.25, 2.65, 12.81, 4.4)

  // 7 · Promedios por comunas
  const comunas = [...new Set(Object.values(comunaDe))].map(c => {
    const ms = metrics.filter(m => comunaDe[m.edificio] === c)
    const av = k => { const v = ms.filter(m => m[k] != null); return v.length ? v.reduce((a, m) => a + m[k], 0) / v.length : 0 }
    return { c, rating: av('calif_actual'), pos: av('pos_pct'), vol: ms.reduce((a, m) => a + (m.resenastot ?? 0), 0) }
  })
  const byRating = [...comunas].sort((a, b) => b.rating - a.rating)
  const topVol = [...comunas].sort((a, b) => b.vol - a.vol).find(x => x !== byRating[0])
  const low = byRating.at(-1)
  const line = (x, lead) => `**${x.c}** ${lead} un **promedio** de **${num(x.rating)}** y **${x.pos.toFixed(1)}%** de sentimiento positivo.`
  s = mk('Promedios por comunas')
  box(s, byRating.length ? [
    line(byRating[0], 'lidera con'),
    topVol && `**${topVol.c}** concentra el **mayor volumen de reseñas** con un **promedio de ${num(topVol.rating)}** y **${topVol.pos.toFixed(1)}%** de sentimiento positivo.`,
    low !== byRating[0] && low !== topVol && line(low, 'presenta'),
  ].filter(Boolean) : [], 0.25, 1.21, 12.81, 0.94, null, 14)
  section(s, 'Promedio de estrellas por Comuna', 0.26, 2.23, 12.81)
  const filas = [...COMUNAS_ORDEN.filter(c => comunas.some(x => x.c === c)), ...comunas.map(x => x.c).filter(c => !COMUNAS_ORDEN.includes(c)).sort()].map(c => ({
    ...comunas.find(x => x.c === c), n: new Set(metrics.filter(m => comunaDe[m.edificio] === c).map(m => m.edificio)).size,
    mes: metrics.filter(m => comunaDe[m.edificio] === c).reduce((a, m) => a + (m.nuevas_mes ?? 0), 0),
  }))
  comunasTabla(s, filas, 0.26, 2.7, 12.81)

  return pptx
}

export async function exportLaminasInsitu({ metrics, reviews }) {
  const pptx = await buildDeck({ metrics, reviews })
  await pptx.writeFile({ fileName: `Láminas Estrellas ${new Date().toISOString().slice(0, 10)}.pptx` })
}
