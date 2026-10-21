/* AURELIA STAY — housekeeping flow (staff only): advanceHousekeeping(taskId, actorId), markClean(roomId, actorId).
 *   DIRTY -> CLEANING (assignedTo = actor)  ->  COMPLETED (completedAt; a room that is stored CLEANING becomes AVAILABLE — reserved-today is derived).
 * Each step is a transaction that re-reads the task and the room, writes both, and appends the audit entry.
 * markClean(roomId): finishes the room's open task (DIRTY gets both steps); without a task it flips a CLEANING room straight to AVAILABLE.
 */
import { fail, guard } from '../errors.js';
import { db, room as roomOf } from '../state.js';
import { isReservedToday } from '../derive.js';
import { writeAudit } from '../audit.js';
import { today, nowIso } from '../util.js';
import { staffOf } from './ctx.js';
import { runTx, getData, ref, afterCommit } from './tx.js';
import { readStoredStatus, writeRoomStatus } from './room-writes.js';

export function advanceHousekeeping(taskId, actorId) {
  return guard(async () => {
    const a = staffOf(actorId); const t0 = db.housekeeping.find(x => x.id === taskId); if (!t0) fail('ROOM_003', 'Task not found.', 404);
    const r = roomOf(t0.roomId); if (!r) fail('ROOM_001', 'Room not found.', 404);
    const res = await runTx(async tx => {
      const tRef = ref('housekeeping', t0.id);
      const [t, stored] = await Promise.all([getData(tx, tRef), readStoredStatus(tx, r.number)]);
      if (!t) fail('ROOM_003', 'Task not found.', 404);
      if (t.status === 'DIRTY') {
        tx.update(tRef, { status: 'CLEANING', assignedTo: a.id });
        writeAudit(tx, a.id, 'HOUSEKEEPING_STARTED', 'room', r.number, { housekeeping: 'DIRTY' }, { housekeeping: 'CLEANING' });
        return { status: 'CLEANING' };
      } else if (t.status === 'CLEANING') {
        tx.update(tRef, { status: 'COMPLETED', completedAt: nowIso() });
        let after = stored; const freed = stored === 'CLEANING';
        if (freed) { writeRoomStatus(tx, r.number, 'AVAILABLE'); after = isReservedToday(r.id, db.bookings, today()) ? 'RESERVED' : 'AVAILABLE'; }
        writeAudit(tx, a.id, 'ROOM_MARKED_AVAILABLE', 'room', r.number, { status: 'CLEANING' }, { status: after });
        return { status: 'COMPLETED', freed };
      } else return fail('ROOM_003', 'This task is already completed.', 409);
    });
    await afterCommit([], () => { const x = db.housekeeping.find(h => h.id === t0.id), q = roomOf(r.id); return !!x && x.status === res.status && (!res.freed || (!!q && q.storedStatus === 'AVAILABLE')); });
  });
}

export function markClean(roomId, actorId) {
  return guard(async () => {
    const a = staffOf(actorId); const r = roomOf(roomId); if (!r) fail('ROOM_001', 'Room not found.', 404);
    const t = db.housekeeping.find(x => x.roomId === Number(roomId) && x.status !== 'COMPLETED');
    if (!t) {
      await runTx(async tx => {
        if (await readStoredStatus(tx, r.number) !== 'CLEANING') fail('ROOM_002', 'Room is not in cleaning.', 409);
        writeRoomStatus(tx, r.number, 'AVAILABLE');
        writeAudit(tx, a.id, 'ROOM_MARKED_AVAILABLE', 'room', r.number, { status: 'CLEANING' }, { status: 'AVAILABLE' });
      });
      await afterCommit([], () => { const x = roomOf(r.id); return !!x && x.storedStatus === 'AVAILABLE'; });
      return {};
    }
    if (t.status === 'DIRTY') { const r1 = await advanceHousekeeping(t.id, actorId); if (!r1.ok) return r1; }
    return advanceHousekeeping(t.id, actorId);
  });
}
