/* AURELIA STAY — synchronous session view: sessionUser / touch / me, idle timeout for staff.
 * Idle clock = per-uid timestamp in localStorage `aurelia-active-<uid>` (shared by all tabs). Customers never expire.
 *
 * Exports:
 *   sessionUser(role) -> profile | { expired: true } | null
 *       profile only if a Firebase user is signed in, profile.role === role and status active.
 *       staff roles: { expired: true } once idle time since the last touch exceeds settings.adminTimeout|managerTimeout minutes
 *       (and the expire handler — set by auth.js — signs out in the background; afterwards the result is null).
 *   touch(role)                 refresh the idle clock (no-op unless signed in with that role and not expired)
 *   me() -> profile | null      current active profile of whatever role
 *   markActive(uid) clearActive(uid)
 *   setExpireHandler(fn)        fn(role) called once per expiry
 */
import { db, session } from './state.js';

const KEY = uid => 'aurelia-active-' + uid;
const store = (fn, dflt) => { try { return fn(localStorage); } catch (e) { return dflt; } };
const lastActive = uid => store(l => Number(l.getItem(KEY(uid))) || 0, 0);
export const markActive = uid => store(l => l.setItem(KEY(uid), String(Date.now())));
export const clearActive = uid => store(l => l.removeItem(KEY(uid)));

let onExpire = null, expiring = false;
export const setExpireHandler = fn => { onExpire = fn; };

const active = () => { const u = session.fbUser, p = session.profile; return u && p && p.id === u.uid && p.status === 'active' ? p : null; };

export function sessionUser(role) {
  const p = active();
  if (!p || p.role !== role) return null;
  if (role === 'customer') return p;
  let last = lastActive(p.id); if (!last) { markActive(p.id); last = Date.now(); }
  const mins = Number(role === 'admin' ? db.settings.adminTimeout : db.settings.managerTimeout) || 30;
  if (Date.now() - last <= mins * 60000) return p;
  if (!expiring && onExpire) { expiring = true; Promise.resolve(onExpire(role)).catch(() => { }).then(() => { expiring = false; }); }
  return { expired: true };
}

export function touch(role) { const u = sessionUser(role); if (u && !u.expired) markActive(u.id); }
export const me = () => active();
