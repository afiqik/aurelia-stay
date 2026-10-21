/* AURELIA STAY — turns the demo-data plan into concrete, CONSISTENT documents (pure: no Firebase, unit-testable).
 * Consistency rules (contract §12): a booking that holds a room (CONFIRMED / CHECKED_IN) is only created when every night is free in roomNights and
 * the room is usable; a CHECKED_IN booking only when the room is stored AVAILABLE (-> OCCUPIED); open housekeeping/maintenance only when the room is
 * stored AVAILABLE (-> CLEANING / MAINTENANCE). Entries that would clash with real data are skipped (reported in `skipped`), never forced.
 *
 * Exports:
 *   involvedRooms(plan) -> string[]            room numbers whose stored status the loader must read
 *   neededNights(plan, todayIso) -> [{ roomNo, date }]   every night of every room-holding entry (the loader reads these lock docs)
 *   resolveSample(o) -> { bookings, locks, housekeeping, maintenance, rooms, counts, skipped }
 *      o = { plan, today, now, adminId, types (merged room types), settings (merged), counters {booking,hk,req} (next numbers),
 *            stored { '101': 'AVAILABLE', ... }, taken (Set of roomNights ids), busyRooms (Set of room numbers that have any future lock) }
 *      bookings/housekeeping/maintenance = [{ id, data }]  locks = [{ id, data }]  rooms = [{ number, status }]  counts = { booking, hk, req } (how many numbers were used)
 */
import { ROOMS } from '../catalog.js';
import { addDays, nowIso } from '../util.js';
import { nightDates, nightId } from '../availability.js';
import { buildBooking } from './booking-doc.js';
import { lockData } from './booking-locks.js';
import { stampAt } from './sample-plan.js';
import { idOf } from '../counters.js';

const HOLDS = s => s === 'CONFIRMED' || s === 'CHECKED_IN';
const roomOf = no => ROOMS.find(r => r.number === String(no)) || null;
const stayOf = (e, today) => { const ci = addDays(today, e.ciOff); return { checkIn: ci, checkOut: addDays(ci, e.nights) }; };

export const involvedRooms = plan => {
  const s = new Set(); plan.bookings.forEach(e => s.add(e.roomNo)); plan.housekeeping.forEach(h => s.add(h.room)); plan.maintenance.forEach(m => s.add(m.room));
  return Array.from(s).filter(roomOf);
};

export function neededNights(plan, today) {
  const out = [];
  plan.bookings.forEach(e => { if (HOLDS(e.status) && roomOf(e.roomNo)) { const st = stayOf(e, today); nightDates(st.checkIn, st.checkOut).forEach(date => out.push({ roomNo: e.roomNo, date })); } });
  return out;
}

export function resolveSample(o) {
  const { plan, today, adminId, types, settings, stored } = o; const now = o.now || nowIso();
  const cap = iso => iso > now ? now : iso;                                       // never stamp the future
  const used = new Set(), claimed = new Set(), room = {}, skipped = [], keyId = {};
  const out = { bookings: [], locks: [], housekeeping: [], maintenance: [], rooms: [], counts: { booking: 0, hk: 0, req: 0 }, skipped };
  const free = no => (stored[no] || 'AVAILABLE') === 'AVAILABLE' && !room[no];    // untouched by real data and by this plan so far

  plan.bookings.forEach(e => {
    const r = roomOf(e.roomNo); const t = r && types.find(x => x.id === r.typeId);
    if (!r || !t) return skipped.push(e.key);
    const st = stayOf(e, today); const dates = nightDates(st.checkIn, st.checkOut);
    if (HOLDS(e.status)) {
      const ids = dates.map(d => nightId(r.id, d));
      const stat = stored[e.roomNo] || 'AVAILABLE';
      const usable = e.status === 'CHECKED_IN' ? free(e.roomNo) : stat !== 'MAINTENANCE' && stat !== 'OUT_OF_SERVICE';
      if (!usable || ids.some(id => o.taken.has(id) || claimed.has(id))) return skipped.push(e.key);
      ids.forEach(id => claimed.add(id));
    }
    const num = o.counters.booking + out.counts.booking++; const n = e.nights; const created = cap(stampAt(Math.min(0, e.ciOff - 6), 9 + num % 9, (num * 7) % 60));
    const b = buildBooking({ num, type: t, settings, stay: { checkIn: st.checkIn, checkOut: st.checkOut, guests: Math.min(e.guests, t.capacity) }, source: e.source, customer: null, actorId: adminId, guest: e.guest, roomId: r.id, now: created });
    Object.assign(b, { status: e.status, sample: true });
    if (e.status === 'CHECKED_IN' || e.status === 'COMPLETED') b.checkedInAt = cap(stampAt(e.ciOff, 14, 10 + num % 40));
    if (e.status === 'COMPLETED') b.checkedOutAt = cap(stampAt(e.ciOff + n, 11, 5 + num % 50));
    if (e.cancel) Object.assign(b, { cancelledAt: cap(stampAt(e.cancel.atDays, e.cancel.h, e.cancel.m)), cancelledBy: adminId, cancellationReason: e.cancel.reason });
    keyId[e.key] = b.id; out.bookings.push({ id: b.id, data: b });
    if (HOLDS(e.status)) dates.forEach(d => out.locks.push({ id: nightId(r.id, d), data: lockData(r.id, d, b.id, t.id) }));
    if (e.status === 'CHECKED_IN') room[e.roomNo] = 'OCCUPIED';
  });

  plan.housekeeping.forEach(h => {
    const bid = keyId[h.bookingKey]; const r = roomOf(h.room); if (!bid || !r) return skipped.push('hk:' + h.room);
    const open = h.status !== 'COMPLETED';
    if (open && !free(h.room)) return skipped.push('hk:' + h.room);
    const id = idOf('hk', o.counters.hk + out.counts.hk++);
    const data = { roomId: r.id, bookingId: bid, status: h.status, createdAt: cap(stampAt(...h.createdOff)), completedAt: h.completedOff ? cap(stampAt(...h.completedOff)) : null, assignedTo: h.assigned ? adminId : null, sample: true };
    out.housekeeping.push({ id, data }); if (open) room[h.room] = 'CLEANING';
  });

  plan.maintenance.forEach(m => {
    const r = roomOf(m.room); if (!r) return skipped.push('req:' + m.room);
    const open = m.status !== 'RESOLVED';
    if (open && (!free(m.room) || (o.busyRooms && o.busyRooms.has(m.room)))) return skipped.push('req:' + m.room);
    const id = idOf('req', o.counters.req + out.counts.req++);
    const data = { roomId: r.id, reportedBy: adminId, issueType: m.issueType, description: m.description, priority: m.priority, status: m.status, createdAt: cap(stampAt(...m.createdOff)), updatedAt: cap(stampAt(...m.updatedOff)), resolvedAt: m.resolvedOff ? cap(stampAt(...m.resolvedOff)) : null, sample: true };
    out.maintenance.push({ id, data }); if (open) room[m.room] = 'MAINTENANCE';
  });

  out.rooms = Object.keys(room).map(number => ({ number, status: room[number] }));
  return out;
}
