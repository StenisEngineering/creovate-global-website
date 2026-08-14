// Cloudflare Pages Function — POST /api/contact
// Sends contact-form enquiries to hello@creovateglobal.com via Resend.
// Requires a Pages environment variable/secret: RESEND_API_KEY

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json().catch(() => null);
    if (!data) return json({ ok: false, error: 'Invalid request.' }, 400);

    // Honeypot — silently accept and drop bot submissions
    if (data.company) return json({ ok: true });

    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim();
    const service = String(data.service || '').trim();
    const budget = String(data.budget || 'Not specified').trim();
    const message = String(data.message || '').trim();

    if (!name || !email || !service || !message) {
      return json({ ok: false, error: 'Please fill in all required fields.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
    }
    if (message.length > 5000) {
      return json({ ok: false, error: 'Message is too long.' }, 400);
    }

    if (!env.RESEND_API_KEY) {
      return json({ ok: false, error: 'Email service is not configured yet.' }, 500);
    }

    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const html =
      `<h2 style="margin:0 0 12px">New enquiry from creovateglobal.com</h2>` +
      `<p><strong>Name:</strong> ${esc(name)}</p>` +
      `<p><strong>Email:</strong> ${esc(email)}</p>` +
      `<p><strong>Service:</strong> ${esc(service)}</p>` +
      `<p><strong>Budget:</strong> ${esc(budget)}</p>` +
      `<p><strong>Message:</strong></p>` +
      `<p style="white-space:pre-wrap">${esc(message)}</p>`;
    const text =
      `New enquiry from creovateglobal.com\n\n` +
      `Name: ${name}\nEmail: ${email}\nService: ${service}\nBudget: ${budget}\n\n` +
      `Message:\n${message}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Creovate Website <noreply@creovateglobal.com>',
        to: ['hello@creovateglobal.com'],
        reply_to: email,
        subject: `New enquiry — ${service}`,
        html,
        text
      })
    });

    if (!res.ok) {
      return json({ ok: false, error: 'Could not send right now. Please try again shortly.' }, 502);
    }

    // Best-effort confirmation email to the enquirer (never fails the request)
    try {
      const cHtml =
        `<p>Hi ${esc(name.split(' ')[0] || name)},</p>` +
        `<p>Thanks for reaching out to Creovate Global. We've received your enquiry about <strong>${esc(service)}</strong> and will reply within 24 hours — usually sooner.</p>` +
        `<p>For reference, here's what you sent:</p>` +
        `<p style="white-space:pre-wrap;color:#555">${esc(message)}</p>` +
        `<p>— Creovate Global<br>hello@creovateglobal.com</p>`;
      const cText =
        `Hi ${name.split(' ')[0] || name},\n\n` +
        `Thanks for reaching out to Creovate Global. We've received your enquiry about ${service} and will reply within 24 hours — usually sooner.\n\n` +
        `For reference, here's what you sent:\n${message}\n\n— Creovate Global\nhello@creovateglobal.com`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Creovate Global <noreply@creovateglobal.com>',
          to: [email],
          reply_to: 'hello@creovateglobal.com',
          subject: 'We’ve received your enquiry — Creovate Global',
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
