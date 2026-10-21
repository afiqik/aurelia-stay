/* AURELIA STAY — pure booking math + document builder (no Firebase; unit-testable).
 *
 * Exports:
 *   priceStay(roomPrice, nights, serviceFee) -> { roomPrice, nights, serviceFee, subtotal, total }   snapshot pricing: subtotal = price * nights, total = subtotal + fee
 *   buildBooking({ num, type, settings, stay, source, customer, actorId, guest, roomId, payment, now }) -> bookings/{id} document (status CONFIRMED)
 *        stay = { checkIn, checkOut, guests }; customer = profile|null; guest = { name, email, phone }; type/settings are the AUTHORITATIVE merged docs
 *   statusWord(status) -> 'checked-in'   used in legacy error texts ('CHECKED_IN' -> 'checked-in')
 */
import { nightsBetween, refOf } from '../util.js';

export function priceStay(roomPrice, nights, serviceFee) {
  const subtotal = roomPrice * nights;
  return { roomPrice, nights, serviceFee, subtotal, total: subtotal + serviceFee };
}

export const statusWord = s => String(s).replace('_', '-').toLowerCase();

export function buildBooking(o) {
  const { num, type, settings, stay, source, customer, actorId, guest, roomId, payment, now } = o;
  const n = nightsBetween(stay.checkIn, stay.checkOut);
  return Object.assign({
    id: 'b' + num, ref: refOf(num), customerId: customer ? customer.id : null, roomId: Number(roomId), typeId: type.id, source,
    checkIn: stay.checkIn, checkOut: stay.checkOut, guests: Number(stay.guests)
  }, priceStay(type.price, n, settings.serviceFee), {
    status: 'CONFIRMED', guestName: String(guest.name).trim(), guestEmail: guest.email || '', guestPhone: guest.phone || '', payment: payment || 'Pay at Hotel',
    createdAt: now, createdBy: customer ? customer.id : actorId, checkedInAt: null, checkedOutAt: null, cancelledAt: null, cancelledBy: null, cancellationReason: null
  });
}
