const test = require('node:test');
const assert = require('node:assert');
const { buildInvoiceHTML, buildReceiptHTML } = require('./pdfGenerator');
const { LAYOUTS } = require('./layouts');
const { PATTERNS, patternSvg } = require('./patterns');

const doc = (extra = {}) => ({
  template_company_name: 'ACME d.o.o.',
  template_bank_account: '1320202029686054',
  template_primary_color: '#F97316',
  invoice_number: 'INV-1',
  receipt_number: 'RCP-1',
  date: '2026-01-02',
  currency: 'EUR',
  vat_rate: 0,
  total: 500,
  client_company_name: 'Client <script>alert(1)</script>',
  line_items: [{ description: 'Work <b>bold</b>', unit_price: 500, quantity: 1, total: 500 }],
  ...extra
});

const builds = [['invoice', buildInvoiceHTML], ['receipt', buildReceiptHTML]];

test('every layout renders both document types, in color and B&W, with input escaped', async () => {
  for (const layout of Object.keys(LAYOUTS)) {
    for (const [type, build] of builds) {
      for (const bw of [false, true]) {
        const html = await build(doc({ [`template_${type}_layout`]: layout, template_pattern: 'constellation' }), { bw });
        const where = `${layout}/${type}/bw=${bw}`;
        assert.ok(html.includes('Work &lt;b&gt;bold&lt;/b&gt;'), where);
        assert.ok(!html.includes('<script>'), where);
        assert.ok(html.includes('<svg'), `${where}: pattern layer`);
      }
    }
  }
});

test('non-hex colors never reach the page', async () => {
  const evil = 'red;}</style><img src=x onerror=alert(1)>';
  for (const [, build] of builds) {
    const html = await build(doc({ template_primary_color: evil, template_background_color: evil, template_pattern_color: evil, template_pattern: 'dots' }));
    assert.ok(!html.includes('onerror'));
  }
});

test('dark background switches to light text; B&W forces white paper and gray pattern', async () => {
  const dark = doc({ template_background_color: '#111111', template_invoice_layout: 'modern', template_pattern: 'dots' });
  assert.ok((await buildInvoiceHTML(dark)).includes('--fg: #f3f4f6'));
  const bw = await buildInvoiceHTML(dark, { bw: true });
  assert.ok(bw.includes('html { background: #ffffff'));
  assert.ok(bw.includes('color="#c4c4c4"'));
  assert.ok(bw.includes('img { filter: grayscale(1); }'));
  assert.ok(bw.includes('--fill: transparent'));
});

test('unknown or prototype layout/pattern names fall back to classic and no pattern', async () => {
  for (const name of ['constructor', '__proto__', 'nope']) {
    const html = await buildInvoiceHTML(doc({ template_invoice_layout: name, template_pattern: name, template_pattern_placement: name }));
    assert.ok(html.includes('class="header"'), name); // classic invoice markup
    assert.ok(!html.includes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595'), name);
  }
});

test('every pattern draws something and constellation is deterministic', () => {
  for (const id of Object.keys(PATTERNS)) assert.ok(patternSvg(id, '#000000').length > 200, id);
  assert.strictEqual(patternSvg('constellation', '#000000'), patternSvg('constellation', '#000000'));
  assert.strictEqual(patternSvg('none', '#000000'), '');
});

test('documents follow the language: title, labels and the matching template VAT note', async () => {
  const notes = { template_vat_note_en: 'EN NOTE', template_vat_note_local: 'BS NOTE' };
  for (const layout of Object.keys(LAYOUTS)) {
    const extra = { template_invoice_layout: layout, template_receipt_layout: layout, ...notes };
    const bsInvoice = await buildInvoiceHTML(doc(extra), { lang: 'bs' });
    const enInvoice = await buildInvoiceHTML(doc(extra), { lang: 'en' });
    assert.ok(bsInvoice.includes('BS NOTE') && !bsInvoice.includes('EN NOTE'), layout);
    assert.ok(enInvoice.includes('EN NOTE') && !enInvoice.includes('BS NOTE'), layout);
    assert.ok(bsInvoice.includes('Broj fakture') && enInvoice.includes('Invoice No'), layout);
    if (layout !== 'classic') assert.ok(bsInvoice.includes('FAKTURA') && enInvoice.includes('INVOICE'), layout);
    assert.ok((await buildReceiptHTML(doc(extra), { lang: 'bs' })).includes('RAČUN'), layout);
    assert.ok((await buildReceiptHTML(doc(extra), { lang: 'en' })).includes('RECEIPT'), layout);
  }
});
