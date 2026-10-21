/* AURELIA STAY — static catalogue (ported 1:1 from the legacy store). The public site works with an empty database:
 * Firestore only holds overrides, merged on top of these defaults by derive.js.
 *
 * Exports:
 *   AMEN                    default amenity list
 *   TYPES                   4 room types { id, name, price, capacity, bed, size, amenities, description, active }  (ids are numbers 1..4)
 *   ROOMS                   20 fixed rooms { id (number), number ('101'), typeId, floor }  101-106 / 201-208 / 301-304 / 401-402
 *   ROOM_STATUSES           stored room statuses (RESERVED is derived, never stored)
 *   DEFAULT_SETTINGS        default system settings (failedLoginProtection intentionally removed)
 *   STAFF_ROLES             ['hotel_manager', 'admin']
 */

export const AMEN = ['Wi-Fi', 'Air Conditioning', 'Private Bathroom', 'TV'];

export const TYPES = [
  { id: 1, name: 'Standard Single', price: 80, capacity: 1, bed: 'Single Bed', size: 14, amenities: AMEN, description: 'A compact, quiet room for solo travellers and short business stays.', active: true },
  { id: 2, name: 'Standard Double', price: 85, capacity: 2, bed: 'Double Bed', size: 20, amenities: AMEN, description: 'A simple and comfortable room designed for short stays, business trips and couples.', active: true },
  { id: 3, name: 'Deluxe Double', price: 90, capacity: 2, bed: 'Queen Bed', size: 24, amenities: AMEN.concat(['Work Desk']), description: 'A little more space to unwind, with a queen bed and a small work desk.', active: true },
  { id: 4, name: 'Family Room', price: 95, capacity: 4, bed: '1 Queen + 2 Single', size: 30, amenities: AMEN, description: 'Room for up to four guests — practical for small families travelling together.', active: true }
];

export const ROOMS = [];
[[1, 101, 6], [2, 201, 8], [3, 301, 4], [4, 401, 2]].forEach(([t, s, c]) => {
  for (let i = 0; i < c; i++) { const n = s + i; ROOMS.push({ id: n, number: String(n), typeId: t, floor: Math.floor(n / 100) }); }
});

export const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE'];

export const DEFAULT_SETTINGS = {
  hotelName: 'AURELIA STAY', address: '38 Lebuh Chulia, 10200 George Town, Pulau Pinang', phone: '+60 4-261 8890', email: 'hello@aureliastay.local',
  checkInTime: '14:00', checkOutTime: '12:00', serviceFee: 10, allowOnline: true, allowWalkIn: true, allowCancel: true,
  adminTimeout: 30, managerTimeout: 30, auditLogging: true
};

export const STAFF_ROLES = ['hotel_manager', 'admin'];
