/* AURELIA STAY — Hotel Manager portal: bootstrap. The page logic is modular (manager/app/*.js, see app/index.js); every manager page's Component
 * delegates to window.AureliaManager, which is defined only AFTER all modules loaded (pages poll for it, then wait for AureliaStore/AureliaUI in mount()). */
(function () {
  if (window.AureliaManagerReady) return;
  const here = document.currentScript && document.currentScript.src;
  const entry = here ? new URL('app/index.js', here).href : './app/index.js';
  window.AureliaManagerReady = import(entry).then(m => { window.AureliaManager = m.initManager(); return window.AureliaManager; });
  window.AureliaManagerReady.catch(err => { window.AureliaManagerError = err; console.error('[aurelia] manager portal failed to load', err); });
})();
