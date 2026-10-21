/* AURELIA STAY — store entry point, imported by the shared/aurelia-store.js bootstrap.
 *
 * createStore() -> Promise<AureliaStore>   memoised; a failed start is not cached, so the bootstrap's Retry (or a second call) tries again.
 *   1. loadSdk()   import the Firebase modular SDK (sdk.js; emulators + EMULATOR badge when ?emulator=1)
 *   2. initAuth()  resolve Firebase Auth state, load the profile, start presence and the role-scoped listeners and wait for the first snapshots
 *   3. assemble the public object: api-read.js (sync reads/helpers) + api-write.js (async mutations) + emulator-only __test
 * Only after this resolves does the bootstrap assign window.AureliaStore, which is why pages may read S.db synchronously.
 *
 * __test.signIn(email, name, portal?)  EMULATOR ONLY (the property does not exist in live mode): fake Google credential against the Auth emulator,
 *   then the normal profile bootstrap, so tests need no popup. Resolves like signInWithGoogle.
 *
 * Import graph (no cycles):  index -> sdk, auth, api-read, api-write
 *   api-write -> auth, notifications, services/{booking,housekeeping,maintenance,users,admin,contact,sample}
 *   services/* -> services/{ctx,tx,room-writes,booking-*,...}, availability, derive, counters, audit, notifications, staff-emails, state, errors, util, sdk
 */
import { loadSdk, mode } from './sdk.js';
import { initAuth, testSignIn } from './auth.js';
import { readApi } from './api-read.js';
import { writeApi } from './api-write.js';

let started = null;

async function start() {
  await loadSdk();
  await initAuth();
  const S = Object.assign(readApi(), writeApi());
  if (mode() === 'emulator') S.__test = { signIn: (email, name, portal) => testSignIn(email, name, portal) };
  return S;
}

export function createStore() {
  return started || (started = start().catch(e => { started = null; throw e; }));
}
