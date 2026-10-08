const test = require('node:test');
const assert = require('node:assert');
const { passwordProblems } = require('./auth');

test('password policy: 8+ chars, uppercase, number, special', () => {
  assert.deepStrictEqual(passwordProblems('Str0ng!pw'), []);
  assert.deepStrictEqual(passwordProblems('Sh0rt!'), ['at least 8 characters']);
  assert.deepStrictEqual(passwordProblems('lowercase1!'), ['an uppercase letter']);
  assert.deepStrictEqual(passwordProblems('NoNumber!!'), ['a number']);
  assert.deepStrictEqual(passwordProblems('NoSpecial12'), ['a special character']);
});

test('settings keep only known language/theme values', () => {
  const { pickSettings } = require('./auth');
  const current = { language: 'en', theme: 'system' };
  assert.deepStrictEqual(pickSettings({ language: 'bs', theme: 'dark' }, current), { language: 'bs', theme: 'dark' });
  assert.deepStrictEqual(pickSettings({ language: 'de', theme: '__proto__' }, current), current);
  assert.deepStrictEqual(pickSettings({}, current), current);
});

test('confirmation email carries the link and expiry in both HTML and text', () => {
  const { magicLinkEmail } = require('../services/mailer');
  const link = 'http://localhost:5173/verify?token=abc';
  const mail = magicLinkEmail({ username: 'nikola', link, ttlMinutes: 15 });
  for (const body of [mail.html, mail.text]) {
    assert.ok(body.includes(link));
    assert.ok(body.includes('15 minutes'));
    assert.ok(body.includes('nikola'));
  }
  assert.strictEqual(mail.subject, 'Confirm your email');
});
