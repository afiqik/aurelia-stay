/* AURELIA STAY — cancelBooking(ref, actorId, reason) -> Promise<result>
 * Customers: own CONFIRMED bookings before the check-in date (and only while settings.allowCancel). Managers: any CONFIRMED booking.
 * Admins: any CONFIRMED booking, with a mandatory reason (administrative override).
 * Transaction: re-reads the booking (status/room may have changed since the mirror), sets status CANCELLED + cancellation fields, DELETES every
 * roomNights lock of the stay (the nights become bookable again) and writes the audit entry. The room's stored status is untouched: RESERVED is derived.
 * Notifications after commit (legacy texts): customer, 'managers' (admin override) or 'admins' (manager cancellation).
 *
 * Exports: cancelBooking, checkCancel(actor, booking, settings) (shared sync guard, exported for tests), findForActor(actor, ref)
 */
import { fail, guard } from '../errors.js';
import { db, booking } from '../state.js';
import { writeAudit } from '../audit.js';
import { today, nowIso } from '../util.js';
import { nightDates } from '../availability.js';
import { actorOf } from './ctx.js';
import { runTx, getData, afterCommit, ref } from './tx.js';
import { readLocks, deleteLocks } from './booking-locks.js';
import { statusWord } from './booking-doc.js';

export function checkCancel(a, b, settings) {
  if (a.role === 'customer') {
    if (b.customerId !== a.id) fail('PERMISSION_001', 'You do not have access to this booking.', 403);
    if (!settings.allowCancel) fail('BOOKING_006', 'Online cancellation is currently disabled. Please contact the hotel.', 409);
  }
  if (b.status === 'CANCELLED') fail('BOOKING_007', 'This booking has already been cancelled.', 409);
  if (b.status !== 'CONFIRMED') fail('BOOKING_008', 'Only confirmed bookings can be cancelled. This booking is ' + statusWord(b.status) + '.', 409);
  if (a.role === 'customer' && today() >= b.checkIn) fail('BOOKING_009', 'Bookings can only be cancelled before the check-in date.', 409);
}

/** A customer's mirror only holds their own bookings. For a booking that is not theirs, the public roomNights index (bookingId, no PII)
 *  still tells "exists but not yours" (PERMISSION_001, as the legacy engine) from "unknown" (BOOKING_004). */
export function findForActor(a, bref) {
  const b = booking(bref); if (b) return b;
  const m = /^AUR-\d{4}-(\d{5})$/.exec(String(bref)); const id = m ? 'b' + Number(m[1]) : String(bref);
  if (a.role === 'customer' && db.roomNights.some(n => n.bookingId === id)) fail('PERMISSION_001', 'You do not have access to this booking.', 403);
  return fail('BOOKING_004', 'Booking not found.', 404);
}

export function cancelBooking(bref, actorId, reason) {
  return guard(async () => {
    const a = actorOf(actorId); const b0 = findForActor(a, bref);
    checkCancel(a, b0, db.settings);
    const why = String(reason || '').trim();
    if (a.role === 'admin' && !why) fail('VALIDATION_001', 'A reason is required for administrative cancellation.', 422);
    if (why.length > 500) fail('VALIDATION_001', 'The reason must be 500 characters or fewer.', 422);
    const finalReason = why || (a.role === 'customer' ? 'Cancelled by customer' : 'Cancelled by hotel');

    const b = await runTx(async tx => {
      const bRef = ref('bookings', b0.id);
      const cur = await getData(tx, bRef); if (!cur) fail('BOOKING_004', 'Booking not found.', 404);
      checkCancel(a, cur, db.settings);
      const locks = await readLocks(tx, cur.roomId, nightDates(cur.checkIn, cur.checkOut));
      const patch = { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: a.id, cancellationReason: finalReason };
      tx.update(bRef, patch);
      deleteLocks(tx, locks, cur.id);
      writeAudit(tx, a.id, a.role === 'admin' ? 'ADMIN_BOOKING_OVERRIDE' : 'BOOKING_CANCELLED', 'booking', cur.ref, { status: 'CONFIRMED' }, { status: 'CANCELLED' }, finalReason);
      return Object.assign({}, cur, patch);
    });

    const notes = [];
    if (b.customerId) notes.push([b.customerId, 'BOOKING_CANCELLED', 'Booking ' + b.ref + ' cancelled', a.role === 'customer' ? 'Your booking has been cancelled.' : 'Your booking was cancelled by the hotel. Reason: ' + b.cancellationReason]);
    if (a.role === 'admin') notes.push(['managers', 'ADMIN_BOOKING_OVERRIDE', 'Booking ' + b.ref + ' cancelled by Admin', b.cancellationReason]);
    if (a.role === 'hotel_manager') notes.push(['admins', 'BOOKING_CANCELLED', 'Booking ' + b.ref + ' cancelled by Manager', b.cancellationReason]);
    await afterCommit(notes, () => { const x = booking(b.ref); return !!x && x.status === 'CANCELLED'; });
  });
}
