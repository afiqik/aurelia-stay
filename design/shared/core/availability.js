/* AURELIA STAY — stay validation + room availability. Pure logic on top of the mirror: availability comes from the PUBLIC `roomNights` index
 * (one doc per booked night, no PII) + room status, so customers see availability without being able to read anybody's booking.
 *
 * Exports:
 *   ACTIVE(status)                       'CONFIRMED' | 'CHECKED_IN'
 *   validateStay(ci, co, guests) -> ''   legacy messages, '' when valid (VALIDATION_001 text for the booking forms)
 *   nightDates(ci, co) -> string[]       every night of the stay [ci, co) as ISO dates
 *   nightId(roomId, date) -> string      roomNights doc id: '<roomNumber>_<YYYY-MM-DD>'
 *   makeAvailability(getState) -> { roomFree, candidates, availability, previewRoom }
 *        getState() -> { rooms, roomTypes, roomNights } (the live mirror in production, a fixture in tests)
 *   roomFree(roomId, ci, co, excludeBookingId?)     no night of [ci, co) is locked by another booking
 *   candidates(typeId, ci, co, excludeBookingId?)   rooms of the type, not MAINTENANCE/OUT_OF_SERVICE, free for the stay, ascending room id
 *   availability(ci, co, guests)                    one row per active type { typeId, name, price, capacity, total, available, fits }
 *   previewRoom(typeId, ci, co)                     room number the next booking would get, or null
 */
import { db } from './state.js';
import { today, parse, nightsBetween, addDays } from './util.js';

export const ACTIVE = s => s === 'CONFIRMED' || s === 'CHECKED_IN';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateStay(ci, co, g) {
  if (!ci) return 'Please select your check-in date';
  if (!co) return 'Please select your check-out date';
  if (!DATE_RE.test(ci) || isNaN(parse(ci))) return 'Please enter a valid check-in date';
  if (!DATE_RE.test(co) || isNaN(parse(co))) return 'Please enter a valid check-out date';
  if (ci < today()) return 'Check-in date cannot be in the past';
  if (co <= ci) return 'Check-out date must be after check-in';
  if (nightsBetween(ci, co) > 14) return 'Stays are limited to 14 nights';
  const n = Number(g);
  if (!Number.isInteger(n) || n < 1) return 'Please enter at least 1 guest';
  if (n > 4) return 'No rooms available for ' + n + ' guests.';
  return '';
}

export const nightId = (roomId, date) => String(roomId) + '_' + date;

export function nightDates(ci, co) {
  const out = [];
  for (let d = ci, i = 0; d < co && i < 400; d = addDays(d, 1), i++) out.push(d);
  return out;
}

export function makeAvailability(getState) {
  const cache = new WeakMap();                       // roomNights array -> Map(nightId -> bookingId); the mirror replaces the array on every snapshot
  const taken = () => {
    const arr = getState().roomNights; let m = cache.get(arr);
    if (!m) { m = new Map(); arr.forEach(n => m.set(nightId(n.roomId, n.date), n.bookingId)); cache.set(arr, m); }
    return m;
  };
  const roomFree = (roomId, ci, co, exclude) => {
    const t = taken();
    return nightDates(ci, co).every(d => { const b = t.get(nightId(roomId, d)); return b === undefined || b === exclude; });
  };
  const candidates = (typeId, ci, co, exclude) => getState().rooms
    .filter(r => r.typeId === Number(typeId) && r.status !== 'MAINTENANCE' && r.status !== 'OUT_OF_SERVICE' && roomFree(r.id, ci, co, exclude))
    .sort((a, b) => a.id - b.id);
  const availability = (ci, co, g) => {
    const s = getState();
    return s.roomTypes.filter(t => t.active).map(t => {
      const total = s.rooms.filter(r => r.typeId === t.id).length;
      const available = candidates(t.id, ci, co).length;
      return { typeId: t.id, name: t.name, price: t.price, capacity: t.capacity, total, available, fits: t.capacity >= Number(g) };
    });
  };
  const previewRoom = (typeId, ci, co) => { const c = candidates(typeId, ci, co); return c[0] ? c[0].number : null; };
  return { roomFree, candidates, availability, previewRoom };
}

const live = makeAvailability(() => db);
export const { roomFree, candidates, availability, previewRoom } = live;
