import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { BS, translate } from './i18n.js'

test('every literal t() string has a Bosnian translation', () => {
  const dir = new URL('.', import.meta.url)
  const missing = readdirSync(dir, { recursive: true })
    .filter(file => file.endsWith('.jsx'))
    .flatMap(file => [...readFileSync(new URL(file, dir), 'utf8').matchAll(/\bt\((['"])(.*?)\1/g)]
      .map(match => match[2])
      .filter(key => !(key in BS))
      .map(key => `${file}: ${key}`))
  assert.deepStrictEqual(missing, [])
})

test('translate interpolates and falls back to the English source', () => {
  assert.strictEqual(translate('bs', 'Invoices'), 'Fakture')
  assert.strictEqual(translate('en', 'Invoices'), 'Invoices')
  assert.strictEqual(translate('bs', 'Pattern intensity ({percent}%)', { percent: 40 }), 'Intenzitet uzorka (40%)')
  assert.strictEqual(translate('bs', 'Unknown API error'), 'Unknown API error')
})
