// Cloudflare Pages Function — POST /api/contact
// One endpoint for all Creovate forms (General Enquiry, Quote Request, Project Brief,
// Workflow Review, Distribution Operations Review, Practice Workflow Review).
//
// 1. Validate + abuse controls (honeypot, size and field limits).
// 2. Record the enquiry in Sales OS (signed server-to-server call, stable submission ID).
// 3. Notify hello@creovateglobal.com via Resend. If Sales OS was unavailable the email
//    is flagged and carries the submission ID for replay, so nothing is lost.
// 4. Acknowledge only once the enquiry is held by Sales OS or the inbox.
//
// Pages secrets (server-only, never in client code):
//   RESEND_API_KEY                — required
//   SALES_INTAKE_URL              — e.g. https://intake.salesos.creovateglobal.com/v1/enquiries
//   SALES_INTAKE_KEY_ID / SALES_INTAKE_SECRET — HMAC key shared only with the Sales intake Worker
// Without the SALES_* values the form behaves exactly as before (email only).

const RESERVED = new Set(['website', 'type', 'consent', 'submission_id']);
const CORE = new Set(['name', 'email', 'company', 'firm', 'role', 'message', 'phone']);
const LABELS = {
  name: 'Name', email: 'Email', company: 'Company', firm: 'Firm',
  role: 'Role / position', branches: 'Branches / locations', team_size: 'Team size',
  systems: 'Systems used', software: 'Practice software', friction: 'Friction points',
  operations: 'How it works now', bottleneck: 'Biggest bottleneck',
  industry: 'Industry / sector', timeline: 'Timeline',
  contact_method: 'Preferred contact', service: 'Service', budget: 'Budget', message: 'Message'
};
const MAX_BODY = 32768;
const MAX_FIELDS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const label = (k) => LABELS[k] || k.replace(/_/g, ' ').replace(/^./, (m) => m.toUpperCase());

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'Your message is too long. Please shorten it or email us directly.' }, 413);
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ ok: false, error: 'Invalid request.' }, 400);

    // Honeypot — silently accept and drop bot submissions
    if (data.website) return json({ ok: true });

    const type = String(data.type || 'General Project Enquiry').trim().slice(0, 80);
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim();

    if (!name || !email || !data.consent) {
      return json({ ok: false, error: 'Please complete the required fields and agree to the privacy notice.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length > 200) {
      return json({ ok: false, error: 'Please enter a valid name and email address.' }, 400);
    }
    if (Object.keys(data).length > MAX_FIELDS + RESERVED.size) return json({ ok: false, error: 'Invalid request.' }, 400);
    if (!env.RESEND_API_KEY) {
      return json({ ok: false, error: 'Email service is not configured yet.' }, 500);
    }

    // Stable across browser retries of the same answers (see assets/js/main.js).
    const submissionId = UUID.test(String(data.submission_id || '')) ? data.submission_id : crypto.randomUUID();

    // Clean field list in form order: trimmed strings, empty and oversized values dropped.
    const fields = [];
    for (const [k, v] of Object.entries(data)) {
      if (RESERVED.has(k) || !/^[a-z_]{1,40}$/.test(k)) continue;
      const val = String(v == null ? '' : v).trim();
      if (!val || val.length > 5000) continue;
      fields.push([k, val]);
    }
    const get = (k) => (fields.find(([key]) => key === k) || [])[1];

    // ── 2. Sales OS (canonical CRM) ──
    let sales = { recorded: false, reason: 'not configured' };
    if (env.SALES_INTAKE_URL && env.SALES_INTAKE_KEY_ID && env.SALES_INTAKE_SECRET) {
      const payload = {
        schema_version: 1, enquiry_type: type, name: name.slice(0, 200), email: email.toLowerCase(),
        consent: true, fields: Object.fromEntries(fields.filter(([k]) => !CORE.has(k)).slice(0, MAX_FIELDS))
      };
      for (const [key, value] of [['company', get('company') || get('firm')], ['role', get('role')], ['message', get('message')], ['phone', get('phone')]]) {
        if (value) payload[key] = value.slice(0, key === 'message' ? 5000 : key === 'phone' ? 50 : 200);
      }
      const page = sourcePage(request.headers.get('referer'));
      if (page) payload.source_page = page;
      sales = await recordInSales(env, submissionId, payload);
    }

    // ── 3. Notification email (always), flagged when Sales OS did not record it ──
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    let rowsHtml = '', rowsText = '';
    for (const [k, val] of fields) {
      rowsHtml += `<p style="margin:0 0 8px"><strong>${esc(label(k))}:</strong> ${esc(val).replace(/\n/g, '<br>')}</p>`;
      rowsText += `${label(k)}: ${val}\n`;
    }
    const flag = sales.recorded ? '' : '[Not in Sales OS] ';
    const html =
      `<h2 style="margin:0 0 4px">${esc(type)}</h2>` +
      `<p style="margin:0 0 14px;color:#888">via creovateglobal.com</p>` +
      (sales.recorded ? '' : `<p style="padding:8px;background:#fff3cd"><strong>Not recorded in Sales OS</strong> (${esc(sales.reason)}). Add it manually or replay with submission ID ${esc(submissionId)}.</p>`) +
      rowsHtml +
      `<p style="margin-top:14px;color:#888;font-size:12px">Consent given · Submission type: ${esc(type)} · Submission ID: ${esc(submissionId)}</p>`;
    const text = `${type}\nvia creovateglobal.com\n\n${rowsText}\nConsent given\nSubmission ID: ${submissionId}` +
      (sales.recorded ? '' : `\n\nNOT RECORDED IN SALES OS (${sales.reason}). Add it manually or replay with this submission ID.`);

    let emailed = false;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `enquiry-${submissionId}` },
        body: JSON.stringify({
          from: 'Creovate Website <noreply@creovateglobal.com>',
          to: ['hello@creovateglobal.com'],
          reply_to: email,
          subject: `${flag}${type} — ${name}`,
          html,
          text
        })
      });
      emailed = res.ok;
    } catch (e) { emailed = false; }

    // ── 4. Acknowledge only when the enquiry is held somewhere durable ──
    if (!sales.recorded && !emailed) {
      return json({ ok: false, error: 'Could not send right now. Please try again shortly.' }, 502);
    }

    // Best-effort confirmation to the enquirer (never fails the request)
    try {
      const first = esc(name.split(' ')[0] || name);
      const isReview = /Review$/.test(type);
      const what = isReview ? `your ${esc(type)} request` : 'your enquiry';
      const cHtml =
        `<p>Hi ${first},</p>` +
        `<p>Thanks for reaching out to Creovate Global. We've received ${what} and will reply within 24 hours — usually sooner — to arrange a time.</p>` +
        `<p>— Creovate Global<br>hello@creovateglobal.com</p>`;
      const cText =
        `Hi ${name.split(' ')[0] || name},\n\n` +
        `Thanks for reaching out to Creovate Global. We've received ${isReview ? 'your ' + type + ' request' : 'your enquiry'} ` +
        `and will reply within 24 hours — usually sooner — to arrange a time.\n\n— Creovate Global\nhello@creovateglobal.com`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `ack-${submissionId}` },
        body: JSON.stringify({
          from: 'Creovate Global <noreply@creovateglobal.com>',
          to: [email],
          reply_to: 'hello@creovateglobal.com',
          subject: 'We’ve received your request — Creovate Global',
          html: cHtml,
          text: cText
        })
      });
    } catch (e) { /* confirmation is non-critical */ }

    return json({ ok: true, submission_id: submissionId });
  } catch (err) {
    return json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
}

// Only creovateglobal.com pages are recorded as the source; anything else is dropped.
function sourcePage(referer) {
  try {
    const u = new URL(referer || '');
    if (u.protocol !== 'https:' || !/^([a-z0-9-]+\.)*creovateglobal\.com$/.test(u.hostname)) return null;
    const path = u.pathname.replace(/[^A-Za-z0-9/_.-]/g, '').slice(0, 150);
    return `https://${u.hostname}${path}`;
  } catch { return null; }
}

// Signed call to the Sales OS intake Worker. Signature: HMAC-SHA256 over
// "v1\n<audience>\n<unix seconds>\n<body>" (see Sales OS server/src/signing.ts).
async function recordInSales(env, submissionId, payload, now = Date.now()) {
  const body = JSON.stringify({ submission_id: submissionId, payload });
  const timestamp = String(Math.floor(now / 1000));
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(env.SALES_INTAKE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`v1\nsales-os.enquiries\n${timestamp}\n${body}`));
    const signature = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
    const res = await fetch(env.SALES_INTAKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-creovate-key-id': env.SALES_INTAKE_KEY_ID,
        'x-creovate-timestamp': timestamp, 'x-creovate-signature': `v1=${signature}`
      },
      body,
      signal: AbortSignal.timeout(8000)
    });
    if (res.status === 200 || res.status === 201) return { recorded: true, reason: '' };
    return { recorded: false, reason: `Sales OS HTTP ${res.status}` };
  } catch (e) {
    return { recorded: false, reason: 'Sales OS unreachable' };
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
