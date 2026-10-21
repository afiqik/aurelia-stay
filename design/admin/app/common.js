/* AURELIA STAY — Admin portal: shared constants + per-render context.
 * Exports:
 *   F                  page file names (URL-encoded) used for links
 *   ROLE, roleLabel    role -> label
 *   fmtV(o)            audit before/after object -> one line
 *   busy(x, id, fn)    run async fn once at a time (ignores clicks while another action is in flight; sets state.busyId)
 *   makeCtx(c)         per-render context { S, U, c, st, me, db, T, q, notes, say, run, actor, actorOf, revenueOf, stampOf } or null while loading
 *   baseVals(x)        view-model keys every page template shares (me, todayLabel, unread, flash, clearFlash, stop)
 */
export const F = { dashboard: 'Dashboard.dc.html', health: 'System%20Health.dc.html', users: 'Users.dc.html', user: 'User%20Details.dc.html', 'create-manager': 'Create%20Manager.dc.html', bookings: 'Bookings.dc.html', booking: 'Booking%20Details.dc.html', pricing: 'Rooms%20-%20Pricing.dc.html', reports: 'Reports.dc.html', audit: 'Audit%20Logs.dc.html', settings: 'Settings.dc.html', notifications: 'Notifications.dc.html', profile: 'Profile.dc.html' };
export const ROLE = { customer: 'Customer', hotel_manager: 'Hotel Manager', admin: 'Admin' };
export const roleLabel = r => ROLE[r] || 'User';
export const fmtV = o => o ? Object.keys(o).map(k => k + ': ' + (o[k] && typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k])).join(' · ') : '—';

export async function busy(x, id, fn) {
  if (x.c._busy) return;                       // synchronous flag: setState may be batched, so state.busyId alone cannot stop a double click
  x.c._busy = id; x.c.setState({ busyId: id });
  try { await fn(); } finally { x.c._busy = ''; x.c.setState({ busyId: '' }); }
}

export function makeCtx(c) {
  const S = window.AureliaStore, U = window.AureliaUI, st = c.state;
  if (!st.me || !S || !U) return null;
  const me = S.me(); if (!me || me.role !== 'admin') return null;
  const say = (msg, bad) => c.setState({ flash: { msg, bg: bad ? '#EBD9D8' : '#DCE8E1', fg: bad ? '#4E1617' : '#174C38' } });
  // every mutation is async: callers `await run(await S.something(...), 'done message')`
  const run = async (res, ok) => { if (res.ok) { say(ok); S.touch('admin'); } else say(res.error, true); return res.ok; };
  // actor/customer lookups are null-safe: a profile can be missing (removed account, unreadable customer)
  const actor = (id, fallback) => { if (!id) return 'System'; const u = S.user(id); return u ? (u.name || u.email || 'User') + ' (' + roleLabel(u.role) + ')' : (fallback || 'Unknown user'); };
  const revenueOf = list => list.filter(b => b.status === 'COMPLETED' || b.status === 'CHECKED_IN').reduce((s, b) => s + (Number(b.total) || 0), 0);
  const stampOf = iso => { const d = new Date(iso); return iso && isFinite(d) ? S.fmtStamp(iso) : '—'; };
  return { S, U, c, st, me, db: S.db, T: S.today(), q: U.q(), notes: S.notificationsFor(me), say, run, actor, revenueOf, stampOf };
}

export function baseVals(x) {
  const { S, me, st, c, notes } = x;
  return {
    ready: true, loading: false,
    me: { name: me.name || me.email, email: me.email, phone: me.phone || '—', lastLogin: me.lastLoginAt ? S.fmtStamp(me.lastLoginAt) : '—', initial: String(me.name || me.email || '?').charAt(0).toUpperCase() },
    todayLabel: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    unread: notes.filter(n => !n.read).length, flash: st.flash || {}, clearFlash: () => c.setState({ flash: null }), stop: e => e.stopPropagation()
  };
}
