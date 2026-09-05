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

// ── FORMS: general enquiry + sector reviews all post to /api/contact ──
document.querySelectorAll('form.js-cform').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = form.querySelector('.form-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    // Honeypot — real users never fill this hidden field
    if (form.querySelector('[name="website"]')?.value) return;

    if (!form.checkValidity()) { form.reportValidity(); return; }

    // Serialise every named field in DOM order
    const payload = {};
    new FormData(form).forEach((v, k) => { payload[k] = typeof v === 'string' ? v.trim() : v; });
    payload.consent = form.querySelector('[name="consent"]')?.checked ? 'yes' : '';

    const btn = form.querySelector('.form-submit');
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
