// /api/contact Turnstile protection. Node's built-in runner; every network call is
// stubbed (Siteverify and Resend), so nothing leaves this machine.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { onRequestPost } from '../functions/api/contact.js'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const RESEND = 'https://api.resend.com/emails'
const env = { RESEND_API_KEY: 're_test_dummy', TURNSTILE_SECRET_KEY: 'live-style-secret-not-a-test-key' }
const form = { type: 'General Enquiry', name: 'Ada Test', email: 'ada@example.test', message: 'Hello', consent: 'yes', website: '', 'cf-turnstile-response': 'token-abc' }

const realFetch = globalThis.fetch
let calls
function stub(siteverify = () => ({ success: true, action: 'contact', hostname: 'creovateglobal.com' })) {
  calls = []
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ url: String(url), body })
    if (String(url) === SITEVERIFY) {
      const r = siteverify(body)
      if (r instanceof Error) throw r
      return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (String(url) === RESEND) return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 })
    throw new Error(`unexpected fetch ${url}`)
  }
}
afterEach(() => { globalThis.fetch = realFetch })

const post = (data, e = env, host = 'creovateglobal.com') => onRequestPost({
  env: e,
  request: new Request(`https://${host}/api/contact`, {
    method: 'POST', body: JSON.stringify(data),
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' }
  })
})
const emails = () => calls.filter(c => c.url === RESEND)
const verifications = () => calls.filter(c => c.url === SITEVERIFY)

test('valid token: verified once, then notification and confirmation are sent as before', async () => {
  stub()
  const res = await post(form)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).ok, true)
  const [v] = verifications()
  assert.deepEqual(v.body, { secret: env.TURNSTILE_SECRET_KEY, response: 'token-abc', remoteip: '203.0.113.7' })
  assert.equal(verifications().length, 1)
  const sent = emails()
  assert.equal(sent.length, 2, 'notification + confirmation')
  assert.deepEqual(sent[0].body.to, ['hello@creovateglobal.com'])
  assert.equal(sent[0].body.reply_to, 'ada@example.test')
  assert.deepEqual(sent[1].body.to, ['ada@example.test'])
  assert.ok(calls.indexOf(v) < calls.indexOf(sent[0]), 'verification happens before any email')
  for (const e of sent) assert.doesNotMatch(JSON.stringify(e.body), /token-abc|turnstile/i, 'token never emailed')
})

for (const [name, data, status] of [
  ['missing token', { ...form, 'cf-turnstile-response': undefined }, 400],
  ['empty token', { ...form, 'cf-turnstile-response': '' }, 400],
  ['non-string token', { ...form, 'cf-turnstile-response': ['x'] }, 400],
  ['oversized token', { ...form, 'cf-turnstile-response': 'x'.repeat(2049) }, 400],
]) {
  test(`${name}: rejected without calling Siteverify or sending email`, async () => {
    stub()
    const res = await post(data)
    assert.equal(res.status, status)
    assert.equal((await res.json()).ok, false)
    assert.equal(calls.length, 0)
  })
}

for (const [name, result] of [
  ['invalid token', { success: false, 'error-codes': ['invalid-input-response'] }],
  ['expired or reused token', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
  ['wrong action', { success: true, action: 'login', hostname: 'creovateglobal.com' }],
  ['token issued on another site', { success: true, action: 'contact', hostname: 'evil.example' }],
  ['malformed Siteverify reply', null],
]) {
  test(`${name}: 403 and no email`, async () => {
    stub(() => result)
    const res = await post(form)
    assert.equal(res.status, 403)
    assert.match((await res.json()).error, /security check/)
    assert.equal(emails().length, 0)
  })
}

test('Siteverify unreachable: 503 and no email', async () => {
  stub(() => new TypeError('network down'))
  const res = await post(form)
  assert.equal(res.status, 503)
  assert.match((await res.json()).error, /unavailable/)
  assert.equal(emails().length, 0)
})

test('secret not configured: fails closed, no network calls at all', async () => {
  stub()
  const res = await post(form, { RESEND_API_KEY: env.RESEND_API_KEY })
  assert.equal(res.status, 503)
  assert.equal(calls.length, 0)
})

test('www and preview hosts are accepted when the token was issued there', async () => {
  for (const host of ['www.creovateglobal.com', 'abc123.creovate-website.pages.dev']) {
    stub(() => ({ success: true, action: 'contact', hostname: host }))
    assert.equal((await post(form, env, host)).status, 200, host)
  }
})

test('field errors are returned before verification, so the token is not spent', async () => {
  stub()
  assert.equal((await post({ ...form, consent: '' })).status, 400)
  assert.equal((await post({ ...form, email: 'not-an-email' })).status, 400)
  assert.equal(calls.length, 0)
})

test('honeypot still drops bots silently without any network call', async () => {
  stub()
  const res = await post({ ...form, website: 'http://spam.example' })
  assert.equal(res.status, 200)
  assert.equal(calls.length, 0)
})

test("Cloudflare's test secret skips action/hostname checks (local testing only)", async () => {
  stub(() => ({ success: true, hostname: 'example.com', action: '' }))
  assert.equal((await post(form, { ...env, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' })).status, 200)
  stub(() => ({ success: true, hostname: 'example.com', action: '' }))
  assert.equal((await post(form)).status, 403, 'a real secret still enforces them')
})

test('all six forms use the shared handler that adds Turnstile', async () => {
  const pages = ['contact', 'quote', 'start-project', 'review', 'distribution', 'accounting']
  for (const page of pages) {
    const html = await readFile(new URL(`../${page}.html`, import.meta.url), 'utf8')
    const forms = html.match(/<form\b[^>]*>/g) || []
    assert.equal(forms.length, 1, page)
    assert.match(forms[0], /class="js-cform"/, page)
    assert.match(forms[0], /action="\/api\/contact"/, page)
    assert.match(html, /class="[^"]*form-submit/, page)
    assert.match(html, /<script src="assets\/js\/main\.js"><\/script>/, page)
  }
  const main = await readFile(new URL('../assets/js/main.js', import.meta.url), 'utf8')
  assert.match(main, /turnstile\/v0\/api\.js\?render=explicit/)
  assert.match(main, /action: 'contact'/)
  assert.match(main, /'cf-turnstile-response': turnstileToken/)
  assert.match(main, /if \(k !== 'cf-turnstile-response'\)/, 'token kept out of the answers')
  assert.doesNotMatch(main, /TURNSTILE_SECRET|siteverify/i, 'no secret or server call in client code')
})

test('release guard: the production site key is set before merge', async (t) => {
  const main = await readFile(new URL('../assets/js/main.js', import.meta.url), 'utf8')
  const key = main.match(/\? '1x00000000000000000000AA'\s*:\s*'([^']+)'/)?.[1]
  assert.ok(key, 'site key constant found')
  if (key === 'REPLACE_WITH_TURNSTILE_SITE_KEY') { t.todo('add the real Turnstile site key in assets/js/main.js'); return }
  assert.match(key, /^0x[0-9A-Za-z_-]{20,}$/, 'Turnstile site keys start with 0x')
})

// ── "Something else" service description ──
test('service description is included in the notification email', async () => {
  stub()
  const res = await post({ ...form, type: 'Quote Request', service: 'Something else', service_other: 'Bespoke booking kiosk' })
  assert.equal(res.status, 200)
  const [notification, confirmation] = emails()
  assert.match(notification.body.text, /Service: Something else\n/)
  assert.match(notification.body.text, /Service description: Bespoke booking kiosk\n/)
  assert.match(notification.body.html, /<strong>Service description:<\/strong> Bespoke booking kiosk/)
  assert.doesNotMatch(confirmation.body.text, /Bespoke/, 'confirmation email unchanged')
  assert.equal(verifications().length, 1, 'Turnstile still verified')
})

test('contact, quote and start-project get the description field, hidden and optional by default', async () => {
  for (const [page, select, label] of [
    ['contact', 'f-svc', 'Please describe what you need'],
    ['quote', 'q-service', 'Please describe the service you need'],
    ['start-project', 'p-type', 'Please describe the service you need'],
  ]) {
    const html = await readFile(new URL(`../${page}.html`, import.meta.url), 'utf8')
    const groups = html.match(/<div class="form-grp" data-other-for="[^"]+"[^>]*>.*?<\/div>/g) || []
    assert.equal(groups.length, 1, page)
    const grp = groups[0]
    assert.match(grp, new RegExp(`data-other-for="${select}"`), page)
    assert.match(grp, /data-other-value="Something else"/, page)
    assert.match(grp, / hidden>/, `${page}: hidden until chosen`)
    assert.match(grp, new RegExp(`<label for="([^"]+)">${label}</label><input id="\\1" type="text" name="service_other"`), page)
    assert.doesNotMatch(grp, /required/, `${page}: not required in markup`)
    const start = html.search(new RegExp(`<select id="${select}" name="service"[ >]`))
    assert.ok(start > 0, `${page}: dropdown exists`)
    const dropdown = html.slice(start, html.indexOf('</select>', start))
    assert.match(dropdown, /<option>Something else<\/option>/, `${page}: trigger option exists`)
    assert.ok(html.indexOf(grp) > start, `${page}: field sits after its dropdown`)
  }
  for (const page of ['review', 'distribution', 'accounting'])
    assert.doesNotMatch(await readFile(new URL(`../${page}.html`, import.meta.url), 'utf8'), /data-other-for/, page)
  assert.match(await readFile(new URL('../assets/css/styles.css', import.meta.url), 'utf8'), /\.form-grp\[hidden\] \{ display: none; \}/)
})

test('contact form: "Something else" description reaches the notification email', async () => {
  stub()
  const res = await post({ ...form, type: 'General Enquiry', service: 'Something else', service_other: 'Help choosing a CRM' })
  assert.equal(res.status, 200)
  const [notification] = emails()
  assert.match(notification.body.text, /Service: Something else\n/)
  assert.match(notification.body.text, /Service description: Help choosing a CRM\n/)
})

test('conditional behaviour: shown and required only for "Something else", cleared otherwise', async () => {
  // Run the real block from main.js against a minimal page model.
  const main = await readFile(new URL('../assets/js/main.js', import.meta.url), 'utf8')
  const start = main.indexOf('// ── "Something else" details')
  const block = main.slice(start, main.indexOf('// ── FORMS:', start))
  const select = { value: '', listeners: [], addEventListener(type, fn) { if (type === 'change') this.listeners.push(fn) } }
  const input = { value: '', required: false }
  const grp = { hidden: true, dataset: { otherFor: 'q-service', otherValue: 'Something else' }, querySelector: () => input }
  const document = { querySelectorAll: () => [grp], getElementById: (id) => (id === 'q-service' ? select : null) }
  new Function('document', block)(document)
  const choose = (v) => { select.value = v; select.listeners.forEach((fn) => fn()) }

  assert.deepEqual([grp.hidden, input.required], [true, false], 'hidden and optional on load')
  choose('Web application')
  assert.deepEqual([grp.hidden, input.required], [true, false])
  choose('Something else')
  assert.deepEqual([grp.hidden, input.required], [false, true], 'shown and required')
  input.value = 'Bespoke booking kiosk'
  choose('Workflow automation')
  assert.deepEqual([grp.hidden, input.required, input.value], [true, false, ''], 'hidden, optional and cleared')
  choose('Something else')
  assert.equal(input.value, '', 'old text does not come back')
  // A value restored by the browser before the script runs is honoured on load.
  select.value = 'Something else'; grp.hidden = true; input.required = false
  new Function('document', block)(document)
  assert.deepEqual([grp.hidden, input.required], [false, true])
})
