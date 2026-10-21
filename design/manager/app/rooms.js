/* AURELIA STAY — Hotel Manager portal: Rooms grid (filters by derived status, incl. RESERVED) and Room Details (status actions). */
import { F, RC, ROOM_STATES, rchip } from './constants.js';

export function roomsVals(v, x) {
  const { U, c, st, db, TN, count } = x;
  const FL = ['All'].concat(ROOM_STATES);
  v.roomQ = st.roomQ; v.onRoomQ = e => c.setState({ roomQ: e.target.value });
  v.roomFilters = FL.map(k => ({ label: k === 'All' ? 'All (' + db.rooms.length + ')' : RC[k][0] + ' (' + count(k) + ')', active: st.roomF === k, bg: st.roomF === k ? '#174C38' : 'transparent', fg: st.roomF === k ? '#F1D7A5' : '#174C38', onClick: () => c.setState({ roomF: k }) }));
  const tiles = db.rooms.filter(r => (st.roomF === 'All' || r.status === st.roomF) && (!st.roomQ.trim() || r.number.includes(st.roomQ.trim())));
  v.tiles = tiles.map((r, i) => ({ number: r.number, floor: r.floor, typeName: TN(r.typeId), chip: rchip(r.status), href: F.room + '?no=' + r.number, img: U.img(U.TYPE_IMG[r.typeId], 400), delay: (i % 5) * 50 }));
  v.empty = !tiles.length;
}

export function roomVals(v, x) {
  const { S, U, db, T, q, me, once, fin, go, canIn, openConfirm } = x;
  const r = S.roomByNo(q.no || '');
  if (!r) { v.missing = 'Room not found.'; v.ro = { chip: {}, actions: [] }; return; }
  const t = S.type(r.typeId) || { name: '—', price: 0, capacity: 0 };
  const cur = db.bookings.find(b => b.roomId === r.id && b.status === 'CHECKED_IN') || db.bookings.filter(b => b.roomId === r.id && b.status === 'CONFIRMED').sort((a, b) => a.checkIn < b.checkIn ? -1 : 1)[0] || (r.status === 'CLEANING' ? db.bookings.filter(b => b.roomId === r.id && b.status === 'COMPLETED').sort((a, b) => a.checkOut < b.checkOut ? 1 : -1)[0] : null);
  const openHk = db.housekeeping.find(h => h.roomId === r.id && h.status !== 'COMPLETED');
  const openMt = db.maintenance.find(m => m.roomId === r.id && m.status !== 'RESOLVED');
  const A = (label, onClick, primary) => ({ label, onClick, bg: primary ? '#174C38' : 'transparent', fg: primary ? '#F1D7A5' : '#174C38' });
  const actions = []; let next = 'None';
  if (r.status === 'CLEANING') { next = 'Complete housekeeping'; actions.push(A('Mark as Clean', once(async () => { fin(await S.markClean(r.id, me.id), 'Room ' + r.number + ' is clean and available.'); }), true)); }
  if (r.status === 'MAINTENANCE') { next = openMt ? 'Resolve ' + openMt.id : 'Mark as available'; actions.push(A('View Maintenance', () => go('maintenance'))); if (openMt) actions.push(A(openMt.status === 'OPEN' ? 'Start Work' : 'Resolve & Mark Available', once(async () => { fin(await S.advanceMaintenance(openMt.id, me.id), openMt.id + ' updated.'); }), true)); }
  if (r.status === 'RESERVED' && cur) { next = cur.checkIn <= T ? 'Check-in ' + cur.ref : 'Await arrival on ' + S.fmtShort(cur.checkIn); if (canIn(cur)) actions.push(A('Check-in', () => openConfirm('checkin', cur), true)); }
  if (r.status === 'OCCUPIED' && cur) { next = 'Check-out on ' + S.fmtShort(cur.checkOut); actions.push(A('Check-out', () => openConfirm('checkout', cur), true)); }
  if (r.status === 'AVAILABLE') { next = 'Ready for guests'; actions.push(A('Report Maintenance', () => go('maintenance', 'room=' + r.number))); actions.push(A('Set Out of Service', once(async () => { fin(await S.setRoomStatus(r.id, 'OUT_OF_SERVICE', me.id), 'Room ' + r.number + ' is out of service.'); }))); }
  if (r.status === 'OUT_OF_SERVICE') { next = 'Return to service'; actions.push(A('Mark as Available', once(async () => { fin(await S.setRoomStatus(r.id, 'AVAILABLE', me.id), 'Room ' + r.number + ' is available.'); }), true)); }
  v.found = true;
  v.ro = { number: r.number, img: U.img(U.TYPE_IMG[r.typeId], 1200), typeName: t.name, priceL: S.rm(t.price), capacity: U.plural(t.capacity, 'guest'), chip: rchip(r.status), bookingRef: cur ? cur.ref : '—', bookingHref: cur ? F.reservation + '?ref=' + cur.ref : F.reservations, bookingNote: cur ? cur.guestName + ' · ' + S.fmtShort(cur.checkIn) + ' → ' + S.fmtShort(cur.checkOut) : (openHk ? 'Housekeeping ' + openHk.id : 'No active booking'), nextAction: next, upcoming: db.bookings.filter(b => b.roomId === r.id && b.status === 'CONFIRMED').length + ' confirmed', actions };
}
