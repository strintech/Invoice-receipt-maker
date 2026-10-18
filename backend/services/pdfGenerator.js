const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { bihuppQrSvg } = require('./bihupp');
const { patternLayer } = require('./patterns');
const { LAYOUTS, esc } = require('./layouts');

const EUR_TO_BAM = 1.95583;
const CURRENCY_SYMBOLS = { EUR: '€', USD: '$', GBP: '£', BAM: 'KM' };

// Document text in the user's language (Settings). vatNote is the fallback for an empty template VAT note.
const TEXT = {
  bs: {
    invoice: 'FAKTURA', receipt: 'RAČUN', invoiceNo: 'Broj fakture', receiptNo: 'Broj računa', date: 'Datum',
    placeOfIssue: 'Mjesto izdavanja', paymentMethod: 'Način plaćanja', fiscalNo: 'Broj fiskalnog računa', contractNo: 'Broj ugovora',
    from: 'Izdavalac', client: 'Kupac', details: 'Detalji', bank: 'Banka', contact: 'Kontakt', address: 'Adresa', city: 'Grad',
    clientTaxId: 'JIB', vat: 'PDV', account: 'Tr. račun', description: 'Opis', unitPrice: 'Cijena', qty: 'Kol.', total: 'Ukupno',
    priceExVat: 'Cijena bez PDV', amountExVat: 'Iznos bez PDV', amountIncVat: 'Iznos sa PDV', vatInfo: 'Podaci o PDV',
    note: 'Napomena', scanToPay: 'Skenirajte za plaćanje', receivedBy: 'Zaprimio',
    vatNote: 'PDV nije obračunat jer društvo nije u sistemu PDV-a, u skladu sa Zakonom o PDV-u Bosne i Hercegovine.'
  },
  en: {
    invoice: 'INVOICE', receipt: 'RECEIPT', invoiceNo: 'Invoice No', receiptNo: 'Receipt No', date: 'Date',
    placeOfIssue: 'Place of issue', paymentMethod: 'Payment method', fiscalNo: 'Fiscal receipt No', contractNo: 'Contract No',
    from: 'From', client: 'Issued to', details: 'Details', bank: 'Bank', contact: 'Contact', address: 'Address', city: 'City',
    clientTaxId: 'UID', vat: 'VAT', account: 'Account', description: 'Description', unitPrice: 'Unit price', qty: 'Qty', total: 'Total',
    priceExVat: 'Price excl. VAT', amountExVat: 'Amount excl. VAT', amountIncVat: 'Amount incl. VAT', vatInfo: 'VAT information',
    note: 'Note', scanToPay: 'Scan to pay', receivedBy: 'Received by',
    vatNote: 'VAT is not calculated because the company is not registered in the VAT system according to Article 57, Paragraph 1 of the VAT Law.'
  }
};
const textFor = (lang) => TEXT[lang === 'bs' ? 'bs' : 'en'];

// "2025-12-03" -> "03.12.2025" (string split avoids timezone shifts from new Date())
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

// 14963 -> "14,963", 977.92 -> "977.92" (matches the reference documents)
const fmt = (amount) => {
  const num = parseFloat(amount) || 0;
  const decimals = Math.round(num * 100) % 100 ? 2 : 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
};

const getImageDataUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('data:')) return imagePath;
  try {
    const absolutePath = path.resolve(imagePath);
    if (!fs.existsSync(absolutePath)) return null;
    const buffer = fs.readFileSync(absolutePath);
    const ext = path.extname(imagePath).toLowerCase().slice(1);
    const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error reading image:', error);
    return null;
  }
};

// Template colors are interpolated into CSS and SVG, so anything that isn't #rrggbb falls back
const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback;

// WCAG relative luminance; below ~0.179 white text has more contrast than black
const isDark = (color) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.179;
};

// Document colors from the template; bw = ink-saver print (white paper, black ink, faint gray pattern)
const makeTheme = (doc, { bw = false, primaryFallback }) => {
  const bg = bw ? '#ffffff' : hex(doc.template_background_color, '#ffffff');
  const primary = bw ? '#000000' : hex(doc.template_primary_color, primaryFallback);
  const dark = isDark(bg);
  return {
    bw, dark, bg, primary,
    fg: dark ? '#f3f4f6' : bw ? '#000000' : '#1f2937',
    muted: dark ? '#b8bcc4' : bw ? '#555555' : '#6b7280',
    pattern: doc.template_pattern,
    patternColor: bw ? '#c4c4c4' : hex(doc.template_pattern_color, primary),
    placement: doc.template_pattern_placement,
    opacity: doc.template_pattern_opacity
  };
};

// In B&W, color fills (bands, table headers) become outlines so they cost no toner
const themeVars = (t) => `
    --bg: ${t.bg}; --fg: ${t.fg}; --muted: ${t.muted}; --primary: ${t.primary};
    --rule: ${t.dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)'};
    --zebra: ${t.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)'};
    --fill: ${t.bw ? 'transparent' : t.primary};
    --on-fill: ${t.bw ? '#000' : isDark(t.primary) ? '#fff' : '#111'};
    --fill-line: ${t.bw ? '0.75pt solid #000' : '0 solid transparent'};
    --tint: ${t.bw ? 'transparent' : `color-mix(in srgb, ${t.primary} 10%, ${t.bg})`};`;

const OPEN_SANS = '<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=block" rel="stylesheet">';

// Page shell: zero PDF margins so background and pattern reach the paper edge. .page padding is
// cloned onto every printed page, and fixed elements (pattern, footer) repeat on every page.
const renderPage = ({ theme, css, body, footer = '', head = OPEN_SANS }) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${head}
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { background: ${theme.bg}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    :root {${themeVars(theme)}
    }
    .page { box-decoration-break: clone; -webkit-box-decoration-break: clone; }
    .page-footer { position: fixed; left: 0; right: 0; bottom: 0; }
    ${theme.bw ? 'img { filter: grayscale(1); }' : ''}
    ${css}
  </style>
</head>
<body>
  ${patternLayer(theme)}
  ${footer ? `<div class="page-footer">${footer}</div>` : ''}
  <div class="page">${body}</div>
</body>
</html>`;

// Shared layout renderer, or undefined for classic/unknown names (template values are user input)
const layoutFor = (name) => Object.hasOwn(LAYOUTS, name) ? LAYOUTS[name].render : undefined;

const footerLines = (doc) => [
  [doc.template_company_name, doc.template_company_address, doc.template_company_city, doc.template_company_country].filter(Boolean).join(', '),
  [doc.template_email, doc.template_phone, doc.template_tax_id && `ID: ${doc.template_tax_id}`].filter(Boolean).join(' · ')
];

// Invoice: "faktura" layout (reference ST-0726-001) with BIHUPP payment QR
const buildInvoiceHTML = async (invoice, { bw = false, lang = 'en' } = {}) => {
  const L = textFor(lang);
  const logoDataUrl = getImageDataUrl(invoice.template_logo_path);
  const stampDataUrl = getImageDataUrl(invoice.template_stamp_path);
  const signatureDataUrl = getImageDataUrl(invoice.template_signature_path);
  const theme = makeTheme(invoice, { bw, primaryFallback: '#000000' });
  const ink = theme.dark ? theme.fg : '#000';

  const items = invoice.line_items || [];
  const vatRate = parseFloat(invoice.vat_rate) || 0;
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;
  const currencyLabel = invoice.currency === 'BAM' ? 'KM' : invoice.currency;
  const vatNote = (lang === 'bs' ? invoice.template_vat_note_local : invoice.template_vat_note_en) || L.vatNote;

  const amountBAM = { BAM: total, EUR: total * EUR_TO_BAM }[invoice.currency];
  const qrSvg = invoice.template_bank_account && amountBAM !== undefined
    ? await bihuppQrSvg({
      name: invoice.template_company_name,
      address: invoice.template_company_address,
      city: invoice.template_company_city,
      account: invoice.template_bank_account,
      purpose: `Plaćanje fakture ${invoice.invoice_number}`,
      reference: invoice.invoice_number,
      amountBAM,
      payerName: invoice.client_company_name,
      payerAddress: invoice.client_address,
      payerCity: invoice.client_city,
      payerTaxId: invoice.client_tax_id
    })
    : null;

  const docRows = [
    [L.invoiceNo, invoice.invoice_number],
    [L.date, invoice.date && formatDate(invoice.date) + (lang === 'bs' ? '.' : '')],
    [L.placeOfIssue, invoice.place_of_issue],
    [L.paymentMethod, invoice.payment_method],
    [L.fiscalNo, invoice.fiscal_number],
    [L.contractNo, invoice.contract_number]
  ].filter(([, value]) => value);
  const clientRows = [
    [L.client, invoice.client_company_name],
    [L.address, invoice.client_address],
    [L.city, invoice.client_city],
    [L.clientTaxId, invoice.client_tax_id]
  ].filter(([, value]) => value);
  const layout = layoutFor(invoice.template_invoice_layout);
  if (layout) {
    return renderPage({
      theme,
      ...layout({
        title: L.invoice,
        number: invoice.invoice_number,
        logo: logoDataUrl,
        labels: { from: L.from, client: L.client, meta: L.details, bank: L.bank, contact: L.contact },
        company: {
          name: invoice.template_company_name,
          lines: [invoice.template_company_address, invoice.template_company_city,
            invoice.template_tax_id && `JIB: ${invoice.template_tax_id}`, invoice.template_vat_number && `${L.vat}: ${invoice.template_vat_number}`]
        },
        bank: [invoice.template_bank_name, invoice.template_bank_account && `${L.account}: ${invoice.template_bank_account}`,
          invoice.template_swift_code && `SWIFT: ${invoice.template_swift_code}`, invoice.template_iban && `IBAN: ${invoice.template_iban}`],
        contact: [invoice.template_email, invoice.template_phone],
        meta: docRows,
        client: {
          name: invoice.client_company_name,
          lines: [invoice.client_address, invoice.client_city, invoice.client_tax_id && `${L.clientTaxId}: ${invoice.client_tax_id}`]
        },
        columns: [{ label: 'No.', width: '9%' }, { label: L.description }, { label: L.priceExVat, num: true },
          { label: `${L.vat} ${fmt(vatRate)}%`, num: true }, { label: L.total, num: true }],
        rows: items.map((item, index) => {
          const itemVat = item.total * vatRate / 100;
          return [`${index + 1}.`, item.description, fmt(item.total), fmt(itemVat), fmt(item.total + itemVat)];
        }),
        totals: [[L.amountExVat, `${fmt(subtotal)} ${currencyLabel}`], [`${L.vat} ${fmt(vatRate)}%`, `${fmt(vatAmount)} ${currencyLabel}`],
          [L.amountIncVat, `${fmt(total)} ${currencyLabel}`]],
        notes: [vatRate === 0 && { title: L.vatInfo, text: vatNote }, invoice.notes && { title: L.note, text: invoice.notes }].filter(Boolean),
        qr: qrSvg && { svg: qrSvg, caption: L.scanToPay },
        signatures: [
          { images: [stampDataUrl, signatureDataUrl].filter(Boolean), label: invoice.template_signatory_name },
          { images: [], label: L.receivedBy }
        ],
        footer: footerLines(invoice)
      })
    });
  }

  const infoRows = Array.from({ length: Math.max(docRows.length, clientRows.length) }, (_, i) => `
      <tr>
        <td>${docRows[i] ? `${esc(docRows[i][0])}:` : ''}</td><td class="bold">${esc(docRows[i]?.[1])}</td>
        <td>${clientRows[i] ? `${esc(clientRows[i][0])}:` : ''}</td><td>${esc(clientRows[i]?.[1])}</td>
      </tr>`).join('');

  // Fixed, so it repeats on every page inside the bottom padding reserved by .page
  const footerAddress = [invoice.template_company_address, invoice.template_company_city, invoice.template_company_country]
    .filter(Boolean).map(esc).join(', ');
  const footer = `
    <div style="width: 100%; padding-top: 20pt; text-align: center; font-family: Calibri, Carlito, 'Liberation Sans', Arial, sans-serif; font-size: 9.5pt; line-height: 13.7pt;">
      <div>${esc(invoice.template_company_name)}${footerAddress ? `, ${footerAddress}` : ''},</div>
      <div>${[
        invoice.template_email && `<a style="color: ${theme.bw ? '#000' : theme.dark ? '#8ab4f8' : '#1155cc'};">${esc(invoice.template_email)}</a>`,
        esc(invoice.template_phone)
      ].filter(Boolean).join(', ')}</div>
      ${invoice.template_tax_id ? `<div>ID: ${esc(invoice.template_tax_id)}</div>` : ''}
    </div>`;

  return renderPage({ theme, head: '', footer, css: `
    body {
      font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
      font-size: 12pt;
      color: ${ink};
    }
    .page { padding: 12.7mm 43pt 32.1mm 72pt; }
    .page-footer { bottom: calc(0.4cm + 4pt); }
    .bold { font-weight: bold; }
    .header {
      display: flex;
      justify-content: space-between;
      line-height: 23.5pt;
      margin-top: 13pt;
      padding-bottom: 14pt;
      border-bottom: 2pt solid ${theme.primary};
    }
    .header-left, .header-right { width: 38%; }
    .header-right { padding-left: 32pt; width: 42%; white-space: nowrap; }
    .header-center { flex: 1; text-align: center; align-self: center; padding-top: 16pt; }
    .logo { max-width: 115pt; max-height: 60pt; }
    .info {
      width: 468pt;
      margin-top: 16pt;
      font-size: 11pt;
      line-height: 14.55pt;
      border-collapse: collapse;
    }
    .info td { padding: 0 5.2pt; vertical-align: top; }
    .info td:nth-child(1) { width: 141.8pt; }
    .info td:nth-child(2) { width: 120.8pt; }
    .info td:nth-child(3) { width: 57.7pt; }
    table.grid {
      width: 468pt;
      border-collapse: collapse;
      font-size: 11pt;
      line-height: 12.6pt;
    }
    .grid td, .grid th { border: 0.75pt solid ${ink}; padding: 0 4pt 1pt 5.2pt; vertical-align: top; }
    .items { margin-top: 18pt; }
    .items th { text-align: center; }
    .items th:first-child, .items td:first-child { text-align: left; }
    .items td { text-align: center; }
    .items tbody tr:not(.sum-row) td { padding-bottom: 13pt; }
    .items .sum-row td { padding-top: 1pt; padding-bottom: 3pt; text-align: center; }
    .summary { margin-top: 6.5pt; }
    .summary td { padding-top: 1pt; padding-bottom: 1pt; }
    .summary td:first-child { font-weight: bold; }
    .summary td:last-child { text-align: center; }
    .notes-section {
      display: flex;
      justify-content: space-between;
      gap: 20pt;
      margin-top: 26pt;
      padding-left: 5.2pt;
      line-height: 13.8pt;
    }
    .notes { flex: 1; }
    .notes h3 { font-size: 12pt; margin-bottom: 10.5pt; }
    .notes p { white-space: pre-line; margin-bottom: 14pt; }
    .qr { width: 105pt; text-align: center; font-size: 8pt; line-height: 10pt; padding-top: 2pt; }
    .qr svg { width: 105pt; height: 105pt; display: block; margin-bottom: 4pt; }
    ${theme.dark ? '.qr svg { background: #fff; padding: 6pt; }' : ''}
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 10pt;
      page-break-inside: avoid;
    }
    .signature-box { text-align: center; }
    .signature-box.left { width: 132pt; }
    .signature-box.right { width: 148pt; margin-right: 7pt; }
    .signature-images {
      height: 40pt;
      display: flex;
      justify-content: center;
      align-items: flex-end;
    }
    .signature-images img { max-height: 70pt; max-width: 90pt; margin-bottom: -12pt; }
    .signature-line { border-top: 0.75pt solid #999; padding-top: 5pt; }
  `, body: `
  <div class="header">
    <div class="header-left">
      <div class="bold">${esc(invoice.template_company_name)}</div>
      <div>${esc(invoice.template_company_address)}</div>
      <div>${esc(invoice.template_company_city)}</div>
      <div>JIB: ${esc(invoice.template_tax_id)}</div>
      <div>${L.vat}: ${esc(invoice.template_vat_number)}</div>
    </div>
    <div class="header-center">
      ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo" alt="Logo">` : ''}
    </div>
    <div class="header-right">
      <div>${esc(invoice.template_bank_name)}</div>
      ${invoice.template_bank_account ? `<div>${L.account}: <span class="bold">${esc(invoice.template_bank_account)}</span></div>` : ''}
      ${invoice.template_swift_code ? `<div>SWIFT: ${esc(invoice.template_swift_code)}</div>` : ''}
      ${invoice.template_iban ? `<div>IBAN: ${esc(invoice.template_iban)}</div>` : ''}
    </div>
  </div>

  <table class="info">${infoRows}</table>

  <table class="grid items">
    <thead>
      <tr>
        <th style="width: 19.8%">No.</th>
        <th style="width: 26.9%">${L.description}</th>
        <th style="width: 19.8%">${L.priceExVat}</th>
        <th style="width: 13.7%">${L.vat} ${fmt(vatRate)}%</th>
        <th style="width: 19.8%">${L.total}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item, index) => {
        const itemVat = item.total * vatRate / 100;
        return `
      <tr>
        <td>${index + 1}.</td>
        <td>${esc(item.description)}</td>
        <td>${fmt(item.total)}</td>
        <td>${fmt(itemVat)}</td>
        <td>${fmt(item.total + itemVat)}</td>
      </tr>`;
      }).join('')}
      <tr class="sum-row">
        <td colspan="4">∑</td>
        <td>${fmt(total)}</td>
      </tr>
    </tbody>
  </table>

  <table class="grid summary">
    <tr><td style="width: 33.7%">${L.amountExVat}</td><td style="width: 33.4%">${esc(currencyLabel)}</td><td>${fmt(subtotal)}</td></tr>
    <tr><td>${L.vat} ${fmt(vatRate)}%</td><td>${esc(currencyLabel)}</td><td>${fmt(vatAmount)}</td></tr>
    <tr><td>${L.amountIncVat}</td><td>${esc(currencyLabel)}</td><td>${fmt(total)}</td></tr>
  </table>

  <div class="notes-section">
    <div class="notes">
      ${vatRate === 0 ? `<h3>${L.vatInfo.toUpperCase()}:</h3><p>${esc(vatNote)}</p>` : ''}
      ${invoice.notes ? `<h3>${L.note.toUpperCase()}:</h3><p>${esc(invoice.notes)}</p>` : ''}
    </div>
    ${qrSvg ? `<div class="qr">${qrSvg}${L.scanToPay}</div>` : ''}
  </div>

  <div class="signatures">
    <div class="signature-box left">
      <div class="signature-images">
        ${stampDataUrl ? `<img src="${stampDataUrl}" alt="Stamp">` : ''}
        ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Signature">` : ''}
      </div>
      <div class="signature-line">${esc(invoice.template_signatory_name)}</div>
    </div>
    <div class="signature-box right">
      <div class="signature-images"></div>
      <div class="signature-line">${L.receivedBy}</div>
    </div>
  </div>
  ` });
};

// Receipt: clean layout (reference ST-1225-001)
const buildReceiptHTML = async (receipt, { bw = false, lang = 'en' } = {}) => {
  const L = textFor(lang);
  const logoDataUrl = getImageDataUrl(receipt.template_logo_path);
  const theme = makeTheme(receipt, { bw, primaryFallback: '#444444' });
  const ink = theme.dark ? theme.fg : '#444';
  const symbol = CURRENCY_SYMBOLS[receipt.currency] || receipt.currency;
  const items = receipt.line_items || [];

  const layout = layoutFor(receipt.template_receipt_layout);
  if (layout) {
    return renderPage({
      theme,
      ...layout({
        title: L.receipt,
        number: receipt.receipt_number,
        logo: logoDataUrl,
        labels: { from: L.from, client: L.client, meta: L.details, bank: L.bank, contact: L.contact },
        company: {
          name: receipt.template_company_name,
          lines: [receipt.template_company_address, receipt.template_company_city, receipt.template_tax_id && `JIB: ${receipt.template_tax_id}`]
        },
        bank: [receipt.template_bank_name, receipt.template_swift_code && `SWIFT: ${receipt.template_swift_code}`,
          receipt.template_iban && `IBAN: ${receipt.template_iban}`],
        contact: [receipt.template_email, receipt.template_phone],
        meta: [[L.receiptNo, receipt.receipt_number], [L.date, formatDate(receipt.date)]],
        client: {
          name: receipt.client_company_name,
          lines: [receipt.client_address, receipt.client_city, receipt.client_tax_id && `${L.clientTaxId}: ${receipt.client_tax_id}`]
        },
        columns: [{ label: L.description, width: '50%' }, { label: L.unitPrice, num: true }, { label: L.qty, num: true }, { label: L.total, num: true }],
        rows: items.map(item => [item.description, fmt(item.unit_price), fmt(item.quantity), `${fmt(item.total)} ${symbol}`]),
        totals: [[L.total, `${fmt(receipt.total)} ${symbol}`]],
        notes: [],
        qr: null,
        signatures: null,
        footer: footerLines(receipt)
      })
    });
  }

  return renderPage({ theme, css: `
    body {
      font-family: 'Open Sans', sans-serif;
      font-size: 10pt;
      line-height: 13.5pt;
      letter-spacing: 1pt;
      color: ${ink};
    }
    .page { padding: 42pt 55pt 42pt 70pt; }
    .bold { font-weight: 700; }
    .header { display: flex; justify-content: space-between; }
    .logo { max-width: 230pt; max-height: 36pt; display: block; margin-top: 3pt; }
    .title {
      font-size: 32pt;
      line-height: 44pt;
      letter-spacing: 6pt;
      color: ${theme.primary};
      margin-top: 8pt;
      margin-left: 4pt;
    }
    .header-right { width: 170pt; }
    .bank { margin-top: 5pt; }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-top: 37pt;
      padding-left: 7.4pt;
    }
    .label { font-weight: 700; letter-spacing: 1.5pt; }
    .issued-to .label { margin-bottom: 2.5pt; }
    .doc-info { border-collapse: collapse; align-self: flex-start; margin-right: 4pt; }
    .doc-info td { padding: 0 0 2pt 20pt; text-align: right; }
    .doc-info td:first-child { text-align: right; }
    .items {
      width: 456pt;
      margin-top: 58pt;
      border-collapse: collapse;
    }
    .items th {
      font-weight: 700;
      letter-spacing: 1.5pt;
      padding: 0 0 8pt;
      border-bottom: 0.75pt solid ${ink};
      text-align: center;
    }
    .items td { padding: 14pt 0 0; text-align: center; }
    .items th:first-child { text-align: left; padding-left: 7.4pt; }
    .items td:first-child { text-align: left; padding-left: 11.6pt; }
    .items tbody tr:last-child td { padding-bottom: 42pt; }
    .items tfoot td { border-top: 0.75pt solid ${ink}; padding-top: 9pt; font-weight: 700; letter-spacing: 1.5pt; }
    .nowrap { white-space: nowrap; }
  `, body: `
  <div class="header">
    <div>
      ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo" alt="Logo">` : ''}
      <div class="title">${L.receipt}</div>
    </div>
    <div class="header-right">
      <div>${esc(receipt.template_company_name)}</div>
      <div>${esc(receipt.template_company_address)}</div>
      <div>${esc(receipt.template_company_city)}</div>
      ${receipt.template_tax_id ? `<div>JIB: ${esc(receipt.template_tax_id)}</div>` : ''}
      <div class="bank">
        <div>${esc(receipt.template_bank_name)}</div>
        ${receipt.template_swift_code ? `<div>SWIFT: ${esc(receipt.template_swift_code)}</div>` : ''}
        ${receipt.template_iban ? `<div>IBAN: ${esc(receipt.template_iban)}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="issued-to">
      <div class="label">${L.client.toUpperCase()}:</div>
      <div>${esc(receipt.client_company_name)}</div>
      <div>${esc(receipt.client_address)}</div>
      <div>${esc(receipt.client_city)}</div>
      ${receipt.client_tax_id ? `<div>${L.clientTaxId}: ${esc(receipt.client_tax_id)}</div>` : ''}
    </div>
    <table class="doc-info">
      <tr><td class="label">${L.receiptNo.toUpperCase()}:</td><td class="bold">${esc(receipt.receipt_number)}</td></tr>
      <tr><td>${L.date.toUpperCase()}:</td><td>${formatDate(receipt.date)}</td></tr>
    </table>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width: 47.1%">${L.description.toUpperCase()}</th>
        <th style="width: 17.5%">${L.unitPrice.toUpperCase()}</th>
        <th style="width: 22.4%">${L.qty.toUpperCase()}</th>
        <th>${L.total.toUpperCase()}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
      <tr>
        <td>${esc(item.description)}</td>
        <td>${fmt(item.unit_price)}</td>
        <td>${fmt(item.quantity)}</td>
        <td class="nowrap">${fmt(item.total)} ${esc(symbol)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">${L.total.toUpperCase()}</td>
        <td class="nowrap">${fmt(receipt.total)} ${esc(symbol)}</td>
      </tr>
    </tfoot>
  </table>
  ` });
};

const generatePDFFromHTML = async (html) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    // 'networkidle0' hangs intermittently on a starved CPU (Render free = 0.1 CPU); images are inline,
    // so 'load' plus the web fonts is everything the page needs
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    // Margins are zero; each layout pads its .page instead (see renderPage)
    return await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  } finally {
    await browser.close();
  }
};

module.exports = {
  buildInvoiceHTML,
  buildReceiptHTML,
  generateInvoicePDF: async (invoice, opts) => generatePDFFromHTML(await buildInvoiceHTML(invoice, opts)),
  generateReceiptPDF: async (receipt, opts) => generatePDFFromHTML(await buildReceiptHTML(receipt, opts))
};
