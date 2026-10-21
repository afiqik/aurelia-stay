/* AURELIA STAY — Hotel Manager portal: the per-render context `x` every page module receives.
 * x = { S, U, c, st, db, T, q, me, say, fin, once, setIn, go, TN, rnOf, dayOf, canIn, canOut, openConfirm, bVM, count, insToday, outsToday, pendingIn, pendingOut, hkOpen, mtOpen, notes, ops }
 *   say(msg, bad)        show the flash banner
 *   fin(res, okMsg)      handle a mutation result: flash + idle-touch on success, flash the error otherwise; returns res.ok
 *   once(fn)             async handler wrapper: ignores clicks while another mutation is in flight; unexpected errors become a flash
 */
import { F, RC, SHORT } from './constants.js';
import { opsOf } from './activity.js';

export function makeCtx(c) {
  const S = window.AureliaStore, U = window.AureliaUI; const st = c.state;
  const db = S.db, T = S.today(), q = U.q();
  const me = S.user(st.me.id) || S.me() || st.me;      // own profile; never null for a signed-in manager
  const say = (msg, bad) => c.setState({ flash: { msg, bg: bad ? '#EBD9D8' : '#DCE8E1', fg: bad ? '#4E1617' : '#174C38' } });
  const fin = (res, ok) => { const good = !!(res && res.ok); if (good) { say(ok); S.touch('hotel_manager'); } else say((res && res.error) || 'Something went wrong.', true); return good; };
  const once = fn => async (...a) => {
    if (a[0] && typeof a[0].preventDefault === 'function') a[0].preventDefault();   // never let a busy form submit natively
    if (c._busy) return false; c._busy = true;
    try { return await fn(...a); } catch (e) { console.error(e); say('Something went wrong. Please try again.', true); return false; } finally { c._busy = false; }
  };
  const setIn = (k, f) => e => { const v = e.target.value; c.setState(s => ({ [k]: { ...s[k], [f]: v } })); };
  const go = (key, qs) => { location.href = F[key] + (qs ? '?' + qs : ''); };
  const TN = id => (S.type(id) || {}).name || '—';
  const rnOf = id => (S.room(id) || {}).number || '—';
  const dayOf = iso => iso ? S.isoOf(new Date(iso)) : '';
  const canIn = b => b.status === 'CONFIRMED' && b.checkIn <= T;
  const canOut = b => b.status === 'CHECKED_IN';
  const openConfirm = (kind, b) => c.setState({ confirm: { kind, ref: b.ref }, confirmErr: '', confirmReason: '' });
  const bVM = b => { const r = S.room(b.roomId) || { status: 'AVAILABLE' }; return { ...U.bookingVM(b), roomStatus: RC[r.status][0], typeShort: SHORT[b.typeId], priceLine: S.rm(b.roomPrice) + ' × ' + b.nights + ' + ' + S.rm(b.serviceFee) + ' fee', href: F.reservation + '?ref=' + b.ref, canCheckIn: canIn(b), canCheckOut: canOut(b), onCheckIn: () => openConfirm('checkin', b), onCheckOut: () => openConfirm('checkout', b), img: U.img(U.TYPE_IMG[b.typeId], 300) }; };
  const count = s => db.rooms.filter(r => r.status === s).length;

  const insToday = db.bookings.filter(b => b.checkIn === T && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'));
  const outsToday = db.bookings.filter(b => (b.checkOut === T && (b.status === 'CHECKED_IN' || b.status === 'COMPLETED')) || (b.status === 'CHECKED_IN' && b.checkOut < T));
  const pendingIn = db.bookings.filter(b => b.status === 'CONFIRMED' && b.checkIn <= T);
  const pendingOut = db.bookings.filter(b => b.status === 'CHECKED_IN' && b.checkOut <= T);
  const hkOpen = db.housekeeping.filter(t => t.status !== 'COMPLETED');
  const mtOpen = db.maintenance.filter(m => m.status !== 'RESOLVED');
  const notes = S.notificationsFor(me);
  return { S, U, c, st, db, T, q, me, say, fin, once, setIn, go, TN, rnOf, dayOf, canIn, canOut, openConfirm, bVM, count, insToday, outsToday, pendingIn, pendingOut, hkOpen, mtOpen, notes, ops: opsOf(S) };
}
