/* AURELIA STAY — Hotel Manager portal: Reservations list, Reservation Details (cancel / reassign room) and the Check-ins / Check-outs lists. */
import { RC } from './constants.js';

export function reservationsVals(v, x) {
  const { S, c, st, db, T, bVM, rnOf } = x;
  const FL = { All: () => true, Today: b => b.checkIn === T || b.checkOut === T, Upcoming: b => b.status === 'CONFIRMED', 'Checked-in': b => b.status === 'CHECKED_IN', Completed: b => b.status === 'COMPLETED', Cancelled: b => b.status === 'CANCELLED' };
  const qq = st.resQ.trim().toLowerCase(); const cur = FL[st.resF] ? st.resF : 'All';
  const rows = db.bookings.filter(FL[cur]).filter(b => !qq || b.ref.toLowerCase().includes(qq) || String(b.guestName || '').toLowerCase().includes(qq) || rnOf(b.roomId).includes(qq)).sort((a, b) => a.checkIn < b.checkIn ? 1 : -1);
  v.resQ = st.resQ; v.onResQ = e => c.setState({ resQ: e.target.value });
  v.resFilters = Object.keys(FL).map(k => ({ label: k, active: cur === k, bg: cur === k ? '#174C38' : 'transparent', fg: cur === k ? '#F1D7A5' : '#174C38', onClick: () => c.setState({ resF: k }) }));
  v.rows = rows.map(bVM); v.empty = !rows.length;
}

export function reservationVals(v, x) {
  const { S, U, c, st, db, T, q, me, once, fin, bVM } = x;
  const b = S.booking(q.ref || '');
  if (!b) { v.missing = 'Reservation not found.'; v.rv = { chip: {} }; return; }
  const rv = bVM(b); const r = S.room(b.roomId) || {};
  rv.canReassign = b.status === 'CONFIRMED'; rv.canCancel = b.status === 'CONFIRMED';
  rv.onReassign = () => c.setState(s => ({ reassign: !s.reassign }));
  rv.onCancel = () => c.setState({ confirm: { kind: 'cancel', ref: b.ref }, confirmErr: '', confirmReason: '' });
  rv.note = b.status === 'CONFIRMED' && b.checkIn > T ? 'Check-in opens on ' + S.fmtDate(b.checkIn) + '.' : b.status === 'CANCELLED' ? 'Cancelled · ' + (b.cancellationReason || '—') : '';
  rv.img = U.img(U.TYPE_IMG[b.typeId], 1000);
  v.rv = rv; v.found = true; v.reassignOpen = st.reassign && rv.canReassign;
  v.reassignRooms = db.rooms.filter(o => o.typeId === b.typeId).map(o => {
    const current = o.id === r.id; const free = S.candidates(b.typeId, b.checkIn, b.checkOut, b.id).some(cc => cc.id === o.id); const ok = !current && free && o.status === 'AVAILABLE';
    return { number: o.number, note: current ? 'Current room' : ok ? 'Available ✓' : RC[o.status][0] + ' ✕', disabled: !ok, border: current ? '#174C38' : 'rgba(78,22,23,.2)', cursor: ok ? 'pointer' : 'not-allowed', opacity: ok || current ? 1 : .55, pick: once(async () => { if (!ok) return; if (fin(await S.reassignRoom(b.ref, o.id, me.id), b.ref + ' moved to Room ' + o.number + '.')) c.setState({ reassign: false }); }) };
  });
}

export function frontdeskVals(v, x, page) {
  const { db, T, bVM } = x;
  const isIn = page === 'check-ins';
  const list = isIn ? db.bookings.filter(b => (b.checkIn === T && b.status !== 'CANCELLED' && b.status !== 'COMPLETED') || (b.status === 'CONFIRMED' && b.checkIn < T)) : db.bookings.filter(b => b.status === 'CHECKED_IN' && b.checkOut <= T).concat(db.bookings.filter(b => b.status === 'COMPLETED' && b.checkOut === T));
  v.title = isIn ? "Today's Check-ins" : "Today's Check-outs";
  v.list = list.map(bVM).map((b, i) => ({ ...b, delay: (i % 3) * 80, canCheckIn: isIn && b.canCheckIn, canCheckOut: !isIn && b.canCheckOut }));
  v.empty = list.length ? '' : isIn ? 'No check-ins scheduled for today.' : 'No check-outs due today.';
}
