// Layouts shared by invoices and receipts. Each takes a document model (built in pdfGenerator.js)
// and returns { css, body, footer } for the page shell. Colors come from the theme's CSS variables,
// so the same markup works on light, dark and black & white pages.

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const lines = (arr) => arr.filter(Boolean).map(l => `<div>${esc(l)}</div>`).join('');
const party = (title, p) => `<div><div class="label">${esc(title)}</div><div class="name">${esc(p.name)}</div>${lines(p.lines)}</div>`;
const pairs = (rows) => `<table class="kv">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')}</table>`;
const logo = (m, cls = 'logo') => m.logo ? `<img class="${cls}" src="${m.logo}" alt="">` : '';

const itemsTable = (m) => {
  const cls = (i) => m.columns[i].num ? ' class="num"' : '';
  return `
  <table class="items">
    <thead><tr>${m.columns.map((c, i) => `<th${cls(i)}${c.width ? ` style="width: ${c.width}"` : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${m.rows.map(row => `<tr>${row.map((v, i) => `<td${cls(i)}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
};

const totals = (m) => `<table class="totals">${m.totals.map(([k, v], i) =>
  `<tr${i === m.totals.length - 1 ? ' class="grand"' : ''}><td>${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join('')}</table>`;

const extras = (m) => (m.notes.length || m.qr) ? `
  <div class="extras">
    <div class="notes">${m.notes.map(n => `<div class="label">${esc(n.title)}</div><p>${esc(n.text)}</p>`).join('')}</div>
    ${m.qr ? `<div class="qr">${m.qr.svg}<div>${esc(m.qr.caption)}</div></div>` : ''}
  </div>` : '';

const signatures = (m) => m.signatures ? `
  <div class="signatures">${m.signatures.map(s => `
    <div class="sig">
      <div class="sig-images">${s.images.map(src => `<img src="${src}" alt="">`).join('')}</div>
      <div class="sig-line">${esc(s.label)}</div>
    </div>`).join('')}
  </div>` : '';

const footer = (m) => m.footer.filter(Boolean).map(l => `<div>${esc(l)}</div>`).join('');

const BASE_CSS = `
  body { font-family: 'Open Sans', 'Liberation Sans', Arial, sans-serif; font-size: 9pt; line-height: 1.5; color: var(--fg); }
  .label { font-size: 7pt; font-weight: 700; letter-spacing: 1.2pt; text-transform: uppercase; color: var(--muted); margin-bottom: 3pt; }
  .name { font-weight: 700; }
  .num { text-align: right; white-space: nowrap; }
  table { border-collapse: collapse; }
  .kv td { padding: 0 10pt 1pt 0; vertical-align: top; }
  .kv .v { font-weight: 600; white-space: nowrap; }
  .logo { max-width: 150pt; max-height: 54pt; display: block; }
  .items { width: 100%; margin-top: 28pt; }
  .items th { text-align: left; font-size: 7pt; letter-spacing: 1pt; text-transform: uppercase; padding: 7pt 8pt; }
  .items td { padding: 8pt; vertical-align: top; }
  .items .num { text-align: right; }
  .items tr { page-break-inside: avoid; }
  .totals { margin: 14pt 0 0 auto; min-width: 230pt; }
  .totals td { padding: 4pt 8pt; }
  .totals .grand td { font-weight: 700; }
  .extras { display: flex; gap: 24pt; margin-top: 26pt; page-break-inside: avoid; }
  .notes { flex: 1; }
  .notes p { white-space: pre-line; margin-bottom: 10pt; }
  .qr { width: 92pt; text-align: center; font-size: 6.5pt; color: var(--muted); }
  .qr svg { width: 92pt; height: 92pt; display: block; background: #fff; padding: 5pt; margin-bottom: 3pt; }
  .signatures { display: flex; justify-content: space-between; margin-top: 34pt; page-break-inside: avoid; }
  .sig { width: 160pt; text-align: center; }
  .sig-images { height: 44pt; display: flex; justify-content: center; align-items: flex-end; }
  .sig-images img { max-height: 64pt; max-width: 90pt; margin-bottom: -10pt; }
  .sig-line { border-top: 0.75pt solid var(--muted); padding-top: 5pt; }
  .page-footer { text-align: center; font-size: 7pt; color: var(--muted); padding: 0 48pt 18pt; }
`;

// Modern: logo + company on top, full-bleed color band with the title, filled table header and total
const modern = (m) => ({
  css: BASE_CSS + `
    .page { padding: 40pt 48pt 64pt; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24pt; }
    .top > :first-child { flex: 1; }
    .company { text-align: right; }
    .company .name { font-size: 11pt; }
    .band {
      margin: 22pt -48pt 0; padding: 16pt 48pt;
      display: flex; justify-content: space-between; align-items: baseline;
      background: var(--fill); color: var(--on-fill); border-block: var(--fill-line);
    }
    .band .title { font-size: 24pt; font-weight: 700; letter-spacing: 4pt; line-height: 1.1; }
    .band .number { font-size: 11pt; font-weight: 600; letter-spacing: 1pt; }
    .parties { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20pt; margin-top: 24pt; }
    .parties .name { font-weight: 600; }
    .items th { background: var(--fill); color: var(--on-fill); border-bottom: var(--fill-line); }
    .items tbody td { border-bottom: 0.75pt solid var(--rule); }
    .items tbody tr:nth-child(even) td { background: var(--zebra); }
    .totals .grand td { background: var(--fill); color: var(--on-fill); border-top: var(--fill-line); font-size: 11pt; padding: 7pt 8pt; }
  `,
  body: `
    <div class="top">
      <div>${logo(m)}</div>
      <div class="company"><div class="name">${esc(m.company.name)}</div>${lines(m.company.lines)}</div>
    </div>
    <div class="band"><div class="title">${esc(m.title)}</div><div class="number">${esc(m.number)}</div></div>
    <div class="parties">
      ${party(m.labels.client, m.client)}
      <div><div class="label">${esc(m.labels.meta)}</div>${pairs(m.meta)}</div>
      <div><div class="label">${esc(m.labels.bank)}</div>${lines(m.bank)}</div>
    </div>
    ${itemsTable(m)}${totals(m)}${extras(m)}${signatures(m)}`,
  footer: footer(m)
});

// Minimal: light title with a short accent bar, hairlines only, oversized total in the accent color
const minimal = (m) => ({
  css: BASE_CSS + `
    .page { padding: 56pt 60pt 72pt; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; }
    .accent { width: 28pt; height: 3pt; background: var(--primary); margin-bottom: 14pt; }
    .title { font-size: 30pt; font-weight: 300; letter-spacing: 6pt; line-height: 1.1; }
    .number { color: var(--muted); letter-spacing: 1pt; margin-top: 6pt; }
    .logo { max-height: 40pt; }
    .parties { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24pt; margin-top: 40pt; padding-top: 18pt; border-top: 0.75pt solid var(--rule); }
    .items { margin-top: 36pt; }
    .items th { color: var(--muted); border-bottom: 0.75pt solid var(--fg); padding-left: 0; }
    .items td { border-bottom: 0.75pt solid var(--rule); padding-left: 0; }
    .items th:last-child, .items td:last-child { padding-right: 0; }
    .totals td { padding: 3pt 0 3pt 28pt; }
    .totals .grand td { font-size: 16pt; font-weight: 300; color: var(--primary); padding-top: 10pt; border-top: 0.75pt solid var(--fg); }
    .page-footer { text-align: left; padding: 0 60pt 22pt; }
  `,
  body: `
    <div class="head">
      <div><div class="accent"></div><div class="title">${esc(m.title)}</div><div class="number">${esc(m.number)}</div></div>
      ${logo(m)}
    </div>
    <div class="parties">
      ${party(m.labels.from, m.company)}
      ${party(m.labels.client, m.client)}
      <div><div class="label">${esc(m.labels.meta)}</div>${pairs(m.meta)}</div>
    </div>
    ${itemsTable(m)}${totals(m)}${extras(m)}${signatures(m)}`,
  footer: footer({ footer: [m.bank.filter(Boolean).join(' · '), ...m.footer] })
});

// Sidebar: tinted column with logo, company, bank and contact (fixed, so it repeats on every page)
const sidebar = (m) => ({
  css: BASE_CSS + `
    .page { padding: 48pt 40pt 56pt 210pt; }
    .side {
      position: fixed; top: 0; bottom: 0; left: 0; width: 170pt; padding: 48pt 20pt;
      background: var(--tint); border-right: 3pt solid var(--primary); font-size: 8pt;
    }
    .side .logo { max-width: 128pt; margin-bottom: 22pt; }
    .side .block { margin-bottom: 18pt; overflow-wrap: anywhere; }
    .title { font-size: 26pt; font-weight: 700; letter-spacing: 3pt; line-height: 1.1; color: var(--primary); }
    .number { color: var(--muted); font-weight: 600; letter-spacing: 1pt; margin-top: 4pt; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20pt; margin-top: 30pt; }
    .items th { color: var(--primary); border-bottom: 1.5pt solid var(--primary); padding-left: 0; }
    .items td { border-bottom: 0.75pt solid var(--rule); padding-left: 0; }
    .items th:last-child, .items td:last-child { padding-right: 0; }
    .totals td { padding: 4pt 0 4pt 24pt; }
    .totals .grand td { color: var(--primary); font-size: 12pt; border-top: 1.5pt solid var(--primary); padding-top: 7pt; }
  `,
  body: `
    <div class="side">
      ${logo(m)}
      <div class="block"><div class="name">${esc(m.company.name)}</div>${lines(m.company.lines)}</div>
      <div class="block"><div class="label">${esc(m.labels.bank)}</div>${lines(m.bank)}</div>
      <div class="block"><div class="label">${esc(m.labels.contact)}</div>${lines(m.contact)}</div>
    </div>
    <div class="title">${esc(m.title)}</div>
    <div class="number">${esc(m.number)}</div>
    <div class="parties">
      ${party(m.labels.client, m.client)}
      <div><div class="label">${esc(m.labels.meta)}</div>${pairs(m.meta)}</div>
    </div>
    ${itemsTable(m)}${totals(m)}${extras(m)}${signatures(m)}`
});

const LAYOUTS = {
  classic: { label: 'Classic', description: 'The original document design' },
  modern: { label: 'Modern', description: 'Color band header, filled table header and total', render: modern },
  minimal: { label: 'Minimal', description: 'Light type, hairlines and lots of whitespace', render: minimal },
  sidebar: { label: 'Sidebar', description: 'Company details in a tinted side column', render: sidebar }
};

module.exports = { LAYOUTS, esc };
