/* AURELIA STAY — reassignRoom(ref, roomId, actorId): move a CONFIRMED booking to another room of the SAME type (staff only).
 * Guards use the mirror (derived status: the target must be AVAILABLE, i.e. not reserved/occupied/cleaning/maintenance today, and free for every night).
 * Transaction: re-reads the booking, the target room and every night of both rooms, then updates bookings.roomId, DELETES the old room's locks and
 * CREATES the new room's locks, so roomNights stays consistent. Stored room statuses are untouched (RESERVED is derived).
 */
import { fail, guard } from '../errors.js';
import { db, booking, room as roomOf } from '../state.js';
import { writeAudit } from '../audit.js';
import { roomFree, nightDates } from '../availability.js';
import { staffOf } from './ctx.js';
import { runTx, getData, afterCommit, ref } from './tx.js';
import { readStoredStatus } from './room-writes.js';
import { readLocks, createLocks, deleteLocks } from './booking-locks.js';

export function reassignRoom(bref, roomId, actorId) {
  return guard(async () => {
    const a = staffOf(actorId); const b0 = booking(bref); if (!b0) fail('BOOKING_004', 'Booking not found.', 404);
    if (b0.status !== 'CONFIRMED') fail('BOOKING_012', 'Rooms can only be reassigned before check-in.', 409);
    const to = roomOf(roomId); if (!to || to.typeId !== b0.typeId) fail('ROOM_001', 'Choose a room of the same type.', 422);
    if (to.id === b0.roomId) fail('ROOM_002', 'Booking is already assigned to Room ' + to.number + '.', 409);
    if (to.status !== 'AVAILABLE' || !roomFree(to.id, b0.checkIn, b0.checkOut, b0.id)) fail('ROOM_002', 'Room ' + to.number + ' is not available for these dates.', 409);
    const from = roomOf(b0.roomId);
    const notAvailable = () => fail('ROOM_002', 'Room ' + to.number + ' is not available for these dates.', 409);

    await runTx(async tx => {
      const bRef = ref('bookings', b0.id);
      const cur = await getData(tx, bRef); if (!cur) fail('BOOKING_004', 'Booking not found.', 404);
      if (cur.status !== 'CONFIRMED') fail('BOOKING_012', 'Rooms can only be reassigned before check-in.', 409);
      const dates = nightDates(cur.checkIn, cur.checkOut);
      const [stored, newLocks, oldLocks] = await Promise.all([readStoredStatus(tx, to.number), readLocks(tx, to.id, dates), readLocks(tx, cur.roomId, dates)]);
      if (Number(cur.roomId) === to.id) fail('ROOM_002', 'Booking is already assigned to Room ' + to.number + '.', 409);
      if (stored !== 'AVAILABLE' || newLocks.some(l => l.exists)) notAvailable();
      tx.update(bRef, { roomId: to.id });
      deleteLocks(tx, oldLocks, cur.id);
      createLocks(tx, to.id, dates, cur.id, cur.typeId);
      writeAudit(tx, a.id, 'BOOKING_ROOM_REASSIGNED', 'booking', cur.ref, { room: from ? from.number : String(cur.roomId) }, { room: to.number });
    });
    await afterCommit([], () => { const x = booking(b0.ref); return !!x && x.roomId === to.id; });
  });
}
