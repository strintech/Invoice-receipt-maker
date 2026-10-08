const test = require('node:test');
const assert = require('node:assert');
const { bihuppPayload, clean } = require('./bihupp');

test('payload matches php-bihupp-qrcode line order (sender omitted)', () => {
  const payload = bihuppPayload({
    name: 'Pero Perić',
    address: 'Titova 1',
    city: '71000 Sarajevo',
    account: '9876543210987654',
    purpose: 'Invoice payment',
    reference: 'INV2024001',
    amountBAM: 100
  });
  assert.strictEqual(payload, [
    'BIHUPP10', '', '', '', '',
    'Invoice payment', 'INV2024001',
    'Pero Perić', 'Titova 1', '71000 Sarajevo',
    '', '9876543210987654',
    '000000000010000', 'BAM', 'N',
    '', '', '', '', '', '', '', ''
  ].join('\n') + '\n');
});

test('payer lines and JIB match a real-world BIHUPP10 code', () => {
  const lines = bihuppPayload({
    name: 'VATY d.o.o',
    address: 'ul.Dr.Fetaha Becirbegovica 1b',
    city: '71000 Sarajevo-Novo Sarajevo',
    account: '1413065320205039',
    purpose: 'Usluga racunovodstva',
    reference: '0000-6118-6-34-1',
    amountBAM: 150.01,
    payerName: 'STRINTECH d.o.o',
    payerAddress: 'ul. Dr. Fetaha Bećirbegovića 8c',
    payerCity: '71120 Sarajevo-Novo Sarajevo',
    payerTaxId: '4203550420000'
  }).split('\n');
  // The real code carries all 28 chars of the city line; we keep the reference lib's safer 25-byte cap
  assert.deepStrictEqual(lines.slice(1, 5), ['STRINTECH d.o.o', 'ul. Dr. Fetaha Bećirbegovića 8c', '71120 Sarajevo-Novo Saraj', '']);
  assert.strictEqual(lines[12], '000000000015001');
  assert.strictEqual(lines[15], '4203550420000');
  assert.strictEqual(lines.length, 24); // 23 lines + trailing newline
});

test('foreign tax IDs are left out of the JIB line', () => {
  assert.strictEqual(bihuppPayload({ account: '1', amountBAM: 1, payerTaxId: 'ATU78872935' }).split('\n')[15], '');
});

test('amounts are rounded to pfeninga', () => {
  const amountLine = (amountBAM) => bihuppPayload({ account: '1', amountBAM }).split('\n')[12];
  assert.strictEqual(amountLine(14963), '000000001496300');
  assert.strictEqual(amountLine(977.92), '000000000097792');
  assert.strictEqual(amountLine(0.1 + 0.2), '000000000000030');
});

test('clean strips disallowed chars and truncates by bytes', () => {
  assert.strictEqual(clean('“STRINTECH” d.o.o.', 50), 'STRINTECH d.o.o.');
  assert.strictEqual(clean('Landstraße  2', 50), 'Landstrae 2');
  assert.strictEqual(clean('ččččč', 5), 'čč'); // 2 bytes each
});
