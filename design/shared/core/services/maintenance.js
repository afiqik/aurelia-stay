/* AURELIA STAY — maintenance flow (staff only): reportMaintenance(o, actorId), advanceMaintenance(id, actorId); setRoomStatus lives in room-status.js.
 *
 * reportMaintenance({ roomNumber, issueType, description, priority? }) -> { ok, id:'REQ-nnnn' }: refuses OCCUPIED/RESERVED rooms (derived status),
 *   creates the request (counter 'req'), puts the room into MAINTENANCE, completes the room's open housekeeping tasks, notifies managers + admins.
 * advanceMaintenance(id): OPEN -> IN_PROGRESS -> RESOLVED; resolving frees the room (-> AVAILABLE) unless another request for it is still open.
 */
import { fail, guard } from '../errors.js';
import { db, roomByNo, room as roomOf } from '../state.js';
import { writeAudit } from '../audit.js';
import { nextSeqs, idOf } from '../counters.js';
import { nowIso } from '../util.js';
import { staffOf } from './ctx.js';
import { runTx, getData, afterCommit, ref } from './tx.js';
import { readStoredStatus, writeRoomStatus } from './room-writes.js';

export { setRoomStatus } from './room-status.js';

export function reportMaintenance(o, actorId) {
  return guard(async () => {
    o = o || {}; const a = staffOf(actorId);
    const r = roomByNo(o.roomNumber); if (!r) fail('ROOM_001', 'Room ' + (o.roomNumber || '') + ' does not exist.', 404);
    if (!o.issueType) fail('VALIDATION_001', 'Please choose an issue type.', 422);
    if (!String(o.description || '').trim()) fail('VALIDATION_001', 'Please describe the issue.', 422);
    const blocked = s => { if (s === 'OCCUPIED' || s === 'RESERVED') fail('ROOM_002', 'Room ' + r.number + ' is ' + s.toLowerCase() + '. Reassign or check out the guest first.', 409); };
    blocked(r.status);
    const priority = o.priority || 'MEDIUM'; const open = db.housekeeping.filter(t => t.roomId === r.id && t.status !== 'COMPLETED');
    const id = await runTx(async tx => {
      const [stored, tasks] = await Promise.all([readStoredStatus(tx, r.number), Promise.all(open.map(t => getData(tx, ref('housekeeping', t.id))))]);
      blocked(stored);
      const { req } = await nextSeqs(tx, ['req']);                            // last read; writes start here
      const rid = idOf('req', req); const now = nowIso();
      tx.set(ref('maintenance', rid), { roomId: r.id, reportedBy: a.id, issueType: o.issueType, description: String(o.description).trim(), priority, status: 'OPEN', createdAt: now, updatedAt: now, resolvedAt: null });
      writeRoomStatus(tx, r.number, 'MAINTENANCE');
      tasks.forEach((t, i) => { if (t && t.status !== 'COMPLETED') tx.update(ref('housekeeping', open[i].id), { status: 'COMPLETED', completedAt: now }); });
      writeAudit(tx, a.id, 'MAINTENANCE_REPORTED', 'maintenance_request', rid, { room: stored }, { room: 'MAINTENANCE', priority });
      return rid;
    }, { counters: true });
    const settled = () => { const q = roomOf(r.id); return db.maintenance.some(x => x.id === id) && !!q && q.storedStatus === 'MAINTENANCE' && open.every(t => { const h = db.housekeeping.find(x => x.id === t.id); return !h || h.status === 'COMPLETED'; }); };
    await afterCommit([
      ['managers', 'MAINTENANCE_REPORTED', 'Room ' + r.number + ' has a new maintenance request', id + ' · ' + o.issueType + ' · ' + priority],
      ['admins', 'MAINTENANCE_ALERT', 'Room ' + r.number + ' entered maintenance', id + ' reported by ' + a.name + '.']], settled);
    return { id };
  });
}

export function advanceMaintenance(id, actorId) {
  return guard(async () => {
    const a = staffOf(actorId); const m0 = db.maintenance.find(x => x.id === id); if (!m0) fail('ROOM_003', 'Request not found.', 404);
    const r = roomOf(m0.roomId); if (!r) fail('ROOM_001', 'Room not found.', 404);
    const othersOpen = db.maintenance.some(x => x.roomId === r.id && x.id !== m0.id && x.status !== 'RESOLVED');
    const next = await runTx(async tx => {
      const mRef = ref('maintenance', m0.id);
      const [m, stored] = await Promise.all([getData(tx, mRef), readStoredStatus(tx, r.number)]);
      if (!m) fail('ROOM_003', 'Request not found.', 404);
      const before = m.status; const now = nowIso(); let status;
      if (before === 'OPEN') { status = 'IN_PROGRESS'; tx.update(mRef, { status, updatedAt: now }); }
      else if (before === 'IN_PROGRESS') {
        status = 'RESOLVED'; tx.update(mRef, { status, resolvedAt: now, updatedAt: now });
        if (stored === 'MAINTENANCE' && !othersOpen) writeRoomStatus(tx, r.number, 'AVAILABLE');
      } else return fail('ROOM_003', 'Request already resolved.', 409);
      writeAudit(tx, a.id, 'MAINTENANCE_' + status, 'maintenance_request', m0.id, { status: before }, { status });
      return { status, freed: status === 'RESOLVED' && stored === 'MAINTENANCE' && !othersOpen };
    });
    await afterCommit([], () => { const x = db.maintenance.find(q => q.id === m0.id), q = roomOf(r.id); return !!x && x.status === next.status && (!next.freed || (!!q && q.storedStatus === 'AVAILABLE')); });
  });
}
