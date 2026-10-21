/* AURELIA STAY — Hotel Manager portal: page lifecycle. Every manager page's Component calls state() -> mount(c) -> vals(c, page) -> unmount(c).
 * mount() waits for window.AureliaStore + AureliaUI (window.AureliaManager itself only exists once all modules are loaded). */
import { makeCtx } from './ctx.js';
import { confirmVals } from './confirm.js';
import { dashboardVals } from './dashboard.js';
import { reservationsVals, reservationVals, frontdeskVals } from './reservations.js';
import { roomsVals, roomVals } from './rooms.js';
import { housekeepingVals } from './housekeeping.js';
import { maintenanceVals } from './maintenance.js';
import { guestsVals } from './guests.js';
import { calendarVals } from './calendar.js';
import { walkinVals } from './walkin.js';
import { reportsVals } from './reports.js';
import { activityVals } from './activity.js';
import { notificationsVals, profileVals } from './notifications.js';

export const state = () => ({ me: null, flash: null, confirm: null, confirmErr: '', confirmReason: '', reassign: false, resQ: '', resF: 'All', roomQ: '', roomF: 'All', guestQ: '', mt: { room: '', issueType: '', description: '', priority: 'MEDIUM' }, mtErr: '', wk: { name: '', phone: '', email: '', type: '2', ci: '', co: '', g: '2', payment: 'Pay at Hotel' }, wkErr: '', calOff: 0, calSel: null });

export function mount(c) {
  const w = () => {
    if (!(window.AureliaStore && window.AureliaUI)) return (c._t = setTimeout(w, 30));
    const S = window.AureliaStore, U = window.AureliaUI; const me = U.requireStaff('hotel_manager'); if (!me) return; S.touch('hotel_manager');
    c._un = S.subscribe(() => c.forceUpdate());
    c._ws = U.watchSession('hotel_manager');             // sign-out in another tab / disabled account / idle timeout -> back to Login
    const q = U.q(); const f = U.takeFlash();
    c.setState({ me, flash: f ? { msg: f, bg: '#DCE8E1', fg: '#174C38' } : null, wk: { ...c.state.wk, ci: S.today(), co: S.addDays(S.today(), 1) }, mt: { ...c.state.mt, room: q.room || '' }, resF: q.filter || 'All' });
  }; w();
  c._k = e => { if (e.key === 'Escape') c.setState({ confirm: null }); }; window.addEventListener('keydown', c._k);
  c._lv = () => { if (c._ws) { c._ws(); c._ws = null; } }; window.addEventListener('aurelia-leaving', c._lv);
}

export function unmount(c) {
  clearTimeout(c._t); c._un && c._un(); c._ws && c._ws();
  window.removeEventListener('keydown', c._k); window.removeEventListener('aurelia-leaving', c._lv);
}

const PAGES = {
  dashboard: dashboardVals, reservations: reservationsVals, reservation: reservationVals, 'check-ins': (v, x) => frontdeskVals(v, x, 'check-ins'), 'check-outs': (v, x) => frontdeskVals(v, x, 'check-outs'),
  rooms: roomsVals, room: roomVals, housekeeping: housekeepingVals, maintenance: maintenanceVals, guests: (v, x) => guestsVals(v, x, 'guests'), guest: (v, x) => guestsVals(v, x, 'guest'),
  calendar: calendarVals, 'walk-in': walkinVals, reports: reportsVals, activity: activityVals, notifications: notificationsVals, profile: profileVals
};

export function vals(c, page) {
  const S = window.AureliaStore; const st = c.state;
  const stop = e => e.stopPropagation();
  if (!st.me || !S) return { ready: false, loading: true, stop, flash: {}, me: {}, list: [], rows: [], staffOnline: {} };
  const x = makeCtx(c); const me = x.me;
  const nm = me.name || me.email || 'Manager';
  const v = {
    ready: true, loading: false, stop, me: { name: nm, email: me.email || '', phone: me.phone || '—', lastLogin: me.lastLoginAt ? S.fmtStamp(me.lastLoginAt) : '—', photo: me.photoURL || '', hasPhoto: !!me.photoURL, noPhoto: !me.photoURL, initial: nm.charAt(0).toUpperCase() },
    todayLabel: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    unread: x.notes.filter(n => !n.read).length, flash: st.flash || {}, clearFlash: () => c.setState({ flash: null })
  };
  confirmVals(v, x);
  if (PAGES[page]) PAGES[page](v, x);
  return v;
}
