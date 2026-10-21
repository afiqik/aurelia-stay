/* AURELIA STAY — store bootstrap. The real engine is modular (shared/core/*.js, Firebase-backed).
 * window.AureliaStore exists only AFTER auth state + first listener snapshots are in, so pages may read it synchronously once it is defined. */
(function () {
  if (window.AureliaStoreReady) return;
  const here = document.currentScript && document.currentScript.src;
  const entry = here ? new URL('core/index.js', here).href : './core/index.js';

  function banner(err) {
    const show = () => {
      if (document.getElementById('aurelia-store-error')) return;
      const b = document.createElement('div'); b.id = 'aurelia-store-error'; b.setAttribute('role', 'alert');
      b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#4E1617;color:#F1D7A5;font:500 14px/1.4 system-ui,sans-serif;padding:10px 16px;text-align:center';
      b.textContent = 'AURELIA STAY could not connect to its services. Check your internet connection. ';
      const a = document.createElement('a'); a.href = '#'; a.textContent = 'Retry'; a.style.cssText = 'color:#fff;font-weight:700;text-decoration:underline';
      a.onclick = e => { e.preventDefault(); location.reload(); };
      b.appendChild(a); document.body.appendChild(b);
    };
    console.error('[aurelia] store failed to start', err);
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }

  window.AureliaStoreReady = import(entry).then(m => m.createStore()).then(store => {
    window.AureliaStore = store;
    window.dispatchEvent(new Event('aurelia-store-ready'));
    return store;
  });
  window.AureliaStoreReady.catch(err => { window.AureliaStoreError = err; banner(err); });
})();
