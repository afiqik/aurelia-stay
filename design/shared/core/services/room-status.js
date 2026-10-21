/* AURELIA STAY — setRoomStatus(roomId, status, actorId): manual AVAILABLE <-> OUT_OF_SERVICE switch (staff only).
 * Guards use the derived status (a room reserved today cannot be taken out of service), OUT_OF_SERVICE additionally needs no CONFIRMED bookings
 * on the room. The transaction re-reads the stored status and writes rooms/{number}.
 */
import { fail, guard } from '../errors.js';
import { db, room as roomOf } from '../state.js';
import { writeAudit } from '../audit.js';
import { staffOf } from './ctx.js';
import { runTx, afterCommit } from './tx.js';
import { readStoredStatus, writeRoomStatus, label } from './room-writes.js';

const ALLOWED = { AVAILABLE: ['OUT_OF_SERVICE'], OUT_OF_SERVICE: ['AVAILABLE'] };
const transitionError = (r, from, status) => fail('ROOM_002', 'Room ' + r.number + ' cannot change from ' + String(from).replace(/_/g, ' ') + ' to ' + String(status).replace(/_/g, ' ') + ' directly.', 409);

export function setRoomStatus(roomId, status, actorId) {
  return guard(async () => {
    const a = staffOf(actorId); const r = roomOf(roomId); if (!r) fail('ROOM_001', 'Room not found.', 404);
    if ((ALLOWED[r.status] || []).indexOf(status) < 0) transitionError(r, r.status, status);
    if (status === 'OUT_OF_SERVICE' && db.bookings.some(b => b.roomId === r.id && b.status === 'CONFIRMED')) fail('ROOM_002', 'Room ' + r.number + ' has upcoming bookings. Reassign them first.', 409);
    await runTx(async tx => {
      const before = await readStoredStatus(tx, r.number);
      if ((ALLOWED[before] || []).indexOf(status) < 0) transitionError(r, before, status);
      writeRoomStatus(tx, r.number, status);
      writeAudit(tx, a.id, 'ROOM_STATUS_CHANGED', 'room', r.number, { status: before }, { status });
    });
    await afterCommit([], () => { const x = roomOf(r.id); return !!x && x.storedStatus === status; });
  });
}
