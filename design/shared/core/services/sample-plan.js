/* AURELIA STAY — the demo-data PLAN (contract §12): a believable booking history relative to today, ported from the legacy seed
 * (34 bookings across COMPLETED / CHECKED_IN / CONFIRMED / CANCELLED, 3 housekeeping tasks, 2 maintenance requests). Pure data, no Firebase.
 * Guests are made-up people on example.com addresses; every booking is guest-only (customerId null) and flagged sample:true by sample-build.js.
 *
 * Exports:
 *   planSample() -> { bookings: Entry[], housekeeping: Hk[], maintenance: Req[] }
 *     Entry = { key, guest:{name,email,phone}, roomNo, ciOff, nights, guests, status, source, cancel?:{ atDays,h,m, reason } }   ciOff = check-in offset in days from today
 *     Hk    = { room, bookingKey, status, createdOff:[days,h,m], completedOff?:[...] , assigned }   Req = { room, issueType, description, priority, status, createdOff, updatedOff, resolvedOff? }
 *   stampAt(days, h, m) -> ISO timestamp for "today + days at h:m" (local time, like the legacy seed)
 */
export const stampAt = (days, h, m) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString(); };

const person = (name, email, phone) => ({ name, email, phone });
const CUST = {
  afiq: person('Muhammad Afiq', 'afiq@example.com', '018-353 4410'), ali: person('Ali Hassan', 'ali.hassan@example.com', '012-778 2231'),
  sara: person('Sara Lim', 'sara.lim@example.com', '016-224 9087'), nurul: person('Nurul Izzah', 'nurul.izzah@example.com', '019-661 3025'),
  daniel: person('Daniel Wong', 'daniel.wong@example.com', '017-330 5518'), farah: person('Farah Aziz', 'farah.aziz@example.com', '011-2345 6671'),
  kumar: person('Kumar Selvam', 'kumar.selvam@example.com', '013-908 1142'), mei: person('Tan Mei Ling', 'meiling.tan@example.com', '012-605 7730'),
  hakim: person('Hakim Yusof', 'hakim.yusof@example.com', '014-552 0917')
};
const WALK = [person('Faizal Karim', '', '012-889 0021'), person('Lee Chong', '', '016-310 4471'), person('Rosnah Ismail', '', '019-202 8834'), person('Arun Pillai', '', '017-661 0098'), person('Siti Aminah', '', '013-455 2290')];
const CUST_ORDER = ['sara', 'ali', 'daniel', 'nurul', 'farah', 'kumar', 'mei', 'afiq', 'hakim'];
const CYCLE = ['101', '201', '304', '402', '106', '202', '206', '301', '207', '104', '203', '401', '208', '302', '102', '205', '303', '105', '204'];

export function planSample() {
  const B = [];
  const add = (key, guest, roomNo, ciOff, nights, guests, status, source, cancel) => B.push({ key, guest, roomNo, ciOff, nights, guests, status, source: source || 'ONLINE', cancel: cancel || null });
  add('b91', CUST.afiq, '303', -16, 2, 2, 'COMPLETED');
  for (let i = 0; i < 19; i++) {
    const walk = i % 4 === 3;
    add('b' + (92 + i), walk ? WALK[i % 5] : CUST[CUST_ORDER[i % 9]], CYCLE[i], -58 + Math.round(i * 2.6), 1 + i % 3, 1 + i % 2, 'COMPLETED', walk ? 'WALK_IN' : 'ONLINE');
  }
  add('b111', CUST.kumar, '103', -2, 2, 1, 'COMPLETED');
  add('b112', WALK[2], '204', -1, 1, 2, 'COMPLETED', 'WALK_IN');
  add('b113', CUST.daniel, '206', 4, 2, 2, 'CANCELLED', 'ONLINE', { atDays: -2, h: 20, m: 14, reason: 'Cancelled by customer' });
  add('b114', CUST.ali, '303', -10, 2, 2, 'CANCELLED', 'ONLINE', { atDays: -14, h: 11, m: 2, reason: 'Cancelled by customer' });
  add('b116', CUST.ali, '102', -2, 2, 1, 'CHECKED_IN');
  add('b117', CUST.sara, '201', -1, 3, 2, 'CHECKED_IN');
  add('b118', CUST.daniel, '203', -3, 3, 2, 'CHECKED_IN');
  add('b119', WALK[0], '302', -1, 2, 2, 'CHECKED_IN', 'WALK_IN');
  add('b120', CUST.nurul, '401', 0, 2, 3, 'CHECKED_IN');
  add('b121', CUST.farah, '104', 0, 2, 1, 'CONFIRMED');
  add('b122', CUST.kumar, '202', 0, 3, 2, 'CONFIRMED');
  add('b123', CUST.mei, '301', 5, 2, 2, 'CONFIRMED');
  add('b124', WALK[3], '207', 2, 2, 2, 'CANCELLED', 'WALK_IN', { atDays: -1, h: 15, m: 40, reason: 'Administrative cancellation due to duplicate reservation' });
  add('b125', CUST.afiq, '205', 27, 3, 2, 'CONFIRMED');

  const housekeeping = [
    { room: '101', bookingKey: 'b92', status: 'COMPLETED', createdOff: [-1, 12, 10], completedOff: [0, 8, 55], assigned: true },
    { room: '103', bookingKey: 'b111', status: 'DIRTY', createdOff: [0, 8, 10], assigned: false },
    { room: '204', bookingKey: 'b112', status: 'CLEANING', createdOff: [0, 8, 20], assigned: true }
  ];
  const maintenance = [
    { room: '105', issueType: 'Air Conditioning', description: 'Air conditioner not working — unit blowing warm air.', priority: 'HIGH', status: 'OPEN', createdOff: [0, 9, 40], updatedOff: [0, 9, 40] },
    { room: '203', issueType: 'Electrical', description: 'Bathroom light flickering.', priority: 'LOW', status: 'RESOLVED', createdOff: [-6, 15, 2], updatedOff: [-5, 10, 30], resolvedOff: [-5, 10, 30] }
  ];
  return { bookings: B, housekeeping, maintenance };
}
