/* AURELIA STAY — createBooking(o) -> Promise<{ ok:true, booking } | { ok:false, code, error, http }>
 *   o = { source: 'ONLINE' (default) | 'WALK_IN', customerId (ONLINE), actorId (WALK_IN), guest: { name, phone, email? } (WALK_IN),
 *         typeId, checkIn, checkOut, guests, payment? }
 *
 * 1. Synchronous validation against the mirror (fast, legacy messages, same order as the legacy engine).
 * 2. ONE Firestore transaction: re-read the authoritative catalogue (roomTypes/{id}, settings/main) + the candidate rooms' stored status and
 *    every night's roomNights lock, pick the first free room of the type (ascending room id), then write counters/main, bookings/{id}, one create-only
 *    roomNights doc per night and the audit entry. If two browsers race for the last room the loser's transaction aborts, re-reads, finds the
 *    lock docs and ends with BOOKING_003 — double-booking is impossible (and the rules refuse a booking whose locks are not created with it).
 * 3. After commit: RTDB notifications (customer + 'managers'), then wait (max 3 s) until the new booking is in the mirror so the page can
 *    read S.booking(ref) synchronously right after the await.
 *
 * Exports: createBooking, checkRequest (sync part, exported for tests)
 */
import { fail, guard } from '../errors.js';
import { db, type, booking } from '../state.js';
import { mergeSettings, mergeTypes } from '../derive.js';
import { validateStay, candidates, nightDates } from '../availability.js';
import { writeAudit } from '../audit.js';
import { nextSeqs } from '../counters.js';
import { isEmail, isPhone, nowIso, fmtShort } from '../util.js';
import { actorOf, isStaff } from './ctx.js';
import { runTx, ref, getData, afterCommit } from './tx.js';
import { readStoredStatus } from './room-writes.js';
import { readLocks, createLocks } from './booking-locks.js';
import { buildBooking } from './booking-doc.js';

export function checkRequest(o) {
  o = o || {}; const s = db.settings; const source = o.source || 'ONLINE'; let cust = null, actor = null, guest;
  if (source !== 'ONLINE' && source !== 'WALK_IN') fail('VALIDATION_001', 'Invalid booking source.', 422);
  if (source === 'ONLINE') {
    cust = actor = actorOf(o.customerId);
    if (cust.role !== 'customer') fail('PERMISSION_001', 'Only customers can create online bookings.', 403);
    if (!s.allowOnline) fail('BOOKING_005', 'Online booking is currently disabled.', 409);
    if (!cust.phone) fail('BOOKING_001', 'Please add your phone number before booking.', 422);
    guest = { name: cust.name, email: cust.email, phone: cust.phone };
  } else {
    actor = actorOf(o.actorId); if (!isStaff(actor)) fail('PERMISSION_001', 'Forbidden.', 403);
    if (!s.allowWalkIn) fail('BOOKING_005', 'Walk-in booking is currently disabled.', 409);
    guest = o.guest || {};
    if (!String(guest.name || '').trim()) fail('VALIDATION_001', 'Guest name is required.', 422);
    if (!isPhone(guest.phone)) fail('VALIDATION_001', 'A valid guest phone number is required.', 422);
    if (guest.email && !isEmail(guest.email)) fail('VALIDATION_001', 'Guest email is not valid.', 422);
  }
  const t = type(o.typeId); if (!t || !t.active) fail('ROOM_001', 'Room type not found.', 404);
  const v = validateStay(o.checkIn, o.checkOut, o.guests); if (v) fail('VALIDATION_001', v, 422);
  if (Number(o.guests) > t.capacity) fail('BOOKING_002', t.name + ' fits up to ' + t.capacity + (t.capacity > 1 ? ' guests.' : ' guest.'), 422);
  const cands = candidates(t.id, o.checkIn, o.checkOut);
  if (!cands.length) fail('BOOKING_003', 'This room is no longer available. Please select another room.', 409);
  return { source, actor, cust, guest, t, cands };
}

const unavailable = () => fail('BOOKING_003', 'This room is no longer available. Please select another room.', 409);

async function commit(o, c) {
  const dates = nightDates(o.checkIn, o.checkOut);
  return runTx(async tx => {
    const [tDoc, sDoc] = await Promise.all([getData(tx, ref('roomTypes', String(c.t.id))), getData(tx, ref('settings', 'main'))]);
    const settings = mergeSettings(sDoc); const type = mergeTypes(tDoc ? { [String(c.t.id)]: tDoc } : {}).find(x => x.id === c.t.id);
    if (!type.active) fail('ROOM_001', 'Room type not found.', 404);
    if (c.source === 'ONLINE' ? !settings.allowOnline : !settings.allowWalkIn) fail('BOOKING_005', (c.source === 'ONLINE' ? 'Online' : 'Walk-in') + ' booking is currently disabled.', 409);
    let chosen = null;
    for (const r of c.cands) {                                       // mirror candidates, ascending room id; the authoritative docs decide
      const [stored, locks] = await Promise.all([readStoredStatus(tx, r.number), readLocks(tx, r.id, dates)]);
      if (stored === 'MAINTENANCE' || stored === 'OUT_OF_SERVICE' || locks.some(l => l.exists)) continue;
      chosen = r; break;
    }
    if (!chosen) unavailable();
    const { booking: num } = await nextSeqs(tx, ['booking']);        // last read; writes start here
    const b = buildBooking({ num, type, settings, stay: o, source: c.source, customer: c.cust, actorId: c.actor.id, guest: c.guest, roomId: chosen.id, payment: o.payment, now: nowIso() });
    tx.set(ref('bookings', b.id), b);
    createLocks(tx, chosen.id, dates, b.id, type.id);
    writeAudit(tx, c.actor.id, 'BOOKING_CREATED', 'booking', b.ref, null, { status: 'CONFIRMED', room: chosen.number, source: c.source, total: b.total });
    return { booking: b, room: chosen };
  }, { counters: true });
}

export function createBooking(o) {
  return guard(async () => {
    const c = checkRequest(o);
    const { booking: b, room } = await commit(o, c);
    const notes = [];
    if (c.cust) notes.push([c.cust.id, 'BOOKING_CONFIRMED', 'Booking ' + b.ref + ' confirmed', 'Room ' + room.number + ' is reserved for ' + fmtShort(b.checkIn) + ' – ' + fmtShort(b.checkOut) + '.']);
    notes.push(['managers', 'NEW_BOOKING', 'New ' + (c.source === 'WALK_IN' ? 'walk-in' : 'online') + ' booking ' + b.ref, b.guestName + ' · ' + c.t.name + ' · Room ' + room.number]);
    await afterCommit(notes, () => !!booking(b.ref));
    return { booking: b };
  });
}
