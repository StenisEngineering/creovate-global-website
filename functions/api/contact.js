// Cloudflare Pages Function — POST /api/contact
// One endpoint for all Creovate forms: General Project Enquiry,
// Distribution Operations Review, Practice Workflow Review.
// Sends to hello@creovateglobal.com via Resend + a confirmation to the enquirer.
// Requires Pages secrets: RESEND_API_KEY, TURNSTILE_SECRET_KEY.
// Every submission must carry a Turnstile token that Siteverify accepts before any
// email is sent; without TURNSTILE_SECRET_KEY the form fails closed.

const RESERVED = new Set(['website', 'type', 'consent']);
const LABELS = {
  name: 'Name', email: 'Email', company: 'Company', firm: 'Firm',
  role: 'Role / position', branches: 'Branches / locations', team_size: 'Team size',
  systems: 'Systems used', software: 'Practice software', friction: 'Friction points',
  operations: 'How it works now', bottleneck: 'Biggest bottleneck',
  industry: 'Industry / sector', timeline: 'Timeline',
  contact_method: 'Preferred contact', service: 'Service', service_other: 'Service description',
  budget: 'Budget', message: 'Message'
};
const label = (k) => LABELS[k] || k.replace(/_/g, ' ').replace(/^./, (m) => m.toUpperCase());

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json().catch(() => null);
    if (!data) return json({ ok: false, error: 'Invalid request.' }, 400);

    // Turnstile adds this field to the form; it is checked below and never emailed.
    const turnstileToken = data[TURNSTILE_FIELD];
    delete data[TURNSTILE_FIELD];

    // Honeypot — silently accept and drop bot submissions
    if (data.website) return json({ ok: true });

    const type = String(data.type || 'General Project Enquiry').trim();
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim();

    if (!name || !email || !data.consent) {
      return json({ ok: false, error: 'Please complete the required fields and agree to the privacy notice.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
    }

    // Bot check before anything is sent. Field errors above return first, so the
    // visitor can correct them without the token being spent.
    const check = await verifyTurnstile(env, turnstileToken, request);
    if (!check.ok) return json({ ok: false, error: check.error }, check.status);

    if (!env.RESEND_API_KEY) {
      return json({ ok: false, error: 'Email service is not configured yet.' }, 500);
    }

    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

    // Build a readable field list from whatever the form sent (in form order)
    let rowsHtml = '', rowsText = '';
    for (const [k, v] of Object.entries(data)) {
      if (RESERVED.has(k)) continue;
      const val = String(v == null ? '' : v).trim();
      if (!val) continue;
      if (val.length > 5000) continue;
      rowsHtml += `<p style="margin:0 0 8px"><strong>${esc(label(k))}:</strong> ${esc(val).replace(/\n/g, '<br>')}</p>`;
      rowsText += `${label(k)}: ${val}\n`;
    }

    const html =
      `<h2 style="margin:0 0 4px">${esc(type)}</h2>` +
      `<p style="margin:0 0 14px;color:#888">via creovateglobal.com</p>` +
      rowsHtml +
      `<p style="margin-top:14px;color:#888;font-size:12px">Consent given · Submission type: ${esc(type)}</p>`;
    const text = `${type}\nvia creovateglobal.com\n\n${rowsText}\nConsent given`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Creovate Website <noreply@creovateglobal.com>',
        to: ['hello@creovateglobal.com'],
        reply_to: email,
        subject: `${type} — ${name}`,
        html,
        text
      })
    });
    if (!res.ok) {
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
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
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

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
}

// ── Cloudflare Turnstile (server-side Siteverify) ──
const TURNSTILE_FIELD = 'cf-turnstile-response';
const TURNSTILE_ACTION = 'contact'; // must match the action set in assets/js/main.js
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare's published test secrets return fixed results without a real action or
// hostname. Production secrets reject test tokens, so this only affects local testing.
const TEST_SECRET = /^[123]x0{31}AA$/;

export async function verifyTurnstile(env, token, request) {
  const unavailable = { ok: false, status: 503, error: 'Our security check is unavailable right now. Please try again shortly.' };
  if (!env.TURNSTILE_SECRET_KEY) return unavailable; // fail closed
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return { ok: false, status: 400, error: 'Please complete the security check and try again.' };
  }
  let result;
  try {
    const res = await fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get('CF-Connecting-IP') || undefined
      }),
      signal: AbortSignal.timeout(5000)
    });
    result = await res.json();
  } catch (e) {
    return unavailable;
  }
  const failed = { ok: false, status: 403, error: 'The security check expired or could not be confirmed. Please try again.' };
  if (!result || result.success !== true) return failed;
  if (!TEST_SECRET.test(env.TURNSTILE_SECRET_KEY)) {
    // A token is only valid for this form and the site it was issued on.
    if (result.action !== TURNSTILE_ACTION) return failed;
    if (result.hostname !== new URL(request.url).hostname) return failed;
  }
  return { ok: true };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
