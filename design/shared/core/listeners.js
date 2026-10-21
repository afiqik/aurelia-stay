/* AURELIA STAY — role-scoped listener manager (what is listened to: listener-specs.js).
 * Firestore onSnapshot (default metadata mode: local latency-compensated writes ARE delivered immediately; pure metadata changes are not) + RTDB onValue.
 * Errors are logged and never crash the store; the hydration promise resolves after the FIRST snapshot (or error) of EVERY listener of the role,
 * or after HYDRATION_TIMEOUT_MS so a dead network cannot hang page start-up forever.
 *
 * Exports:
 *   startListeners(profile|null) -> Promise<void>   tears down the previous set, clears private mirror data, subscribes for the role, resolves when hydrated
 *   stopListeners()                                 unsubscribe everything and clear private mirror data (public mirrors stay)
 *   HYDRATION_TIMEOUT_MS
 * A day-rollover timer re-derives room status (RESERVED) at midnight while listeners are running.
 */
import * as st from './state.js';
import { specsFor } from './listener-specs.js';
import { today } from './util.js';

export const HYDRATION_TIMEOUT_MS = 12000;
let gen = 0, stops = [], dayTimer = null, lastDay = '';

function watchDay() {
  clearInterval(dayTimer); lastDay = today();
  dayTimer = setInterval(() => { const t = today(); if (t !== lastDay) { lastDay = t; st.refreshDerived(); st.emit(); } }, 60000);
}

export function stopListeners() {
  gen++;
  stops.forEach(s => { try { s(); } catch (e) { } });
  stops = []; clearInterval(dayTimer); dayTimer = null;
  st.resetPrivate();
}

export function startListeners(profile) {
  stopListeners();
  const my = gen;
  const waits = specsFor(profile).map(spec => new Promise(resolve => {
    let first = true;
    const done = () => { if (first) { first = false; resolve(); } };
    const ok = () => { if (my !== gen) return; done(); st.emit(); };
    const err = e => { if (my === gen) console.warn('[aurelia] listener "' + spec.key + '" failed:', (e && e.code) || e); done(); };
    try { const stop = spec.watch(ok, err); if (my === gen) stops.push(stop); else stop(); } catch (e) { err(e); }
  }));
  watchDay();
  let timer;
  const timeout = new Promise(r => { timer = setTimeout(() => { if (my === gen) console.warn('[aurelia] listeners not hydrated after ' + HYDRATION_TIMEOUT_MS + ' ms; continuing'); r(); }, HYDRATION_TIMEOUT_MS); });
  return Promise.race([Promise.all(waits), timeout]).then(() => { clearTimeout(timer); st.emit(); });
}
