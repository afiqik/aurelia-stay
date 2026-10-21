/* AURELIA STAY — Hotel Manager portal: Dashboard (ops stats, room status bars, today's tasks, today's activity, staff online). */
import { F, RC, ROOM_STATES } from './constants.js';

// Staff currently online (RTDB presence is readable by staff only; customers' presence entries are filtered out)
const staffOnline = (S, db) => {
  const list = Array.from(S.onlineUids()).map(id => db.presence[id]).filter(p => p && (p.role === 'hotel_manager' || p.role === 'admin'));
  const names = list.map(p => String(p.name || 'Staff')).sort();
  return { show: true, count: list.length, names: names.slice(0, 4).join(', ') + (names.length > 4 ? ' +' + (names.length - 4) : '') };
};

export function dashboardVals(v, x) {
  const { S, U, db, T, me, once, fin, go, rnOf, dayOf, count, insToday, outsToday, pendingIn, pendingOut, hkOpen, mtOpen, openConfirm, ops } = x;
  v.greeting = U.greeting(me.name || 'there');
  v.opsStats = [
    { label: 'Check-ins', value: insToday.length, sub: pendingIn.length + ' waiting', href: F['check-ins'] },
    { label: 'Check-outs', value: outsToday.length, sub: pendingOut.length + ' waiting', href: F['check-outs'] },
    { label: 'New Reservations', value: db.bookings.filter(b => dayOf(b.createdAt) === T).length, sub: 'created today', href: F.reservations },
    { label: 'Pending Actions', value: hkOpen.length + mtOpen.length, sub: hkOpen.length + ' housekeeping · ' + mtOpen.length + ' maintenance', href: F.housekeeping }
  ].map((s, i) => ({ ...s, delay: i * 70 }));
  v.roomBars = ROOM_STATES.map(s => ({ s, label: RC[s][0], count: count(s), pct: (count(s) / db.rooms.length * 100) + '%', bg: RC[s][1], href: F.rooms })).filter(r => r.count || r.s !== 'OUT_OF_SERVICE');
  v.staffOnline = staffOnline(S, db);
  const tasks = [];
  pendingIn.forEach(b => tasks.push({ label: 'Check-in ' + b.ref + ' · Room ' + rnOf(b.roomId), cta: 'Check-in', action: () => openConfirm('checkin', b) }));
  pendingOut.forEach(b => tasks.push({ label: 'Check-out ' + b.ref + ' · Room ' + rnOf(b.roomId), cta: 'Check-out', action: () => openConfirm('checkout', b) }));
  hkOpen.forEach(t => tasks.push({ label: 'Room ' + rnOf(t.roomId) + ' housekeeping (' + t.status.toLowerCase() + ')', cta: t.status === 'DIRTY' ? 'Start' : 'Mark clean', action: once(async () => { fin(await S.advanceHousekeeping(t.id, me.id), 'Room ' + rnOf(t.roomId) + (t.status === 'DIRTY' ? ' — cleaning started.' : ' marked clean.')); }) }));
  mtOpen.forEach(m => tasks.push({ label: 'Room ' + rnOf(m.roomId) + ' maintenance · ' + m.issueType, cta: 'Open', action: () => go('maintenance') }));
  v.tasks = tasks; v.tasksEmpty = !tasks.length;
  v.activityToday = ops.filter(o => dayOf(o.a.at) === T).slice(0, 6).map(o => ({ time: S.fmtTime(o.a.at), text: o.text }));
  v.activityEmpty = !v.activityToday.length;
}
