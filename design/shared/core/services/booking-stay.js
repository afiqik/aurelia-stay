/* AURELIA STAY — checkIn(ref, actorId) and checkOut(ref, actorId) (staff only). Each is one transaction that re-reads the booking and the room.
 *
 * checkIn : CONFIRMED booking, today >= checkIn, room (derived status) RESERVED|AVAILABLE  ->  booking CHECKED_IN, room stored OCCUPIED.
 * checkOut: CHECKED_IN booking -> COMPLETED, room stored CLEANING, a DIRTY housekeeping task (HK-nnnn, counter 'hk'), and the nights that are
 *           still ahead (an early check-out) are released from roomNights so the room can be sold again once it is clean.
 * Notifications after commit: customer (BOOKING_CHECKED_IN / BOOKING_COMPLETED), 'managers' HOUSEKEEPING_REQUIRED.
 */
import { fail, guard } from '../errors.js';
import { db, booking, room as roomOf } from '../state.js';
import { writeAudit } from '../audit.js';
import { nextSeqs, idOf } from '../counters.js';
import { today, nowIso, fmtDate } from '../util.js';
import { nightDates } from '../availability.js';
import { staffOf } from './ctx.js';
import { runTx, getData, afterCommit, ref } from './tx.js';
import { readStoredStatus, writeRoomStatus, label } from './room-writes.js';
import { readLocks, deleteLocks, fromToday } from './booking-locks.js';

function checkInGuards(b, derivedStatus, roomNo) {
  if (b.status !== 'CONFIRMED') fail('BOOKING_010', 'This booking cannot be checked in. Status is ' + String(b.status).replace('_', '-') + '.', 409);
  if (today() < b.checkIn) fail('BOOKING_010', 'This booking cannot be checked in yet. Check-in opens on ' + fmtDate(b.checkIn) + '.', 409);
  if (['RESERVED', 'AVAILABLE'].indexOf(derivedStatus) < 0) fail('ROOM_002', 'This booking cannot be checked in. Room ' + roomNo + ' is ' + label(derivedStatus) + '.', 409);
}

export function checkIn(bref, actorId) {
  return guard(async () => {
    const a = staffOf(actorId); const b0 = booking(bref); if (!b0) fail('BOOKING_004', 'Booking not found.', 404);
    const r0 = roomOf(b0.roomId); if (!r0) fail('ROOM_001', 'Room not found.', 404);
    checkInGuards(b0, r0.status, r0.number);
    const b = await runTx(async tx => {
      const bRef = ref('bookings', b0.id);
      const [cur, stored] = await Promise.all([getData(tx, bRef), readStoredStatus(tx, r0.number)]);
      if (!cur) fail('BOOKING_004', 'Booking not found.', 404);
      if (Number(cur.roomId) !== r0.id) fail('BOOKING_010', 'This booking was changed by someone else. Please refresh and try again.', 409);
      checkInGuards(cur, stored, r0.number);                                  // RESERVED is never stored: a free room is stored AVAILABLE
      const patch = { status: 'CHECKED_IN', checkedInAt: nowIso() };
      tx.update(bRef, patch); writeRoomStatus(tx, r0.number, 'OCCUPIED');
      writeAudit(tx, a.id, 'BOOKING_CHECKED_IN', 'booking', cur.ref, { status: 'CONFIRMED', room: 'RESERVED' }, { status: 'CHECKED_IN', room: 'OCCUPIED' });
      return Object.assign({}, cur, patch);
    });
    const notes = b.customerId ? [[b.customerId, 'BOOKING_CHECKED_IN', 'Checked in — Room ' + r0.number, 'Your booking ' + b.ref + ' has been checked in. Enjoy your stay.']] : [];
    await afterCommit(notes, () => { const x = booking(b.ref), q = roomOf(r0.id); return !!x && x.status === 'CHECKED_IN' && !!q && q.storedStatus === 'OCCUPIED'; });
  });
}

export function checkOut(bref, actorId) {
  return guard(async () => {
    const a = staffOf(actorId); const b0 = booking(bref); if (!b0) fail('BOOKING_004', 'Booking not found.', 404);
    const r0 = roomOf(b0.roomId); if (!r0) fail('ROOM_001', 'Room not found.', 404);
    if (b0.status !== 'CHECKED_IN') fail('BOOKING_011', 'Only checked-in bookings can be checked out.', 409);
    const b = await runTx(async tx => {
      const bRef = ref('bookings', b0.id);
      const cur = await getData(tx, bRef); if (!cur) fail('BOOKING_004', 'Booking not found.', 404);
      if (cur.status !== 'CHECKED_IN') fail('BOOKING_011', 'Only checked-in bookings can be checked out.', 409);
      if (Number(cur.roomId) !== r0.id) fail('BOOKING_011', 'This booking was changed by someone else. Please refresh and try again.', 409);
      const locks = await readLocks(tx, cur.roomId, fromToday(nightDates(cur.checkIn, cur.checkOut)));
      const { hk } = await nextSeqs(tx, ['hk']);                              // last read; writes start here
      const hkId = idOf('hk', hk); const now = nowIso(); const patch = { status: 'COMPLETED', checkedOutAt: now };
      tx.update(bRef, patch); writeRoomStatus(tx, r0.number, 'CLEANING'); deleteLocks(tx, locks, cur.id);
      tx.set(ref('housekeeping', hkId), { roomId: r0.id, bookingId: cur.id, status: 'DIRTY', createdAt: now, completedAt: null, assignedTo: null });
      writeAudit(tx, a.id, 'BOOKING_CHECKED_OUT', 'booking', cur.ref, { status: 'CHECKED_IN', room: 'OCCUPIED' }, { status: 'COMPLETED', room: 'CLEANING' });
      return Object.assign({}, cur, patch);
    }, { counters: true });
    const notes = [];
    if (b.customerId) notes.push([b.customerId, 'BOOKING_COMPLETED', 'Stay completed', 'Thanks for staying with us. Booking ' + b.ref + ' is complete.']);
    notes.push(['managers', 'HOUSEKEEPING_REQUIRED', 'Room ' + r0.number + ' requires cleaning', 'Guest checked out of ' + b.ref + '.']);
    await afterCommit(notes, () => { const x = booking(b.ref), q = roomOf(r0.id); return !!x && x.status === 'COMPLETED' && !!q && q.storedStatus === 'CLEANING' && db.housekeeping.some(h => h.bookingId === b.id); });
  });
}
