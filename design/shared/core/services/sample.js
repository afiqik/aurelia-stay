/* AURELIA STAY — demo data (contract §12), admin only.
 *
 * loadSampleData(actorId) -> { ok, loaded, already?, counts:{ bookings, locks, housekeeping, maintenance, rooms }, skipped }
 *   Idempotent: when the mirror already holds sample documents nothing is written ({ loaded:false, already:true }). One transaction reads counters/main,
 *   the involved rooms and every night it wants to lock, resolves the plan (sample-build.js: entries that would clash with real data are skipped),
 *   then writes sample:true bookings (customerId null), their roomNights, housekeeping + maintenance, the affected rooms' stored status
 *   (OCCUPIED / CLEANING / MAINTENANCE, marked sample:true), advances the counters and appends one SAMPLE_DATA_LOADED audit entry.
 *   No synthetic audit history / notifications are written: the audit log is append-only (it could never be cleaned up again) and RTDB
 *   notifications cannot be flagged — a fake trail would be lasting pollution of real records.
 * clearSampleData(actorId) -> { ok, cleared, counts }
 *   Deletes every sample:true booking / housekeeping / maintenance doc and the roomNights of those bookings, and resets the rooms still marked sample:true
 *   (rooms touched by a real operation lost the marker, see room-writes.js) to AVAILABLE. Counters are not rewound (numbers are never reused).
 */
import { fail, guard } from '../errors.js';
import { db, roomByNo } from '../state.js';
import { mergeSettings, mergeTypes } from '../derive.js';
import { writeAudit } from '../audit.js';
import { ROOMS } from '../catalog.js';
import { nowIso, today } from '../util.js';
import { nightDates, nightId } from '../availability.js';
import { adminOf } from './ctx.js';
import { runTx, getData, ref, afterCommit } from './tx.js';
import { roomRef } from './room-writes.js';
import { lockRef } from './booking-locks.js';
import { planSample } from './sample-plan.js';
import { involvedRooms, neededNights, resolveSample } from './sample-build.js';

let busy = false;
const hasSample = () => db.bookings.some(b => b.sample) || db.housekeeping.some(h => h.sample) || db.maintenance.some(m => m.sample);
const exclusive = async fn => { if (busy) fail('SERVER_500', 'Sample data is already being processed.', 409); busy = true; try { return await fn(); } finally { busy = false; } };

async function readInputs(tx, plan, t) {
  const rooms = involvedRooms(plan), nights = neededNights(plan, t);
  const [cDoc, roomDocs, lockSnaps] = await Promise.all([
    getData(tx, ref('counters', 'main')),
    Promise.all(rooms.map(n => getData(tx, roomRef(n)))),
    Promise.all(nights.map(n => tx.get(lockRef(n.roomNo, n.date))))
  ]);
  const stored = {}; rooms.forEach((n, i) => { stored[n] = roomDocs[i] && roomDocs[i].status || 'AVAILABLE'; });
  const taken = new Set(); lockSnaps.forEach((s, i) => { if (s.exists()) taken.add(nightId(nights[i].roomNo, nights[i].date)); });
  return { cDoc, stored, taken };
}

export function loadSampleData(actorId) {
  return guard(() => exclusive(async () => {
    const a = adminOf(actorId);
    if (hasSample()) return { loaded: false, already: true, counts: { bookings: db.bookings.filter(b => b.sample).length }, skipped: [] };
    const plan = planSample(), t = today(), busyRooms = new Set(db.roomNights.map(n => String(n.roomId)));
    const res = await runTx(async tx => {
      const { cDoc, stored, taken } = await readInputs(tx, plan, t);
      const cur = cDoc || {}; const counters = { booking: Math.max(1, Math.floor(Number(cur.booking)) || 1), hk: Math.max(1, Math.floor(Number(cur.hk)) || 1), req: Math.max(1, Math.floor(Number(cur.req)) || 1) };
      const types = mergeTypes(Object.fromEntries(db.roomTypes.map(x => [String(x.id), { price: x.price, active: x.active }])));
      const r = resolveSample({ plan, today: t, now: nowIso(), adminId: a.id, types, settings: mergeSettings(db.settings), counters, stored, taken, busyRooms });
      r.bookings.forEach(b => tx.set(ref('bookings', b.id), b.data));
      r.locks.forEach(l => tx.set(ref('roomNights', l.id), l.data));
      r.housekeeping.forEach(h => tx.set(ref('housekeeping', h.id), h.data));
      r.maintenance.forEach(m => tx.set(ref('maintenance', m.id), m.data));
      r.rooms.forEach(x => tx.set(roomRef(x.number), { status: x.status, updatedAt: nowIso(), sample: true }, { merge: true }));
      const patch = {}; Object.keys(r.counts).forEach(k => { if (r.counts[k] > 0) patch[k] = counters[k] + r.counts[k]; });
      if (Object.keys(patch).length) tx.set(ref('counters', 'main'), patch, { merge: true });
      const counts = { bookings: r.bookings.length, locks: r.locks.length, housekeeping: r.housekeeping.length, maintenance: r.maintenance.length, rooms: r.rooms.length };
      writeAudit(tx, a.id, 'SAMPLE_DATA_LOADED', 'system', 'sample_data', null, counts);
      return { counts, skipped: r.skipped, rooms: r.rooms };
    }, { counters: true });
    const c = res.counts;                                           // wait until every listener (bookings, housekeeping, maintenance, rooms) shows the load
    await afterCommit([], () => db.bookings.filter(b => b.sample).length >= c.bookings && db.housekeeping.filter(h => h.sample).length >= c.housekeeping
      && db.maintenance.filter(m => m.sample).length >= c.maintenance && res.rooms.every(x => { const q = roomByNo(x.number); return !!q && q.storedStatus === x.status; }));
    return { loaded: true, counts: res.counts, skipped: res.skipped };
  }));
}

export function clearSampleData(actorId) {
  return guard(() => exclusive(async () => {
    const a = adminOf(actorId);
    const bks = db.bookings.filter(b => b.sample), hks = db.housekeeping.filter(h => h.sample), mts = db.maintenance.filter(m => m.sample);
    const stays = bks.map(b => ({ b, ids: nightDates(b.checkIn, b.checkOut).map(d => nightId(b.roomId, d)) }));
    const { counts, reset } = await runTx(async tx => {
      const [roomDocs, lockSnaps] = await Promise.all([
        Promise.all(ROOMS.map(r => getData(tx, roomRef(r.number)))),
        Promise.all(stays.map(s => Promise.all(s.ids.map(id => tx.get(ref('roomNights', id))))))
      ]);
      const owned = [];
      lockSnaps.forEach((snaps, i) => snaps.forEach(s => { if (s.exists() && s.data().bookingId === stays[i].b.id) owned.push(s.ref); }));
      const reset = ROOMS.filter((r, i) => roomDocs[i] && roomDocs[i].sample === true);
      owned.forEach(r => tx.delete(r));
      bks.forEach(b => tx.delete(ref('bookings', b.id))); hks.forEach(h => tx.delete(ref('housekeeping', h.id))); mts.forEach(m => tx.delete(ref('maintenance', m.id)));
      reset.forEach(r => tx.set(roomRef(r.number), { status: 'AVAILABLE', updatedAt: nowIso(), sample: false }, { merge: true }));
      const c = { bookings: bks.length, locks: owned.length, housekeeping: hks.length, maintenance: mts.length, rooms: reset.length };
      if (bks.length + hks.length + mts.length + reset.length) writeAudit(tx, a.id, 'SAMPLE_DATA_CLEARED', 'system', 'sample_data', c, null);
      return { counts: c, reset: reset.map(r => r.number) };
    });
    await afterCommit([], () => !hasSample() && reset.every(n => { const q = roomByNo(n); return !!q && q.storedStatus === 'AVAILABLE'; }));
    return { cleared: counts.bookings + counts.housekeeping + counts.maintenance, counts };
  }));
}
