// bookings/{id}: creation (pricing, ownership, counters, locks), reads, cancel/transition updates, deletes.
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  makeEnv, P, fsOf, anonFs, seed, seedUsers, seedBooking, clearAll, bookingBatch, bookingData, addDays, nowIso,
  assertSucceeds, assertFails, doc, setDoc, getDoc, updateDoc, deleteDoc
} from './helpers.js';
import { getDocs, collection, query, where, writeBatch } from 'firebase/firestore';

const ok = (p, o) => assertSucceeds(bookingBatch(fsOf(env, p), o).batch.commit());
const no = (p, o) => assertFails(bookingBatch(fsOf(env, p), o).batch.commit());
let env;
before(async () => { env = await makeEnv('bookings'); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await clearAll(env); await seedUsers(env); });

describe('bookings: customer creates an online booking', () => {
  it('valid 2-night booking (booking + counter + locks in one batch)', async () => { await ok(P.cust, {}); });
  it('works when the counters doc does not exist yet and when it exists', async () => {
    await ok(P.cust, { n: 1 });
    await ok(P.cust2, { n: 2, customerId: P.cust2.uid, createdBy: P.cust2.uid, roomId: 102 });
  });
  it('1-night, 3-night, 6-night and the maximum 14-night stay', async () => {
    await ok(P.cust, { n: 1, nights: 1, roomId: 101 });
    await ok(P.cust, { n: 2, nights: 3, roomId: 102, offset: 20 });
    await ok(P.cust, { n: 3, nights: 6, roomId: 201, typeId: 2, offset: 40 });
    await ok(P.cust, { n: 4, nights: 14, roomId: 301, typeId: 3, offset: 60 });
  });
  it('every room type at its static default price, up to its capacity', async () => {
    await ok(P.cust, { n: 1, roomId: 101, typeId: 1, guests: 1 });
    await ok(P.cust, { n: 2, roomId: 201, typeId: 2, guests: 2 });
    await ok(P.cust, { n: 3, roomId: 301, typeId: 3, guests: 2 });
    await ok(P.cust, { n: 4, roomId: 401, typeId: 4, guests: 4 });
  });
  it('typeId / roomId may be sent as strings (same lock ids)', async () => {
    await ok(P.cust, { n: 1, roomId: '101', typeId: '1' });
  });

  // ---- tampering with money
  it('price below the room-type price is denied (RM1 / RM79 / 0 / negative)', async () => {
    for (const roomPrice of [1, 79, 0, -80]) await no(P.cust, { roomPrice });
  });
  it('price above the room-type price is denied too (must be exact)', async () => { await no(P.cust, { roomPrice: 81 }); });
  it('wrong total / subtotal / service fee denied', async () => {
    await no(P.cust, { over: { total: 100 } });
    await no(P.cust, { over: { subtotal: 100 } });
    await no(P.cust, { serviceFee: 0 });
    await no(P.cust, { serviceFee: 11 });
    await no(P.cust, { over: { total: 160 } }); // forgot the fee
  });
  it('cheap room-type trick: room 401 (Family, RM95) declared as typeId 1 (RM80) is denied', async () => {
    await no(P.cust, { roomId: 401, typeId: 1, guests: 1 });
  });
  it('typeId must match the room of the lock (type 2 label on a type 1 room)', async () => { await no(P.cust, { roomId: 101, typeId: 2 }); });
  it('nights field must match the dates', async () => {
    await no(P.cust, { over: { nights: 1, subtotal: 80, total: 90 } });
    await no(P.cust, { over: { nights: 3, subtotal: 240, total: 250 } });
  });
  it('admin price override is honoured: old price denied, new price allowed', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'roomTypes', '1'), { price: 100, description: 'Updated description', active: true, updatedAt: nowIso() }); });
    await no(P.cust, { n: 1, roomPrice: 80 });
    await ok(P.cust, { n: 1, roomPrice: 100 });
  });
  it('settings override service fee: old fee denied, new fee allowed', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'settings', 'main'), { serviceFee: 15 }); });
    await no(P.cust, { n: 1, serviceFee: 10 });
    await ok(P.cust, { n: 1, serviceFee: 15 });
  });
  it('a roomTypes doc that only overrides the description keeps the static price', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'roomTypes', '2'), { description: 'Only description changed here', updatedAt: nowIso() }); });
    await ok(P.cust, { n: 1, roomId: 201, typeId: 2, guests: 1 });
  });
  it('inactive room type cannot be booked', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'roomTypes', '1'), { active: false }); });
    await no(P.cust, {});
  });
  it('allowOnline=false blocks online bookings', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'settings', 'main'), { allowOnline: false }); });
    await no(P.cust, {});
  });

  // ---- identity / ownership
  it('anonymous cannot create a booking', async () => {
    await assertFails(bookingBatch(anonFs(env), {}).batch.commit());
  });
  it('customer cannot create a booking for another customer id', async () => { await no(P.cust, { customerId: P.cust2.uid }); });
  it('customer cannot book as guest (customerId null) or forge createdBy', async () => {
    await no(P.cust, { customerId: null });
    await no(P.cust, { createdBy: P.cust2.uid });
  });
  it('customer cannot create WALK_IN / non-CONFIRMED / sample bookings', async () => {
    await no(P.cust, { source: 'WALK_IN' });
    await no(P.cust, { over: { status: 'CHECKED_IN' } });
    await no(P.cust, { over: { status: 'COMPLETED' } });
    await no(P.cust, { over: { sample: true } });
  });
  it('lifecycle fields must be empty on creation (no pre-set check-in / cancellation)', async () => {
    await no(P.cust, { over: { checkedInAt: nowIso() } });
    await no(P.cust, { over: { cancelledAt: nowIso(), cancelledBy: P.cust.uid } });
    await no(P.cust, { over: { cancellationReason: 'x' } });
  });
  it('disabled customer cannot book', async () => {
    await no(P.custOff, { customerId: P.custOff.uid, createdBy: P.custOff.uid });
  });
  it('signed-in user without any profile cannot book', async () => {
    await no(P.stranger, { customerId: P.stranger.uid, createdBy: P.stranger.uid });
  });
  it('unverified e-mail token cannot book', async () => {
    await assertFails(bookingBatch(fsOf(env, P.cust, { email_verified: false }), {}).batch.commit());
  });

  // ---- shape / validation
  it('guest count above room capacity or below 1 denied', async () => {
    await no(P.cust, { roomId: 101, typeId: 1, guests: 2 });
    await no(P.cust, { roomId: 201, typeId: 2, guests: 3 });
    await no(P.cust, { roomId: 401, typeId: 4, guests: 5 });
    await no(P.cust, { guests: 0 });
    await no(P.cust, { guests: 1.5 });
  });
  it('invalid / reversed / malformed dates denied', async () => {
    await no(P.cust, { checkIn: addDays(12), checkOut: addDays(10), over: { nights: 2 } });
    await no(P.cust, { checkIn: addDays(10), checkOut: addDays(10), over: { nights: 0, subtotal: 0, total: 10 } });
    await no(P.cust, { over: { checkIn: '2026-1-5' } });
    await no(P.cust, { over: { checkOut: 'tomorrow' } });
  });
  it('past check-in denied; today and tomorrow allowed', async () => {
    await no(P.cust, { offset: -5 });
    await ok(P.cust, { n: 1, offset: 0 });
    await ok(P.cust, { n: 2, offset: 1, roomId: 102 });
  });
  it('stays longer than 14 nights denied (Firestore 20-access-call batch limit, see maxNights() in the rules)', async () => {
    await no(P.cust, { nights: 15, roomId: 301, typeId: 3 });
    await no(P.cust, { nights: 30, roomId: 301, typeId: 3 });
    await no(P.cust, { nights: 31 });
  });
  it('unknown room number denied', async () => { await no(P.cust, { roomId: 999, typeId: 1 }); });
  it('unknown extra fields denied', async () => { await no(P.cust, { over: { discount: 50 } }); });
  it('missing required field denied (price, customer, dates, status, creator)', async () => {
    for (const k of ['roomPrice', 'customerId', 'checkIn', 'status', 'createdBy', 'total', 'guestName']) await no(P.cust, { omit: [k] });
  });
  it('oversized guest name or note denied', async () => {
    await no(P.cust, { over: { guestName: 'x'.repeat(200) } });
    await no(P.cust, { over: { payment: 'x'.repeat(200) } });
    await no(P.cust, { over: { guestName: '' } });
  });
  it('the id field, when present, must equal the doc id', async () => {
    await no(P.cust, { over: { id: 'b777' } });
    await ok(P.cust, { n: 1, over: { id: 'b1' } });
  });

  // ---- counter binding (id squatting / counter abuse)
  it('booking id must be b<counter> (cannot squat an arbitrary id)', async () => {
    await no(P.cust, { n: 1, id: 'b999' });
    await ok(P.cust, { n: 1 });
    await no(P.cust, { n: 2, id: 'b50' });
  });
  it('booking without bumping the counter is denied', async () => { await no(P.cust, { noCounter: true }); });
  it('counter bump by more than 1 is denied', async () => { await no(P.cust, { counterTo: 6 }); });
  it('ref must match the counter number', async () => {
    await no(P.cust, { over: { ref: 'AUR-2026-00099' } });
    await no(P.cust, { over: { ref: 'AUR-2026-ABCDE' } });
  });
  it('re-using an existing booking id (overwrite attempt) is denied', async () => {
    await ok(P.cust, { n: 1 });
    await no(P.cust2, { n: 1, customerId: P.cust2.uid, createdBy: P.cust2.uid, roomId: 102 });
    await no(P.cust, { n: 1, counterTo: 2, roomId: 102 });
  });

  // ---- lock completeness
  it('a booking without its roomNights locks is denied', async () => { await no(P.cust, { locks: [] }); });
  it('a gap anywhere in the lock chain is denied (first, middle, penultimate, last night)', async () => {
    await no(P.cust, { nights: 4, locks: [1, 2, 3] });
    await no(P.cust, { nights: 4, locks: [0, 1, 2] });
    await no(P.cust, { nights: 4, locks: [0, 2, 3] });
    await no(P.cust, { nights: 4, locks: [0, 1, 3] });
    await no(P.cust, { nights: 14, roomId: 301, typeId: 3, locks: Array.from({ length: 14 }, (_, i) => i).filter(i => i !== 7) });
    await no(P.cust, { nights: 14, roomId: 301, typeId: 3, locks: Array.from({ length: 13 }, (_, i) => i) });
  });
  it('locks pointing at another (non-existent) booking id are denied', async () => { await no(P.cust, { lockBooking: 'b999' }); });
  it('locks for a different room than the booking are denied', async () => { await no(P.cust, { lockRoom: 102 }); });
});

describe('bookings: walk-in (manager) and sample data (admin)', () => {
  const walk = o => Object.assign({ customerId: null, source: 'WALK_IN', createdBy: P.mgr.uid, over: { guestName: 'Walk In Guest' } }, o || {});
  it('manager creates a walk-in booking (customerId null)', async () => { await ok(P.mgr, walk()); });
  it('walk-in prices are validated like online ones', async () => {
    await no(P.mgr, walk({ roomPrice: 10 }));
    await no(P.mgr, walk({ serviceFee: 0 }));
  });
  it('walk-in cannot be attached to a customer id or pose as ONLINE', async () => {
    await no(P.mgr, walk({ customerId: P.cust.uid }));
    await no(P.mgr, walk({ source: 'ONLINE' }));
    await no(P.mgr, walk({ createdBy: P.mgr2.uid }));
  });
  it('walk-in obeys allowWalkIn', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'settings', 'main'), { allowWalkIn: false }); });
    await no(P.mgr, walk());
  });
  it('walk-in needs locks and counter just like online bookings', async () => {
    await no(P.mgr, walk({ locks: [] }));
    await no(P.mgr, walk({ noCounter: true }));
  });
  it('disabled manager, customer and admin cannot create walk-in bookings', async () => {
    await no(P.mgrOff, walk({ createdBy: P.mgrOff.uid }));
    await no(P.cust, walk({ createdBy: P.cust.uid }));
    await no(P.admin, walk({ createdBy: P.admin.uid }));
  });
  it('admin cannot create an ordinary booking (online, guest or walk-in)', async () => {
    await no(P.admin, { customerId: P.admin.uid, createdBy: P.admin.uid });
    await no(P.admin, { customerId: null, createdBy: P.admin.uid });
  });

  const sample = o => Object.assign({ customerId: null, createdBy: P.admin.uid, noCounter: true, locks: [], over: { sample: true, guestName: 'Sample Guest' } }, o || {});
  it('admin may create sample:true bookings (any lifecycle status, no locks required)', async () => {
    await ok(P.admin, sample({ n: 1 }));
    await ok(P.admin, sample({ n: 2, roomId: 102, over: { sample: true, status: 'COMPLETED', guestName: 'S' }, offset: -20 }));
    await ok(P.admin, sample({ n: 3, roomId: 201, typeId: 2, over: { sample: true, status: 'CANCELLED', guestName: 'S' } }));
  });
  it('admin sample booking must be customerless and honestly flagged', async () => {
    await no(P.admin, sample({ customerId: P.cust.uid }));
    await no(P.admin, sample({ over: { sample: false, guestName: 'x' } }));
    await no(P.admin, sample({ over: { guestName: 'x' }, createdBy: P.mgr.uid }));
    await no(P.admin, sample({ over: { sample: true, status: 'GHOST', guestName: 'x' } }));
  });
  it('only the admin may create sample bookings (manager / customer cannot)', async () => {
    await no(P.mgr, sample({ createdBy: P.mgr.uid }));
    await no(P.cust, sample({ customerId: null, createdBy: P.cust.uid }));
  });
  it('admin sample bookings must still be arithmetically consistent', async () => {
    await no(P.admin, sample({ over: { sample: true, total: 1, guestName: 'x' } }));
  });
});

describe('bookings: reads', () => {
  beforeEach(async () => { await seedBooking(env, { n: 1 }); await seedBooking(env, { n: 2, customerId: P.cust2.uid, createdBy: P.cust2.uid, roomId: 102 }); await seedBooking(env, { n: 3, customerId: null, createdBy: P.mgr.uid, source: 'WALK_IN', roomId: 201, typeId: 2 }); });
  const get = (p, id) => getDoc(doc(fsOf(env, p), 'bookings', id));
  it('owner reads own booking; another customer cannot', async () => {
    await assertSucceeds(get(P.cust, 'b1'));
    await assertFails(get(P.cust2, 'b1'));
    await assertFails(get(P.cust, 'b2'));
  });
  it('anonymous cannot read bookings', async () => { await assertFails(getDoc(doc(anonFs(env), 'bookings', 'b1'))); });
  it('customers cannot read walk-in (customerless) bookings', async () => { await assertFails(get(P.cust, 'b3')); });
  it('manager and admin read every booking', async () => {
    for (const p of [P.mgr, P.mgr2, P.admin]) for (const id of ['b1', 'b2', 'b3']) await assertSucceeds(get(p, id));
  });
  it('disabled staff / disabled customer cannot read bookings', async () => {
    await assertFails(get(P.mgrOff, 'b1'));
    await seed(env, async fs => { await setDoc(doc(fs, 'bookings', 'b9'), bookingData({ n: 9, customerId: P.custOff.uid, createdBy: P.custOff.uid })); });
    await assertFails(get(P.custOff, 'b9'));
  });
  it('customer query scoped to own customerId works; unscoped or other-id query is denied', async () => {
    await assertSucceeds(getDocs(query(collection(fsOf(env, P.cust), 'bookings'), where('customerId', '==', P.cust.uid))));
    await assertFails(getDocs(collection(fsOf(env, P.cust), 'bookings')));
    await assertFails(getDocs(query(collection(fsOf(env, P.cust), 'bookings'), where('customerId', '==', P.cust2.uid))));
    await assertFails(getDocs(query(collection(fsOf(env, P.cust), 'bookings'), where('customerId', '==', null))));
  });
  it('staff can list all bookings', async () => {
    await assertSucceeds(getDocs(collection(fsOf(env, P.mgr), 'bookings')));
    await assertSucceeds(getDocs(collection(fsOf(env, P.admin), 'bookings')));
  });
});

describe('bookings: customer cancel', () => {
  beforeEach(async () => { await seedBooking(env, { n: 1 }); });
  const upd = (p, data, id) => updateDoc(doc(fsOf(env, p), 'bookings', id || 'b1'), data);
  const cancel = (p, over) => upd(p, Object.assign({ status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: p.uid, cancellationReason: 'Change of plans' }, over || {}));

  it('owner cancels own CONFIRMED booking', async () => { await assertSucceeds(cancel(P.cust)); });
  it('owner cancels without a reason (null)', async () => { await assertSucceeds(cancel(P.cust, { cancellationReason: null })); });
  it('another customer cannot cancel it', async () => { await assertFails(cancel(P.cust2)); });
  it('anonymous cannot cancel', async () => { await assertFails(updateDoc(doc(anonFs(env), 'bookings', 'b1'), { status: 'CANCELLED', cancelledAt: 'x', cancelledBy: 'x' })); });
  it('cancelledBy must be the canceller', async () => { await assertFails(cancel(P.cust, { cancelledBy: P.mgr.uid })); });
  it('cancel cannot piggy-back price / date / room / owner edits', async () => {
    for (const extra of [{ total: 1 }, { roomPrice: 1 }, { checkIn: addDays(30) }, { roomId: 102 }, { customerId: P.cust2.uid }, { guests: 2 }, { sample: true }, { createdBy: 'x' }])
      await assertFails(cancel(P.cust, extra));
  });
  it('customer cannot move the booking to any other status', async () => {
    for (const status of ['CHECKED_IN', 'COMPLETED', 'CONFIRMED']) await assertFails(upd(P.cust, { status }));
    await assertFails(upd(P.cust, { status: 'CHECKED_IN', checkedInAt: nowIso() }));
  });
  it('customer cannot edit non-status fields at all', async () => {
    await assertFails(upd(P.cust, { guests: 1, total: 1 }));
    await assertFails(upd(P.cust, { guestName: 'Someone Else' }));
    await assertFails(upd(P.cust, { roomId: 102 }));
    await assertFails(upd(P.cust, { payment: 'Paid' }));
  });
  it('cannot cancel a booking that is no longer CONFIRMED', async () => {
    await seedBooking(env, { n: 2, roomId: 102 }); await seed(env, async fs => { await updateDoc(doc(fs, 'bookings', 'b2'), { status: 'CHECKED_IN' }); });
    await assertFails(upd(P.cust, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.cust.uid }, 'b2'));
    await seed(env, async fs => { await updateDoc(doc(fs, 'bookings', 'b1'), { status: 'CANCELLED' }); });
    await assertFails(cancel(P.cust));
  });
  it('allowCancel=false blocks customer cancellation (staff still can)', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'settings', 'main'), { allowCancel: false }); });
    await assertFails(cancel(P.cust));
    await assertSucceeds(cancel(P.mgr));
  });
  it('disabled customer cannot cancel', async () => {
    await seedBooking(env, { n: 5, roomId: 202, typeId: 2, customerId: P.custOff.uid, createdBy: P.custOff.uid });
    await assertFails(upd(P.custOff, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.custOff.uid }, 'b5'));
  });
  it('overlong cancellation reason denied', async () => { await assertFails(cancel(P.cust, { cancellationReason: 'x'.repeat(600) })); });
});

describe('bookings: staff lifecycle', () => {
  beforeEach(async () => { await seedBooking(env, { n: 1 }); });
  const upd = (p, data, id) => updateDoc(doc(fsOf(env, p), 'bookings', id || 'b1'), data);
  const setStatus = (id, status) => seed(env, async fs => { await updateDoc(doc(fs, 'bookings', id), { status }); });

  it('manager: check-in then check-out', async () => {
    await assertSucceeds(upd(P.mgr, { status: 'CHECKED_IN', checkedInAt: nowIso() }));
    await setStatus('b1', 'CHECKED_IN');
    await assertSucceeds(upd(P.mgr, { status: 'COMPLETED', checkedOutAt: nowIso() }));
  });
  it('admin may check in and out too', async () => {
    await assertSucceeds(upd(P.admin, { status: 'CHECKED_IN', checkedInAt: nowIso() }));
  });
  it('manager / admin cancel a CONFIRMED booking (cancelledBy = self)', async () => {
    await assertSucceeds(upd(P.mgr, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.mgr.uid, cancellationReason: 'Overbooked' }));
    await seedBooking(env, { n: 2, roomId: 102 });
    await assertSucceeds(upd(P.admin, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.admin.uid, cancellationReason: 'Admin override' }, 'b2'));
  });
  it('staff cannot impersonate another canceller', async () => {
    await assertFails(upd(P.mgr, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.admin.uid }));
  });
  it('illegal transitions are denied (skip check-in, reopen, double check-in, cancel a stay in progress)', async () => {
    await assertFails(upd(P.mgr, { status: 'COMPLETED', checkedOutAt: nowIso() })); // CONFIRMED -> COMPLETED
    await setStatus('b1', 'CHECKED_IN');
    await assertFails(upd(P.mgr, { status: 'CHECKED_IN', checkedInAt: nowIso() })); // CHECKED_IN -> CHECKED_IN
    await assertFails(upd(P.mgr, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.mgr.uid })); // cancel in-progress
    await assertFails(upd(P.mgr, { status: 'CONFIRMED' }));
    await setStatus('b1', 'COMPLETED');
    await assertFails(upd(P.mgr, { status: 'CHECKED_IN', checkedInAt: nowIso() }));
    await setStatus('b1', 'CANCELLED');
    await assertFails(upd(P.mgr, { status: 'CONFIRMED' }));
    await assertFails(upd(P.admin, { status: 'CHECKED_IN', checkedInAt: nowIso() }));
  });
  it('staff cannot tamper with money, dates, owner or flags during a transition', async () => {
    for (const extra of [{ total: 1 }, { roomPrice: 1 }, { checkOut: addDays(40) }, { customerId: P.cust2.uid }, { source: 'WALK_IN' }, { sample: true }, { nights: 9 }])
      await assertFails(upd(P.mgr, Object.assign({ status: 'CHECKED_IN', checkedInAt: nowIso() }, extra)));
    await assertFails(upd(P.mgr, { total: 1 }));
    await assertFails(upd(P.admin, { roomPrice: 1 }));
  });
  it('manager reassigns room within the same type, not to another type or unknown room', async () => {
    await assertSucceeds(upd(P.mgr, { roomId: 102 }));
    await assertFails(upd(P.mgr, { roomId: 201 }));
    await assertFails(upd(P.mgr, { roomId: 999 }));
  });
  it('no reassignment after check-in', async () => {
    await setStatus('b1', 'CHECKED_IN');
    await assertFails(upd(P.mgr, { roomId: 102 }));
  });
  it('disabled manager and customers cannot run lifecycle actions', async () => {
    await assertFails(upd(P.mgrOff, { status: 'CHECKED_IN', checkedInAt: nowIso() }));
    await assertFails(upd(P.cust2, { status: 'CHECKED_IN', checkedInAt: nowIso() }));
    await assertFails(upd(P.cust, { status: 'CHECKED_IN', checkedInAt: nowIso() }));
  });
});

describe('bookings: deletes', () => {
  beforeEach(async () => {
    await seedBooking(env, { n: 1 });
    await seed(env, async fs => { await setDoc(doc(fs, 'bookings', 'b2'), bookingData({ n: 2, customerId: null, createdBy: P.admin.uid, over: { sample: true } })); });
  });
  const del = (p, id) => deleteDoc(doc(fsOf(env, p), 'bookings', id));
  it('real bookings can never be hard-deleted', async () => {
    for (const p of [P.cust, P.cust2, P.mgr, P.admin]) await assertFails(del(p, 'b1'));
  });
  it('admin may delete sample bookings; nobody else may', async () => {
    await assertFails(del(P.mgr, 'b2'));
    await assertFails(del(P.cust, 'b2'));
    await assertSucceeds(del(P.admin, 'b2'));
  });
});
