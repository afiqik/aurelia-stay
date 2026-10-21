/* AURELIA STAY — scroll motion (progressive enhancement).
   data-reveal="up|left|right|scale|clip|fade"  data-reveal-delay="ms"
   data-parallax="0.12"   data-count="20" (animates the number inside)
   data-marquee="40" (px/sec)   data-scroll-progress   data-header */
(function () {
  if (window.__aureliaMotion) return; window.__aureliaMotion = true;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.16,.8,.24,1)';
  const FROM = { up: 'translate3d(0,36px,0)', left: 'translate3d(-40px,0,0)', right: 'translate3d(40px,0,0)', scale: 'scale(.94)', fade: 'none', clip: 'none' };
  const prepped = new WeakSet(), counted = new WeakSet(), parallax = new Set(), marquees = new Set();
  let progressEls = [], headers = [];

  const show = el => {
    el.style.opacity = '1'; el.style.transform = 'none';
    if (el.dataset.reveal === 'clip') el.style.clipPath = 'inset(0 0 0 0)';
    if (el.dataset.count && !counted.has(el)) countUp(el);
  };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;

  function prep(el) {
    if (prepped.has(el)) return; prepped.add(el);
    if (reduce || !io) { if (el.dataset.count) countUp(el); return; }
    const kind = el.dataset.reveal || 'up'; const d = Number(el.dataset.revealDelay || 0);
    el.style.opacity = kind === 'clip' ? '1' : '0';
    el.style.transform = FROM[kind] || FROM.up;
    if (kind === 'clip') el.style.clipPath = 'inset(0 0 100% 0)';
    el.style.transition = 'opacity .9s ' + EASE + ' ' + d + 'ms, transform 1s ' + EASE + ' ' + d + 'ms, clip-path 1.2s ' + EASE + ' ' + d + 'ms';
    el.style.willChange = 'opacity, transform';
    requestAnimationFrame(() => io.observe(el));
  }
  function countUp(el) {
    counted.add(el);
    const target = parseFloat(el.dataset.count); if (!isFinite(target)) return;
    const pre = el.dataset.countPrefix || '', suf = el.dataset.countSuffix || '';
    if (reduce) { el.textContent = pre + target + suf; return; }
    const dur = 1400, t0 = performance.now();
    const tick = t => { const p = Math.min(1, (t - t0) / dur); const v = Math.round(target * (1 - Math.pow(1 - p, 3))); el.textContent = pre + v + suf; if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  function scan(root) {
    (root.querySelectorAll ? root : document).querySelectorAll('[data-reveal],[data-count]').forEach(el => { if (el.dataset.reveal || el.dataset.count) prep(el); });
    document.querySelectorAll('[data-parallax]').forEach(el => parallax.add(el));
    document.querySelectorAll('[data-marquee]').forEach(el => { if (!marquees.has(el)) { marquees.add(el); el.__x = 0; } });
    progressEls = Array.from(document.querySelectorAll('[data-scroll-progress]'));
    headers = Array.from(document.querySelectorAll('[data-header]'));
  }
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = innerHeight, max = document.documentElement.scrollHeight - vh;
      progressEls.forEach(el => { el.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')'; });
      headers.forEach(el => { const s = scrollY > 12; el.style.boxShadow = s ? '0 10px 30px rgba(78,22,23,.08)' : 'none'; el.style.backgroundColor = s ? 'rgba(242,242,242,.88)' : 'rgba(242,242,242,1)'; });
      if (reduce) return;
      parallax.forEach(el => {
        if (!el.isConnected) { parallax.delete(el); return; }
        const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) return;
        const f = Number(el.dataset.parallax || 0.1); const c = r.top + r.height / 2 - vh / 2;
        el.style.transform = 'translate3d(0,' + (-c * f).toFixed(1) + 'px,0) scale(' + (el.dataset.parallaxScale || 1) + ')';
      });
    });
  }
  let last = performance.now();
  function loop(t) {
    const dt = Math.min(64, t - last) / 1000; last = t;
    if (!reduce) {
      document.querySelectorAll('[data-kenburns]').forEach(el => { el.style.transform = 'scale(' + (1.08 + 0.05 * Math.sin(t / 5200)).toFixed(4) + ') translate3d(' + (Math.sin(t / 7300) * 1.2).toFixed(2) + '%,' + (Math.cos(t / 8100) * 1).toFixed(2) + '%,0)'; });
      document.querySelectorAll('[data-float]').forEach((el, i) => { const a = Number(el.dataset.float || 8); el.style.translate = '0 ' + (Math.sin(t / 1400 + i * 1.3) * a).toFixed(1) + 'px'; });
    }
    if (!reduce) marquees.forEach(el => {
      if (!el.isConnected) { marquees.delete(el); return; }
      const half = el.scrollWidth / 2; if (!half) return;
      el.__x = (el.__x - Number(el.dataset.marquee || 40) * dt) % half;
      el.style.transform = 'translate3d(' + el.__x.toFixed(1) + 'px,0,0)';
    });
    requestAnimationFrame(loop);
  }
  const mo = new MutationObserver(ms => { let hit = false; ms.forEach(m => { if (m.addedNodes.length) hit = true; }); if (hit) { scan(document); onScroll(); } });
  function start() { scan(document); onScroll(); mo.observe(document.body, { childList: true, subtree: true }); requestAnimationFrame(loop); }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
