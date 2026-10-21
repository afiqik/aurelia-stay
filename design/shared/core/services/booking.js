/* AURELIA STAY — booking services (aggregator). One file per concern: booking-create / booking-cancel / booking-stay / booking-reassign,
 * shared pieces in booking-locks (roomNights) and booking-doc (pure pricing + document builder). */
export { createBooking, checkRequest } from './booking-create.js';
export { cancelBooking, checkCancel } from './booking-cancel.js';
export { checkIn, checkOut } from './booking-stay.js';
export { reassignRoom } from './booking-reassign.js';
