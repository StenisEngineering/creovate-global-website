// /api/contact → Sales OS forwarding. Node's built-in runner; Siteverify, Sales OS and
// Resend are all stubbed, so nothing leaves this machine.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { onRequestPost } from '../functions/api/contact.js'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const RESEND = 'https://api.resend.com/emails'
const SALES = 'https://intake.salesos.creovateglobal.com/v1/enquiries'
const base = { RESEND_API_KEY: 're_test_dummy', TURNSTILE_SECRET_KEY: 'live-style-secret-not-a-test-key' }
const sales = { ...base, SALES_INTAKE_URL: SALES, SALES_INTAKE_KEY_ID: 'web-test', SALES_INTAKE_SECRET: 'test-secret-'.padEnd(40, 'x') }
const submissionId = '3f2b8c1e-7a4d-4e6f-9b2a-1c3d5e7f9a0b'
const form = {
  type: 'Quote Request', name: 'Ada Test', email: 'Ada@Example.test', company: 'Test Ltd', message: 'Need a booking tool',
  service: 'Something else', service_other: 'Bespoke booking kiosk', consent: 'yes', website: '',
  submission_id: submissionId, 'cf-turnstile-response': 'token-abc',
}

const realFetch = globalThis.fetch
let calls
function stub({ verify = { success: true, action: 'contact', hostname: 'creovateglobal.com' }, salesStatus = 201, resendOk = true } = {}) {
  calls = []
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    calls.push({ url: u, init, body: init.body ? JSON.parse(init.body) : null, raw: init.body })
    if (u === SITEVERIFY) return new Response(JSON.stringify(verify), { status: 200 })
    if (u === SALES) {
      if (salesStatus === 'down') throw new TypeError('fetch failed')
      return new Response(JSON.stringify({ ok: salesStatus < 300 }), { status: salesStatus })
    }
    if (u === RESEND) return new Response('{}', { status: resendOk ? 200 : 500 })
    throw new Error(`unexpected fetch ${u}`)
  }
}
afterEach(() => { globalThis.fetch = realFetch })
const post = (env, data = form) => onRequestPost({
  env,
  request: new Request('https://creovateglobal.com/api/contact', {
    method: 'POST', body: JSON.stringify(data),
    headers: { 'content-type': 'application/json', referer: 'https://creovateglobal.com/quote?utm=x' },
  }),
})
const to = (url) => calls.filter((c) => c.url === url)

test('not configured (today): email-only, exactly as before, no Sales OS call', async () => {
  stub()
  const res = await post(base)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).ok, true)
  assert.equal(to(SALES).length, 0)
  const [notification, confirmation] = to(RESEND)
  assert.equal(to(RESEND).length, 2)
  assert.doesNotMatch(notification.body.subject, /Not in Sales OS/)
  assert.doesNotMatch(notification.body.text, /NOT RECORDED/)
  assert.match(notification.body.text, /Service description: Bespoke booking kiosk/)
  assert.deepEqual(confirmation.body.to, ['Ada@Example.test'])
})

test('configured: Turnstile first, then one signed call to Sales OS, then both emails', async () => {
  stub()
  const res = await post(sales)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).submission_id, submissionId)
  assert.deepEqual(calls.map((c) => c.url), [SITEVERIFY, SALES, RESEND, RESEND])

  const [call] = to(SALES)
  const h = call.init.headers
  assert.equal(h['x-creovate-key-id'], 'web-test')
  // Signature: HMAC-SHA256 over "v1\n<audience>\n<timestamp>\n<raw body>", computed independently here.
  const expected = createHmac('sha256', sales.SALES_INTAKE_SECRET)
    .update(`v1\nsales-os.enquiries\n${h['x-creovate-timestamp']}\n${call.raw}`).digest('hex')
  assert.equal(h['x-creovate-signature'], `v1=${expected}`)
  assert.ok(Math.abs(Number(h['x-creovate-timestamp']) - Date.now() / 1000) < 60)

  assert.deepEqual(Object.keys(call.body), ['submission_id', 'payload'])
  assert.equal(call.body.submission_id, submissionId)
  const p = call.body.payload
  assert.equal(p.email, 'ada@example.test', 'email normalised')
  assert.equal(p.company, 'Test Ltd')
  assert.equal(p.message, 'Need a booking tool')
  assert.equal(p.source_page, 'https://creovateglobal.com/quote', 'query string dropped')
  assert.deepEqual(p.fields, { service: 'Something else', service_other: 'Bespoke booking kiosk' })
  assert.doesNotMatch(call.raw, /token-abc|turnstile/i, 'Turnstile token never forwarded')
  assert.doesNotMatch(to(RESEND)[0].body.subject, /Not in Sales OS/, 'recorded: no flag')
})

for (const [name, salesStatus] of [['intake closed (503)', 503], ['Sales OS unreachable', 'down'], ['rejected signature (401)', 401]]) {
  test(`configured but ${name}: visitor still acknowledged, inbox email flagged for replay`, async () => {
    stub({ salesStatus })
    const res = await post(sales)
    assert.equal(res.status, 200)
    assert.equal((await res.json()).ok, true)
    const [notification] = to(RESEND)
    assert.match(notification.body.subject, /^\[Not in Sales OS\] /)
    assert.match(notification.body.text, new RegExp(`NOT RECORDED IN SALES OS[\\s\\S]*${submissionId}|${submissionId}[\\s\\S]*NOT RECORDED IN SALES OS`))
    assert.equal(to(RESEND).length, 2, 'confirmation still sent')
  })
}

test('configured, Sales OS down and email failing: visitor told to retry (nothing held)', async () => {
  stub({ salesStatus: 'down', resendOk: false })
  const res = await post(sales)
  assert.equal(res.status, 502)
  assert.equal(to(RESEND).length, 1, 'no confirmation when nothing was held')
})

test('configured: a failed Turnstile check never reaches Sales OS or email', async () => {
  stub({ verify: { success: false, 'error-codes': ['invalid-input-response'] } })
  assert.equal((await post(sales)).status, 403)
  assert.deepEqual(calls.map((c) => c.url), [SITEVERIFY])
})

test('a browser retry reuses the submission ID, so Sales OS records it once', async () => {
  stub()
  await post(sales); await post(sales)
  const ids = to(SALES).map((c) => c.body.submission_id)
  assert.deepEqual(ids, [submissionId, submissionId])
})
