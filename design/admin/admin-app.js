/* AURELIA STAY — Admin portal bootstrap. The logic is modular (admin/app/*.js, one module per page area); this classic script imports them and
 * only THEN defines window.AureliaAdmin (state, mount, unmount, vals, F). Pages poll for window.AureliaAdmin before using it. */
(function () {
  if (window.AureliaAdminReady) return;
  const here = document.currentScript && document.currentScript.src;
  const entry = here ? new URL('app/index.js', here).href : './app/index.js';
  window.AureliaAdminReady = import(entry).then(m => { window.AureliaAdmin = m.createAdmin(); return window.AureliaAdmin; });
  window.AureliaAdminReady.catch(err => { window.AureliaAdminError = err; console.error('[aurelia] admin modules failed to load', err); });
})();
