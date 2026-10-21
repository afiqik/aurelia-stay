// roomNights/{roomId}_{date}: the double-booking lock and public availability index.
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  makeEnv, P, fsOf, anonFs, seed, seedUsers, seedBooking, clearAll, bookingBatch, bookingData, addDays, nightsOf, nowIso,
  assertSucceeds, assertFails, doc, setDoc, getDoc, updateDoc, deleteDoc
} from './helpers.js';
import { getDocs, collection, query, where, writeBatch } from 'firebase/firestore';

let env;
before(async () => { env = await makeEnv('roomnights'); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await clearAll(env); await seedUsers(env); });

const ok = (p, o) => assertSucceeds(bookingBatch(fsOf(env, p), o).batch.commit());
const no = (p, o) => assertFails(bookingBatch(fsOf(env, p), o).batch.commit());
const lockRef = (p, room, date) => doc(fsOf(env, p), 'roomNights', room + '_' + date);
const lock = (room, date, bookingId, typeId) => ({ roomId: room, date, bookingId, typeId: typeId || 1 });
const other = { n: 2, customerId: P.cust2.uid, createdBy: P.cust2.uid };

describe('roomNights: public availability index', () => {
  it('anyone (even anonymous) can read locks, get and query by date', async () => {
    await seedBooking(env, { n: 1 });
    const d = addDays(10);
    await assertSucceeds(getDoc(doc(anonFs(env), 'roomNights', '101_' + d)));
    await assertSucceeds(getDocs(query(collection(anonFs(env), 'roomNights'), where('date', '>=', addDays(0)))));
  });
  it('locks carry no personal data (only roomId, date, bookingId, typeId are allowed)', async () => {
    await seedBooking(env, { n: 1, noLocks: true });
    const d = addDays(10);
    const fs = fsOf(env, P.cust);
    const wb = writeBatch(fs);
    wb.set(doc(fs, 'roomNights', '101_' + d), { ...lock(101, d, 'b1'), guestName: 'Cust One' });
    await assertFails(wb.commit());
  });
});

describe('roomNights: double-booking attempts', () => {
  it('second customer booking the exact same room and dates is denied', async () => {
    await ok(P.cust, { n: 1 });
    await no(P.cust2, { ...other, n: 2 });
  });
  it('overlap by a single night (either side) is denied', async () => {
    await ok(P.cust, { n: 1, offset: 10, nights: 3 }); // nights 10,11,12
    await no(P.cust2, { ...other, offset: 12, nights: 2 }); // 12,13
    await no(P.cust2, { ...other, offset: 8, nights: 3 }); // 8,9,10
    await no(P.cust2, { ...other, offset: 11, nights: 1 }); // inside
    await no(P.cust2, { ...other, offset: 5, nights: 20 }); // surrounds
  });
  it('back-to-back stays on the same room are fine (check-out day = next check-in day)', async () => {
    await ok(P.cust, { n: 1, offset: 10, nights: 2 });
    await ok(P.cust2, { ...other, offset: 12, nights: 2 });
  });
  it('same dates on a different room are fine', async () => {
    await ok(P.cust, { n: 1 });
    await ok(P.cust2, { ...other, roomId: 102 });
  });
  it('the same customer cannot double-book a room either', async () => {
    await ok(P.cust, { n: 1 });
    await no(P.cust, { n: 2 });
  });
  it('manager walk-in cannot take a night that is already locked', async () => {
    await ok(P.cust, { n: 1 });
    await no(P.mgr, { n: 2, customerId: null, source: 'WALK_IN', createdBy: P.mgr.uid });
  });
  it('locks sent as strings vs numbers collide on the same id (no format loophole)', async () => {
    await ok(P.cust, { n: 1, roomId: 101 });
    await no(P.cust2, { ...other, roomId: '101', typeId: '1' });
  });
  it('attacker cannot skip locking by booking an unlocked-looking id: lock docs are create-only', async () => {
    await ok(P.cust, { n: 1 });
    const d = addDays(10);
    // try to re-point the existing lock at the attacker's own booking
    await seedBooking(env, { n: 5, ...other, roomId: 102, noLocks: true });
    await assertFails(setDoc(lockRef(P.cust2, 101, d), lock(101, d, 'b5')));
    await assertFails(updateDoc(lockRef(P.cust2, 101, d), { bookingId: 'b5' }));
    await assertFails(updateDoc(lockRef(P.cust, 101, d), { bookingId: 'b1' }));
  });
  it('after the owner cancels (locks released) the same room can be booked again', async () => {
    await ok(P.cust, { n: 1 });
    const fs = fsOf(env, P.cust);
    const cancel = writeBatch(fs);
    cancel.update(doc(fs, 'bookings', 'b1'), { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.cust.uid, cancellationReason: null });
    nightsOf(addDays(10), addDays(12)).forEach(d => cancel.delete(doc(fs, 'roomNights', '101_' + d)));
    await assertSucceeds(cancel.commit());
    await ok(P.cust2, { ...other });
  });
});

describe('roomNights: lock creation validation', () => {
  beforeEach(async () => { await seedBooking(env, { n: 1, noLocks: true }); });
  const d0 = () => addDays(10);
  const put = (p, id, data) => assertFails(setDoc(doc(fsOf(env, p), 'roomNights', id), data));

  it('standalone lock for own booking, night inside the stay, first night', async () => {
    await assertSucceeds(setDoc(lockRef(P.cust, 101, d0()), lock(101, d0(), 'b1')));
  });
  it('a later night needs the previous night (chain) - cannot create night 2 alone', async () => {
    await put(P.cust, '101_' + addDays(11), lock(101, addDays(11), 'b1'));
  });
  it('locks for a booking that does not exist are denied', async () => { await put(P.cust, '101_' + d0(), lock(101, d0(), 'b404')); });
  it('customer cannot create locks for someone else\'s booking (blocking / hijacking)', async () => {
    await put(P.cust2, '101_' + d0(), lock(101, d0(), 'b1'));
  });
  it('anonymous cannot create locks', async () => {
    await assertFails(setDoc(doc(anonFs(env), 'roomNights', '101_' + d0()), lock(101, d0(), 'b1')));
  });
  it('lock outside the booked nights is denied (check-out night, day before, far away)', async () => {
    await put(P.cust, '101_' + addDays(12), lock(101, addDays(12), 'b1'));
    await put(P.cust, '101_' + addDays(9), lock(101, addDays(9), 'b1'));
    await put(P.cust, '101_' + addDays(40), lock(101, addDays(40), 'b1'));
  });
  it('lock for a different room or type than the booking is denied', async () => {
    await put(P.cust, '102_' + d0(), lock(102, d0(), 'b1'));
    await put(P.cust, '101_' + d0(), lock(101, d0(), 'b1', 2));
  });
  it('doc id must equal roomId_date', async () => {
    await put(P.cust, '101_' + addDays(11), lock(101, d0(), 'b1'));
    await put(P.cust, 'whatever', lock(101, d0(), 'b1'));
    await put(P.cust, '101_' + d0() + 'x', lock(101, d0() + 'x', 'b1'));
  });
  it('unknown / extra fields denied', async () => {
    await put(P.cust, '101_' + d0(), { ...lock(101, d0(), 'b1'), note: 'x' });
    await put(P.cust, '101_' + d0(), { roomId: 101, date: d0(), bookingId: 'b1' });
  });
  it('cannot create a lock for a booking that is not CONFIRMED', async () => {
    await seed(env, async fs => { await updateDoc(doc(fs, 'bookings', 'b1'), { status: 'CANCELLED' }); });
    await put(P.cust, '101_' + d0(), lock(101, d0(), 'b1'));
  });
  it('disabled customer cannot create locks', async () => {
    await seedBooking(env, { n: 6, roomId: 202, typeId: 2, customerId: P.custOff.uid, createdBy: P.custOff.uid, noLocks: true });
    const d = addDays(10);
    await put(P.custOff, '202_' + d, lock(202, d, 'b6', 2));
  });
  it('admin cannot create locks for a normal booking; manager can (walk-in / reassign tooling)', async () => {
    await put(P.admin, '101_' + d0(), lock(101, d0(), 'b1'));
    await assertSucceeds(setDoc(lockRef(P.mgr, 101, d0()), lock(101, d0(), 'b1')));
  });
  it('admin may create locks for sample bookings only', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'bookings', 'b7'), bookingData({ n: 7, customerId: null, createdBy: P.admin.uid, roomId: 203, typeId: 2, over: { sample: true } })); });
    await assertSucceeds(setDoc(lockRef(P.admin, 203, d0()), lock(203, d0(), 'b7', 2)));
  });
});

describe('roomNights: updates and deletes', () => {
  beforeEach(async () => { await seedBooking(env, { n: 1 }); });
  const d = () => addDays(10);

  it('nobody can update a lock (create-only): customer, manager, admin', async () => {
    for (const p of [P.cust, P.cust2, P.mgr, P.admin]) await assertFails(updateDoc(lockRef(p, 101, d()), { bookingId: 'b9' }));
  });
  it('owner cannot delete the lock of a still-CONFIRMED booking (would open a double-booking)', async () => {
    await assertFails(deleteDoc(lockRef(P.cust, 101, d())));
  });
  it('another customer / anonymous cannot delete locks', async () => {
    await assertFails(deleteDoc(lockRef(P.cust2, 101, d())));
    await assertFails(deleteDoc(doc(anonFs(env), 'roomNights', '101_' + d())));
  });
  it('owner releases locks while cancelling in the same batch (status CANCELLED after the batch)', async () => {
    const fs = fsOf(env, P.cust);
    const wb = writeBatch(fs);
    wb.update(doc(fs, 'bookings', 'b1'), { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.cust.uid, cancellationReason: null });
    nightsOf(addDays(10), addDays(12)).forEach(x => wb.delete(doc(fs, 'roomNights', '101_' + x)));
    await assertSucceeds(wb.commit());
  });
  it('owner may delete leftover locks once the booking is already CANCELLED', async () => {
    await seed(env, async fs => { await updateDoc(doc(fs, 'bookings', 'b1'), { status: 'CANCELLED' }); });
    await assertSucceeds(deleteDoc(lockRef(P.cust, 101, d())));
  });
  it('batch that cancels someone else\'s booking and deletes its locks is denied', async () => {
    const fs = fsOf(env, P.cust2);
    const wb = writeBatch(fs);
    wb.update(doc(fs, 'bookings', 'b1'), { status: 'CANCELLED', cancelledAt: nowIso(), cancelledBy: P.cust2.uid });
    wb.delete(doc(fs, 'roomNights', '101_' + d()));
    await assertFails(wb.commit());
  });
  it('manager and admin may delete locks (check-out / clean-up)', async () => {
    await assertSucceeds(deleteDoc(lockRef(P.mgr, 101, d())));
    await assertSucceeds(deleteDoc(lockRef(P.admin, 101, addDays(11))));
  });
  it('disabled manager cannot delete locks', async () => { await assertFails(deleteDoc(lockRef(P.mgrOff, 101, d()))); });
  it('manager reassigns a room: booking roomId update + old locks deleted + new locks created in one batch', async () => {
    const fs = fsOf(env, P.mgr);
    const wb = writeBatch(fs);
    wb.update(doc(fs, 'bookings', 'b1'), { roomId: 102 });
    nightsOf(addDays(10), addDays(12)).forEach(x => { wb.delete(doc(fs, 'roomNights', '101_' + x)); wb.set(doc(fs, 'roomNights', '102_' + x), lock(102, x, 'b1')); });
    await assertSucceeds(wb.commit());
  });
  it('reassignment onto an already-locked night is denied (no double booking via reassign)', async () => {
    await seedBooking(env, { n: 2, ...other, roomId: 102 });
    const fs = fsOf(env, P.mgr);
    const wb = writeBatch(fs);
    wb.update(doc(fs, 'bookings', 'b1'), { roomId: 102 });
    nightsOf(addDays(10), addDays(12)).forEach(x => { wb.delete(doc(fs, 'roomNights', '101_' + x)); wb.set(doc(fs, 'roomNights', '102_' + x), lock(102, x, 'b1')); });
    await assertFails(wb.commit());
  });
});
