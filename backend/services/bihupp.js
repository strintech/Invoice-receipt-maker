const QRCode = require('qrcode');

// BIHUPP10 payment QR payload (UBBiH standard), ported from sasa-b/php-bihupp-qrcode.
// Payer lines carry the invoice client, and the tax ID line carries the client's JIB,
// matching real-world BIHUPP10 codes (the payer's bank may still override them).

const DISALLOWED = /[^0-9a-zA-ZčćđšžČĆĐŠŽ ,:.?()+'/-]/g;

// Strip characters outside the allowed set and cap length in bytes (the reference lib uses PHP strlen)
const clean = (value, maxBytes) => {
  let v = String(value || '').replace(DISALLOWED, '').replace(/\s+/g, ' ').trim();
  while (Buffer.byteLength(v) > maxBytes) v = v.slice(0, -1).trimEnd();
  return v;
};

// Only a 13-digit BiH JIB fits the tax ID line; foreign VAT IDs (e.g. ATU...) are left out
const jib = (value) => {
  const digits = String(value || '').replace(/\s/g, '');
  return /^\d{13}$/.test(digits) ? digits : '';
};

const bihuppPayload = ({
  name, address, city, account, purpose, reference, amountBAM,
  payerName, payerAddress, payerCity, payerTaxId
}) => [
  'BIHUPP10',
  clean(payerName, 50),
  clean(payerAddress, 50),
  clean(payerCity, 25),
  '',                                              // payer phone
  clean(purpose, 110),
  clean(reference, 30),
  clean(name, 50),
  clean(address, 50),
  clean(city, 25),
  '',                                              // payer account
  String(account || '').replace(/\D/g, '').slice(0, 16),
  String(Math.round(amountBAM * 100)).padStart(15, '0'),
  'BAM',
  'N',                                             // regular priority
  jib(payerTaxId),
  '', '', '', '', '', '', ''                       // remaining public revenue fields
].map(line => line + '\n').join('');

// One byte-mode segment, like the reference encoders; qrcode's default mixes numeric/alphanumeric segments
const bihuppQrSvg = (opts) =>
  QRCode.toString([{ data: Buffer.from(bihuppPayload(opts)), mode: 'byte' }],
    { type: 'svg', errorCorrectionLevel: 'L', margin: 0 });

module.exports = { bihuppPayload, bihuppQrSvg, clean };
