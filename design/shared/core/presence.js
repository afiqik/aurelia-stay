/* AURELIA STAY — Realtime Database presence: /presence/{uid} { state:'online'|'offline', lastChanged (server time), name, role, portal }.
 * Written by the signed-in user only (onDisconnect flips it to 'offline'); read by staff only (Admin dashboard/Users/System Health, Manager dashboard).
 * Limitation (by contract, one node per uid): with two tabs of the same user open, closing one marks the user offline until the other reconnects.
 *
 * Exports:
 *   goOnline(profile)            start publishing presence for this profile (idempotent; re-announces after every reconnect)
 *   goOffline()   -> Promise<void>   explicit sign-out: write 'offline', cancel onDisconnect, stop. Never rejects/hangs (2.5 s cap). Call BEFORE signOut.
 *   stopPresence()               stop publishing locally without writing (used when the session vanished elsewhere)
 *   watchPresence(ok, err) -> unsubscribe()   listener for staff roles -> db.presence (map uid -> entry)
 *   onlineUids()  -> Set<string> uids whose entry is 'online'
 *   isOnline(uid) -> boolean
 */
import { rtdb, R } from './sdk.js';
import { db, setPresence } from './state.js';
import { withTimeout } from './util.js';

let stopConn = null, myRef = null, info = null;

const entry = state => Object.assign({ state, lastChanged: R.serverTimestamp() }, info);

export function stopPresence() {
  if (stopConn) { try { stopConn(); } catch (e) { } stopConn = null; }
}

export function goOnline(profile) {
  stopPresence();
  if (!profile || !profile.id) return;
  myRef = R.ref(rtdb, 'presence/' + profile.id);
  info = { name: String(profile.name || '').slice(0, 80), role: profile.role, portal: profile.role };
  const ref = myRef;
  stopConn = R.onValue(R.ref(rtdb, '.info/connected'), snap => {
    if (snap.val() !== true) return;
    R.onDisconnect(ref).set(entry('offline'))
      .then(() => R.set(ref, entry('online')))
      .catch(e => console.warn('[aurelia] presence', e && e.code));
  });
}

export async function goOffline() {
  stopPresence();
  if (!myRef) return;
  const ref = myRef; myRef = null;
  try { await withTimeout(Promise.all([R.set(ref, entry('offline')), R.onDisconnect(ref).cancel()]), 2500); }
  catch (e) { console.warn('[aurelia] presence offline', e && e.code); }
}

export function watchPresence(ok, err) {
  return R.onValue(R.ref(rtdb, 'presence'), snap => {
    const m = {}; snap.forEach(c => { const v = c.val(); if (v && typeof v === 'object') m[c.key] = Object.assign({}, v, { uid: c.key }); });
    setPresence(m); ok();
  }, e => { if (err) err(e); });
}

export const onlineUids = () => new Set(Object.keys(db.presence).filter(k => db.presence[k] && db.presence[k].state === 'online'));
export const isOnline = uid => !!(db.presence[uid] && db.presence[uid].state === 'online');
