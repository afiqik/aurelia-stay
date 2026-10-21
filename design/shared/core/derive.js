/* AURELIA STAY — "defaults + overrides" merging and derived room status. Pure functions (no Firebase, no state).
 *
 * Exports:
 *   mergeSettings(doc|null)            DEFAULT_SETTINGS + known, type-matching override fields from settings/main
 *   mergeTypes(docsById)               4 room types with price/description/active/updatedAt overridden from roomTypes/{id} (docsById: { '1': {...} })
 *   mergeRooms(docsByNumber)           20 rooms { id, number, typeId, floor, status, storedStatus, updatedAt } with status from rooms/{number}
 *   isReservedToday(roomId, bookings, todayIso)   CONFIRMED booking with checkIn <= today < checkOut for that room
 *   deriveRooms(rooms, bookings, todayIso)        mutates + returns rooms: stored AVAILABLE + reserved today => 'RESERVED' (staff only; contract §6)
 */
import { TYPES, ROOMS, ROOM_STATUSES, DEFAULT_SETTINGS } from './catalog.js';

const finite = v => typeof v === 'number' && isFinite(v);

export function mergeSettings(doc) {
  const out = Object.assign({}, DEFAULT_SETTINGS);
  if (!doc) return out;
  Object.keys(DEFAULT_SETTINGS).forEach(k => {
    const v = doc[k];
    if (v === undefined || v === null || typeof v !== typeof DEFAULT_SETTINGS[k]) return;
    if (typeof v === 'number' && !finite(v)) return;
    out[k] = v;
  });
  return out;
}

export function mergeTypes(docs) {
  docs = docs || {};
  return TYPES.map(t => {
    const o = Object.assign({}, t, { amenities: t.amenities.slice(), updatedAt: null }); const d = docs[String(t.id)];
    if (d) {
      const price = Number(d.price);
      if (d.price !== undefined && d.price !== null && finite(price)) o.price = price;
      if (typeof d.description === 'string') o.description = d.description;
      if (typeof d.active === 'boolean') o.active = d.active;
      if (typeof d.updatedAt === 'string') o.updatedAt = d.updatedAt;
    }
    return o;
  });
}

export function mergeRooms(docs) {
  docs = docs || {};
  return ROOMS.map(r => {
    const d = docs[r.number]; const status = d && ROOM_STATUSES.indexOf(d.status) >= 0 ? d.status : 'AVAILABLE';
    return Object.assign({}, r, { status, storedStatus: status, updatedAt: d && typeof d.updatedAt === 'string' ? d.updatedAt : null });
  });
}

export const isReservedToday = (roomId, bookings, t) =>
  bookings.some(b => Number(b.roomId) === Number(roomId) && b.status === 'CONFIRMED' && b.checkIn <= t && b.checkOut > t);

export function deriveRooms(rooms, bookings, t) {
  rooms.forEach(r => { if (r.storedStatus === 'AVAILABLE' && isReservedToday(r.id, bookings, t)) r.status = 'RESERVED'; });
  return rooms;
}
