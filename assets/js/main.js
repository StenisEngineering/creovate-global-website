// ── NAV SCROLL ──
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 24);
});
// immediate check
if (window.scrollY > 24) nav.classList.add('scrolled');

// ── MOBILE MENU ──
const toggle = document.querySelector('.mobile-toggle');
const drawer = document.getElementById('navDrawer');
if (toggle && drawer) {
  toggle.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    const spans = toggle.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'rotate(45deg) translate(4.5px,4.5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(4.5px,-4.5px)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });
  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      drawer.classList.remove('open');
      toggle.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    });
  });
}

// ── SCROLL REVEAL ──
const srObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('vis');
      srObs.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.sr').forEach(el => srObs.observe(el));

// ── FAQ ──
function toggleFaq(el) {
  const item = el.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// ── TURNSTILE: bot check on every form; the token is verified in /api/contact ──
// The site key is public. Local development uses Cloudflare's always-pass test key.
const TURNSTILE_SITE_KEY = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? '1x00000000000000000000AA'
  : '0x4AAAAAAFWBtDP1V2o-3Pps';
const turnstileWidgets = new Map(); // form → widget ID
const turnstileFailed = new Set(); // forms whose widget could not run
let turnstileScriptFailed = false;
const contactForms = document.querySelectorAll('form.js-cform');
if (contactForms.length) {
  window.onTurnstileLoad = () => contactForms.forEach((form) => {
    const slot = document.createElement('div');
    slot.className = 'form-turnstile';
    (form.querySelector('.form-submit') || form.lastElementChild).before(slot);
    turnstileWidgets.set(form, window.turnstile.render(slot, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'contact', // checked server-side
      theme: 'light',
      size: slot.clientWidth < 300 ? 'compact' : 'normal', // normal is 300px wide
      appearance: 'interaction-only', // invisible unless a visitor must interact
      'before-interactive-callback': () => { slot.style.margin = '0 0 1rem'; },
      'after-interactive-callback': () => { slot.style.margin = ''; },
      callback: () => turnstileFailed.delete(form),
      'error-callback': () => { turnstileFailed.add(form); }
    }));
  });
  const ts = document.createElement('script');
  ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
  ts.async = true;
  ts.onerror = () => { turnstileScriptFailed = true; };
  document.head.appendChild(ts);
}
const resetTurnstile = (form) => {
  const id = turnstileWidgets.get(form);
  if (id !== undefined) window.turnstile.reset(id); // tokens are single-use
};

// ── "Something else" details: shown and required only for that choice ──
document.querySelectorAll('[data-other-for]').forEach((grp) => {
  const select = document.getElementById(grp.dataset.otherFor);
  const input = grp.querySelector('input, textarea');
  if (!select || !input) return;
  const sync = () => {
    const show = select.value === grp.dataset.otherValue;
    grp.hidden = !show;
    input.required = show;
    if (!show) input.value = '';
  };
  select.addEventListener('change', sync);
  sync(); // also covers a value restored by the browser
});

// ── FORMS: general enquiry + sector reviews all post to /api/contact ──
contactForms.forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = form.querySelector('.form-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    // Honeypot — real users never fill this hidden field
    if (form.querySelector('[name="website"]')?.value) return;

    if (!form.checkValidity()) { form.reportValidity(); return; }

    const widget = turnstileWidgets.get(form);
    const turnstileToken = widget === undefined ? '' : window.turnstile.getResponse(widget);
    if (!turnstileToken) {
      const broken = turnstileScriptFailed || turnstileFailed.has(form);
      if (errEl) {
        errEl.textContent = broken
          ? 'Our security check could not run in this browser. Please allow challenges.cloudflare.com, reload the page, or email hello@creovateglobal.com directly.'
          : 'Please wait a moment while we complete a quick security check, then send again.';
        errEl.style.display = 'block';
      }
      if (turnstileFailed.has(form)) resetTurnstile(form);
      return;
    }

    // Serialise every named field in DOM order. The single-use Turnstile token is
    // sent alongside, not as one of the answers.
    const payload = {};
    new FormData(form).forEach((v, k) => {
      if (k !== 'cf-turnstile-response') payload[k] = typeof v === 'string' ? v.trim() : v;
    });
    payload.consent = form.querySelector('[name="consent"]')?.checked ? 'yes' : '';

    const btn = form.querySelector('.form-submit');
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, 'cf-turnstile-response': turnstileToken })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.style.display = 'none';
        const succ = form.nextElementSibling;
        if (succ && succ.classList.contains('form-success')) succ.classList.add('show');
        return;
      }
      throw new Error(data.error || 'Message could not be sent.');
    } catch (err) {
      if (errEl) {
        errEl.textContent = (err && err.message ? err.message : 'Something went wrong.') +
          ' You can also email hello@creovateglobal.com directly.';
        errEl.style.display = 'block';
      }
      if (btn) { btn.disabled = false; btn.textContent = label; }
      resetTurnstile(form);
    }
  });
});

// ── FOOTER YEAR ──
const yr = document.getElementById('year');
if (yr) yr.textContent = new Date().getFullYear();

// ── Premium hover is handled in CSS; traditional cursor behaviour retained. ──

// ── STAT COUNTER ANIMATION ──
function animateCount(el, target, suffix = '') {
  const dur = 1400;
  const start = performance.now();
  const isNum = !isNaN(parseFloat(target));
  if (!isNum) return;
  const num = parseFloat(target);
  const update = (now) => {
    const t = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = (num * ease).toFixed(num % 1 !== 0 ? 1 : 0) + suffix;
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
const statObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      const raw = el.dataset.count;
      const suffix = el.dataset.suffix || '';
      if (raw) animateCount(el, raw, suffix);
      statObs.unobserve(el);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => statObs.observe(el));
