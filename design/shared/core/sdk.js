/* AURELIA STAY — Firebase SDK loader. The ONLY module that knows the CDN. Pages stay build-less: the modular SDK is import()ed at runtime.
 *
 * Exports (ES live bindings: they are null until `loadSdk()` has resolved — createStore() awaits it before anything else runs):
 *   loadSdk()      -> Promise<void>   idempotent; on failure the memo is cleared so a later call retries (the bootstrap's Retry link reloads the page)
 *   app, auth, fs, rtdb                initialised app / Auth / Firestore / Realtime Database instances
 *   A, F, R                            module namespaces: firebase-auth / firebase-firestore / firebase-database
 *   mode()         -> 'live' | 'emulator'
 *
 * Emulator mode (config.js emulatorEnabled(), i.e. ?emulator=1): project id demo-aurelia, all three services pointed at localhost,
 * and a fixed "EMULATOR" badge is shown. Production is never touched in that mode.
 */
import { SDK_BASE, FIREBASE_CONFIG, EMULATOR, emulatorEnabled } from './config.js';

export let app = null, auth = null, fs = null, rtdb = null, A = null, F = null, R = null;
let emulator = false, loading = null;
export const mode = () => emulator ? 'emulator' : 'live';

function showBadge() {
  const add = () => {
    if (document.getElementById('aurelia-emulator-badge')) return;
    const b = document.createElement('div'); b.id = 'aurelia-emulator-badge'; b.textContent = 'EMULATOR'; b.title = 'Firebase emulators (project ' + EMULATOR.projectId + ') — no production data';
    b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;background:#B3261E;color:#fff;font:700 11px/1 system-ui,sans-serif;letter-spacing:.12em;padding:6px 9px;border-radius:4px;opacity:.92;pointer-events:none';
    document.body.appendChild(b);
  };
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
}

async function init() {
  const files = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-database.js'];
  const [appM, authM, fsM, dbM] = await Promise.all(files.map(f => import(SDK_BASE + f)));
  emulator = emulatorEnabled();
  const cfg = emulator
    ? Object.assign({}, FIREBASE_CONFIG, { projectId: EMULATOR.projectId, authDomain: EMULATOR.projectId + '.firebaseapp.com', databaseURL: 'https://' + EMULATOR.projectId + '-default-rtdb.firebaseio.com' })
    : FIREBASE_CONFIG;
  const a = appM.getApps().length ? appM.getApp() : appM.initializeApp(cfg);
  const au = authM.getAuth(a);
  const store = fsM.initializeFirestore(a, { ignoreUndefinedProperties: true });
  const rt = dbM.getDatabase(a);
  if (emulator) {
    authM.connectAuthEmulator(au, 'http://' + EMULATOR.host + ':' + EMULATOR.authPort, { disableWarnings: true });
    fsM.connectFirestoreEmulator(store, EMULATOR.host, EMULATOR.firestorePort);
    dbM.connectDatabaseEmulator(rt, EMULATOR.host, EMULATOR.databasePort);
    showBadge();
  }
  A = authM; F = fsM; R = dbM; app = a; auth = au; fs = store; rtdb = rt;
}

export const loadSdk = () => loading || (loading = init().catch(e => { loading = null; throw e; }));
