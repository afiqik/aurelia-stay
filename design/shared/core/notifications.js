/* AURELIA STAY — notification feed on the Realtime Database: /notifications/{target}/{pushId} { type, title, message, at (ISO), read, from }
 * target = a user uid | 'managers' | 'admins'.  The mirror `db.notifications` is the flattened list ({ id, to, type, title, message, at, read, from }, newest first).
 *
 * Exports:
 *   notify(to, type, title, message)  -> Promise<{ ok, id? | code, error }>   best-effort push (never throws, 4 s cap); `to` = uid | 'managers' | 'admins'
 *   notificationsFor(u)               -> list for user u (own uid + 'managers' for managers + 'admins' for admins), newest first; [] when u is falsy
 *   markRead(id)                      -> Promise<result>   flips read=true on one notification (unknown id is a no-op ok)
 *   markAllRead(u)                    -> Promise<result>   flips every unread notification visible to u; result.count = how many
 *   targetsFor(profile)               -> ['<uid>', 'managers'?, 'admins'?]
 *   watchNotifications(targets, ok, err) -> unsubscribe()   used by listeners.js; calls ok() after EVERY target reported once, then on every change
 */
import { rtdb, auth, R } from './sdk.js';
import { db, setNotifications } from './state.js';
import { nowIso, withTimeout } from './util.js';
import { okResult, errResult, fromFirebase } from './errors.js';

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

export const targetsFor = p => {
  if (!p) return [];
  const t = [p.id]; if (p.role === 'hotel_manager') t.push('managers'); if (p.role === 'admin') t.push('admins');
  return t;
};

export function notificationsFor(u) {
  if (!u) return [];
  const keys = targetsFor(u);
  return db.notifications.filter(n => keys.indexOf(n.to) >= 0);
}

export async function notify(to, type, title, message) {
  try {
    if (!to || /[.#$\[\]\/]/.test(String(to))) return errResult('VALIDATION_001', 'Invalid notification target.', 422);
    const me = auth && auth.currentUser; const r = R.push(R.ref(rtdb, 'notifications/' + to));
    const n = { type: clip(type, 40), title: clip(title, 120), message: clip(message, 400), at: nowIso(), read: false, from: me ? me.uid : '' };
    await withTimeout(R.set(r, n), 4000);
    return okResult({ id: r.key });
  } catch (e) { console.warn('[aurelia] notify failed', e && e.code); return fromFirebase(e); }
}

const find = id => db.notifications.find(n => n.id === id);

export async function markRead(id) {
  const n = find(id); if (!n) return okResult();
  try { await withTimeout(R.set(R.ref(rtdb, 'notifications/' + n.to + '/' + n.id + '/read'), true), 4000); return okResult(); }
  catch (e) { return fromFirebase(e); }
}

export async function markAllRead(u) {
  const unread = notificationsFor(u).filter(n => !n.read); if (!unread.length) return okResult({ count: 0 });
  const patch = {}; unread.forEach(n => { patch['notifications/' + n.to + '/' + n.id + '/read'] = true; });
  try { await withTimeout(R.update(R.ref(rtdb), patch), 4000); return okResult({ count: unread.length }); }
  catch (e) { return fromFirebase(e); }
}

const flatten = (to, snap) => {
  const out = [];
  snap.forEach(c => { const v = c.val() || {}; out.push({ id: c.key, type: v.type || '', title: v.title || '', message: v.message || '', at: v.at || '', read: !!v.read, from: v.from || '', to }); });
  return out;
};

export function watchNotifications(targets, ok, err) {
  const lists = {}; let seen = 0; const stops = [];
  const publish = () => setNotifications([].concat(...targets.map(t => lists[t] || [])));
  const report = t => { if (!(t in lists)) { lists[t] = []; seen++; } };
  targets.forEach(t => {
    stops.push(R.onValue(R.ref(rtdb, 'notifications/' + t), snap => {
      if (!(t in lists)) seen++;
      lists[t] = flatten(t, snap); publish();
      if (seen >= targets.length) ok();
    }, e => { report(t); if (err) err(e); if (seen >= targets.length) ok(); }));
  });
  return () => stops.forEach(s => { try { s(); } catch (e) { } });
}
