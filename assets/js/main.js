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

// ── CONTACT FORM: static-site friendly mailto enquiry ──
function handleForm() {
  const name = document.getElementById('f-name')?.value.trim();
  const email = document.getElementById('f-email')?.value.trim();
  const svc = document.getElementById('f-svc')?.value;
  const budget = document.getElementById('f-budget')?.value || 'Not specified';
  const msg = document.getElementById('f-msg')?.value.trim();
  if (!name || !email || !svc || !msg) { alert('Please fill in all required fields.'); return; }
  const subject = encodeURIComponent(`Creovate project enquiry — ${svc}`);
  const body = encodeURIComponent(
    `Hello Creovate Global,\n\n` +
    `My name is ${name}.\n` +
    `Email: ${email}\n` +
    `Service needed: ${svc}\n` +
    `Budget range: ${budget}\n\n` +
    `Project message:\n${msg}\n\n` +
    `Sent from creovateglobal.com.`
  );
  const link = `mailto:hello@creovateglobal.com?subject=${subject}&body=${body}`;
  window.location.href = link;
  document.getElementById('fsuccess')?.classList.add('show');
}

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
