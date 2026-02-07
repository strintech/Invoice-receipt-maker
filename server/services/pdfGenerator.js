const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatCurrency = (amount, currency = 'EUR') => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ' + currency;
};

const getImageDataUrl = (imagePath) => {
  if (!imagePath) return null;
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

const generateInvoicePDF = async (invoice) => {
  const logoDataUrl = getImageDataUrl(invoice.template_logo_path);
  const primaryColor = invoice.template_primary_color || '#F97316';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 10pt;
      color: #333;
      line-height: 1.4;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 3px solid ${primaryColor};
      padding-bottom: 20px;
    }
    .logo {
      max-width: 150px;
      max-height: 80px;
    }
    .company-info {
      text-align: right;
      font-size: 9pt;
    }
    .company-name {
      font-size: 14pt;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 5px;
    }
    .title {
      font-size: 24pt;
      font-weight: bold;
      color: ${primaryColor};
      margin: 30px 0 20px;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .client-info, .invoice-info {
      width: 48%;
    }
    .section-title {
      font-weight: bold;
      color: #666;
      font-size: 9pt;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .client-name {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 5px;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-number {
      font-size: 12pt;
      font-weight: bold;
      color: ${primaryColor};
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: ${primaryColor};
      color: white;
      padding: 12px 10px;
      text-align: left;
      font-weight: bold;
      font-size: 9pt;
      text-transform: uppercase;
    }
    th:last-child, td:last-child {
      text-align: right;
    }
    th:nth-child(2), td:nth-child(2),
    th:nth-child(3), td:nth-child(3) {
      text-align: center;
    }
    td {
      padding: 12px 10px;
      border-bottom: 1px solid #eee;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .total-row {
      font-weight: bold;
      font-size: 12pt;
    }
    .total-row td {
      border-top: 2px solid ${primaryColor};
      padding-top: 15px;
    }
    .total-label {
      text-align: right !important;
    }
    .total-amount {
      color: ${primaryColor};
      font-size: 14pt;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
    .bank-info {
      margin-top: 30px;
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 5px;
    }
    .bank-info-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: ${primaryColor};
    }
    .bank-details {
      display: flex;
      justify-content: space-between;
    }
    .bank-detail {
      text-align: center;
    }
    .bank-label {
      font-size: 8pt;
      color: #666;
      text-transform: uppercase;
    }
    .bank-value {
      font-weight: bold;
      margin-top: 3px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo" alt="Logo">` : ''}
    </div>
    <div class="company-info">
      <div class="company-name">${invoice.template_company_name || ''}</div>
      <div>${invoice.template_company_address || ''}</div>
      <div>${invoice.template_company_city || ''}</div>
      ${invoice.template_tax_id ? `<div>Tax ID: ${invoice.template_tax_id}</div>` : ''}
      ${invoice.template_email ? `<div>${invoice.template_email}</div>` : ''}
      ${invoice.template_phone ? `<div>${invoice.template_phone}</div>` : ''}
    </div>
  </div>

  <div class="title">INVOICE</div>

  <div class="info-section">
    <div class="client-info">
      <div class="section-title">Bill To</div>
      <div class="client-name">${invoice.client_company_name || ''}</div>
      <div>${invoice.client_address || ''}</div>
      <div>${invoice.client_city || ''}</div>
      ${invoice.client_tax_id ? `<div>UID: ${invoice.client_tax_id}</div>` : ''}
    </div>
    <div class="invoice-info">
      <div class="section-title">Invoice Details</div>
      <div class="invoice-number">${invoice.invoice_number}</div>
      <div style="margin-top: 10px;">
        <strong>Date:</strong> ${formatDate(invoice.date)}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Description</th>
        <th style="width: 15%;">Unit Price</th>
        <th style="width: 15%;">QTY</th>
        <th style="width: 20%;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${(invoice.line_items || []).map(item => `
        <tr>
          <td>${item.description}</td>
          <td>${formatCurrency(item.unit_price, invoice.currency)}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.total, invoice.currency)}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3" class="total-label">TOTAL</td>
        <td class="total-amount">${formatCurrency(invoice.total, invoice.currency)}</td>
      </tr>
    </tbody>
  </table>

  ${invoice.template_iban || invoice.template_swift_code ? `
    <div class="bank-info">
      <div class="bank-info-title">Payment Information</div>
      <div class="bank-details">
        ${invoice.template_bank_name ? `
          <div class="bank-detail">
            <div class="bank-label">Bank</div>
            <div class="bank-value">${invoice.template_bank_name}</div>
          </div>
        ` : ''}
        ${invoice.template_iban ? `
          <div class="bank-detail">
            <div class="bank-label">IBAN</div>
            <div class="bank-value">${invoice.template_iban}</div>
          </div>
        ` : ''}
        ${invoice.template_swift_code ? `
          <div class="bank-detail">
            <div class="bank-label">SWIFT</div>
            <div class="bank-value">${invoice.template_swift_code}</div>
          </div>
        ` : ''}
      </div>
    </div>
  ` : ''}

  <div class="footer">
    ${invoice.template_company_name || ''} | ${invoice.template_company_address || ''}, ${invoice.template_company_city || ''}
    ${invoice.template_email ? ` | ${invoice.template_email}` : ''}
    ${invoice.template_phone ? ` | ${invoice.template_phone}` : ''}
  </div>
</body>
</html>
  `;

  return generatePDFFromHTML(html);
};

const generateReceiptPDF = async (receipt) => {
  const logoDataUrl = getImageDataUrl(receipt.template_logo_path);
  const stampDataUrl = getImageDataUrl(receipt.template_stamp_path);
  const signatureDataUrl = getImageDataUrl(receipt.template_signature_path);
  const primaryColor = receipt.template_primary_color || '#F97316';

  const vatNoteEn = receipt.vat_note_en || receipt.template_vat_note_en ||
    'VAT is not calculated because the company is not registered in the VAT system according to Article 57, Paragraph 1 of the VAT Law.';
  const vatNoteLocal = receipt.vat_note_local || receipt.template_vat_note_local ||
    'PDV nije obračunat jer društvo nije u sistemu PDV-a prema članu 57. stav 1. Zakona o PDV-u.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 9pt;
      color: #333;
      line-height: 1.4;
      padding: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid ${primaryColor};
    }
    .header-left, .header-right {
      width: 35%;
      font-size: 8pt;
    }
    .header-center {
      width: 30%;
      text-align: center;
    }
    .logo {
      max-width: 120px;
      max-height: 60px;
    }
    .company-name {
      font-size: 12pt;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 5px;
    }
    .header-right {
      text-align: right;
    }
    .title {
      font-size: 18pt;
      font-weight: bold;
      color: ${primaryColor};
      text-align: center;
      margin: 20px 0;
    }
    .doc-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f9f9f9;
      border-radius: 5px;
    }
    .doc-info-section {
      width: 48%;
    }
    .info-row {
      display: flex;
      margin-bottom: 5px;
    }
    .info-label {
      font-weight: bold;
      min-width: 120px;
      color: #666;
    }
    .info-value {
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th {
      background-color: ${primaryColor};
      color: white;
      padding: 10px 8px;
      text-align: left;
      font-weight: bold;
      font-size: 8pt;
      text-transform: uppercase;
    }
    th:first-child {
      width: 5%;
      text-align: center;
    }
    th:nth-child(2) {
      width: 45%;
    }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) {
      width: 16%;
      text-align: right;
    }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #eee;
    }
    td:first-child {
      text-align: center;
    }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) {
      text-align: right;
    }
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin: 20px 0;
    }
    .summary-table {
      width: 300px;
    }
    .summary-table td {
      padding: 8px 10px;
    }
    .summary-table .label {
      text-align: left;
      font-weight: bold;
    }
    .summary-table .value {
      text-align: right;
    }
    .summary-table .total-row {
      background-color: ${primaryColor};
      color: white;
      font-weight: bold;
      font-size: 11pt;
    }
    .summary-table .secondary-currency {
      background-color: #f0f0f0;
    }
    .vat-note {
      margin: 20px 0;
      padding: 15px;
      background-color: #fff9e6;
      border-left: 4px solid #f0c000;
      font-size: 8pt;
    }
    .vat-note p {
      margin-bottom: 10px;
    }
    .vat-note p:last-child {
      margin-bottom: 0;
      font-style: italic;
    }
    .signature-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 40px;
    }
    .signature-box {
      text-align: center;
      width: 200px;
    }
    .stamp-signature {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      height: 80px;
      margin-bottom: 10px;
    }
    .stamp {
      max-width: 80px;
      max-height: 80px;
      margin-right: 10px;
    }
    .signature {
      max-width: 100px;
      max-height: 50px;
    }
    .signatory-name {
      border-top: 1px solid #333;
      padding-top: 5px;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #eee;
      font-size: 7pt;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="company-name">${receipt.template_company_name || ''}</div>
      <div>${receipt.template_company_address || ''}</div>
      <div>${receipt.template_company_city || ''}</div>
      ${receipt.template_company_country ? `<div>${receipt.template_company_country}</div>` : ''}
      ${receipt.template_tax_id ? `<div>JIB: ${receipt.template_tax_id}</div>` : ''}
      ${receipt.template_bank_account ? `<div>Tr. Racun: ${receipt.template_bank_account}</div>` : ''}
    </div>
    <div class="header-center">
      ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo" alt="Logo">` : ''}
    </div>
    <div class="header-right">
      ${receipt.template_bank_name ? `<div><strong>Bank:</strong> ${receipt.template_bank_name}</div>` : ''}
      ${receipt.template_swift_code ? `<div><strong>SWIFT:</strong> ${receipt.template_swift_code}</div>` : ''}
      ${receipt.template_iban ? `<div><strong>IBAN:</strong> ${receipt.template_iban}</div>` : ''}
      ${receipt.template_email ? `<div>${receipt.template_email}</div>` : ''}
      ${receipt.template_phone ? `<div>${receipt.template_phone}</div>` : ''}
    </div>
  </div>

  <div class="title">RECEIPT / RACUN</div>

  <div class="doc-info">
    <div class="doc-info-section">
      <div class="info-row">
        <span class="info-label">Client / Kupac:</span>
        <span class="info-value">${receipt.client_company_name || ''}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Address / Adresa:</span>
        <span class="info-value">${receipt.client_address || ''}</span>
      </div>
      <div class="info-row">
        <span class="info-label">City / Grad:</span>
        <span class="info-value">${receipt.client_city || ''}</span>
      </div>
      ${receipt.client_tax_id ? `
        <div class="info-row">
          <span class="info-label">UID / JIB:</span>
          <span class="info-value">${receipt.client_tax_id}</span>
        </div>
      ` : ''}
    </div>
    <div class="doc-info-section">
      <div class="info-row">
        <span class="info-label">Receipt No / Broj:</span>
        <span class="info-value"><strong>${receipt.receipt_number}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Date / Datum:</span>
        <span class="info-value">${formatDate(receipt.date)}</span>
      </div>
      ${receipt.place_of_issue ? `
        <div class="info-row">
          <span class="info-label">Place / Mjesto:</span>
          <span class="info-value">${receipt.place_of_issue}</span>
        </div>
      ` : ''}
      ${receipt.fiscal_number ? `
        <div class="info-row">
          <span class="info-label">Fiscal No:</span>
          <span class="info-value">${receipt.fiscal_number}</span>
        </div>
      ` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>Description / Opis</th>
        <th>Price (${receipt.currency})</th>
        <th>VAT</th>
        <th>Sum</th>
      </tr>
    </thead>
    <tbody>
      ${(receipt.line_items || []).map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.description}</td>
          <td>${formatCurrency(item.unit_price, '')}</td>
          <td>${item.vat_rate}%</td>
          <td>${formatCurrency(item.total, '')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-section">
    <table class="summary-table">
      <tr>
        <td class="label">Subtotal (Σ)</td>
        <td class="value">${formatCurrency(receipt.subtotal, receipt.currency)}</td>
      </tr>
      <tr>
        <td class="label">VAT (${receipt.vat_rate}%)</td>
        <td class="value">${formatCurrency(receipt.vat_amount, receipt.currency)}</td>
      </tr>
      <tr class="total-row">
        <td class="label">TOTAL (${receipt.currency})</td>
        <td class="value">${formatCurrency(receipt.total, receipt.currency)}</td>
      </tr>
      ${receipt.secondary_currency && receipt.secondary_currency !== receipt.currency ? `
        <tr class="secondary-currency">
          <td class="label">TOTAL (${receipt.secondary_currency})</td>
          <td class="value">${formatCurrency(receipt.total_secondary, receipt.secondary_currency)}</td>
        </tr>
        <tr>
          <td colspan="2" style="font-size: 7pt; text-align: right; color: #666;">
            Exchange rate: 1 ${receipt.currency} = ${receipt.exchange_rate} ${receipt.secondary_currency}
          </td>
        </tr>
      ` : ''}
    </table>
  </div>

  ${receipt.vat_rate === 0 ? `
    <div class="vat-note">
      <p>${vatNoteEn}</p>
      <p>${vatNoteLocal}</p>
    </div>
  ` : ''}

  <div class="signature-section">
    <div class="signature-box">
      <div class="stamp-signature">
        ${stampDataUrl ? `<img src="${stampDataUrl}" class="stamp" alt="Stamp">` : ''}
        ${signatureDataUrl ? `<img src="${signatureDataUrl}" class="signature" alt="Signature">` : ''}
      </div>
      <div class="signatory-name">${receipt.template_signatory_name || ''}</div>
    </div>
  </div>

  <div class="footer">
    ${receipt.template_company_name || ''} | ${receipt.template_company_address || ''}, ${receipt.template_company_city || ''}, ${receipt.template_company_country || ''}
    ${receipt.template_email ? ` | ${receipt.template_email}` : ''}
    ${receipt.template_phone ? ` | ${receipt.template_phone}` : ''}
    ${receipt.template_tax_id ? ` | ID: ${receipt.template_tax_id}` : ''}
  </div>
</body>
</html>
  `;

  return generatePDFFromHTML(html);
};

const generatePDFFromHTML = async (html) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

module.exports = {
  generateInvoicePDF,
  generateReceiptPDF
};
