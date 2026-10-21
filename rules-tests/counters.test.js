// counters/main: increment-by-1 sequence numbers, abuse attempts.
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  makeEnv, P, fsOf, anonFs, seed, seedUsers, seedBooking, clearAll, bookingBatch,
  assertSucceeds, assertFails, doc, setDoc, getDoc, updateDoc, deleteDoc
} from './helpers.js';

let env;
before(async () => { env = await makeEnv('counters'); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await clearAll(env); await seedUsers(env); });
const ref = p => doc(fsOf(env, p), 'counters', 'main');
const put = data => seed(env, async fs => { await setDoc(doc(fs, 'counters', 'main'), data); });

describe('counters: reads', () => {
  beforeEach(async () => { await put({ booking: 5, hk: 7, req: 3 }); });
  it('active signed-in users can read the counters (needed inside booking transactions)', async () => {
    for (const p of [P.cust, P.mgr, P.admin]) await assertSucceeds(getDoc(ref(p)));
  });
  it('anonymous and disabled users cannot', async () => {
    await assertFails(getDoc(doc(anonFs(env), 'counters', 'main')));
    await assertFails(getDoc(ref(P.custOff)));
    await assertFails(getDoc(ref(P.mgrOff)));
    await assertFails(getDoc(ref(P.stranger)));
  });
});

describe('counters: customer', () => {
  beforeEach(async () => { await put({ booking: 5, hk: 7, req: 3 }); });
  it('a real booking works when hk/req counters already exist (unchanged keys are not re-validated)', async () => {
    await assertSucceeds(bookingBatch(fsOf(env, P.cust), { n: 5 }).batch.commit());
  });
  it('bumping the booking counter without creating the booking is denied (counter burning)', async () => {
    await assertFails(updateDoc(ref(P.cust), { booking: 6 }));
  });
  it('cannot jump, rewind, or keep the booking counter', async () => {
    for (const v of [7, 9999, 4, 0, -1, 5.5, '6']) await assertFails(updateDoc(ref(P.cust), { booking: v }));
  });
  it('cannot touch hk / req or add keys', async () => {
    await assertFails(updateDoc(ref(P.cust), { hk: 8 }));
    await assertFails(updateDoc(ref(P.cust), { req: 4 }));
    await assertFails(updateDoc(ref(P.cust), { notif: 1 }));
  });
  it('cannot delete or replace the counters doc', async () => {
    await assertFails(deleteDoc(ref(P.cust)));
    await assertFails(setDoc(ref(P.cust), { booking: 1 }));
  });
  it('cannot create the counters doc with a big starting value, nor with staff keys', async () => {
    await seed(env, async fs => { await deleteDoc(doc(fs, 'counters', 'main')); });
    await assertFails(setDoc(ref(P.cust), { booking: 500 }));
    await assertFails(setDoc(ref(P.cust), { booking: 2, hk: 2 }));
  });
  it('only the "main" doc exists', async () => {
    await assertFails(setDoc(doc(fsOf(env, P.cust), 'counters', 'other'), { booking: 2 }));
    await assertFails(setDoc(doc(fsOf(env, P.admin), 'counters', 'other'), { booking: 2 }));
  });
  it('anonymous / disabled customer cannot bump', async () => {
    await assertFails(updateDoc(doc(anonFs(env), 'counters', 'main'), { booking: 6 }));
    await assertFails(updateDoc(ref(P.custOff), { booking: 6 }));
  });
});

describe('counters: staff', () => {
  beforeEach(async () => { await put({ booking: 5, hk: 7, req: 3 }); });
  it('manager increments hk and req by exactly 1', async () => {
    await assertSucceeds(updateDoc(ref(P.mgr), { hk: 8 }));
    await assertSucceeds(updateDoc(ref(P.mgr), { req: 4 }));
  });
  it('manager cannot skip ahead, rewind, or touch booking without a booking', async () => {
    await assertFails(updateDoc(ref(P.mgr), { hk: 9 }));
    await assertFails(updateDoc(ref(P.mgr), { hk: 6 }));
    await assertFails(updateDoc(ref(P.mgr), { req: 1000 }));
    await assertFails(updateDoc(ref(P.mgr), { booking: 6 }));
  });
  it('manager walk-in booking bumps the booking counter together with the booking', async () => {
    await assertSucceeds(bookingBatch(fsOf(env, P.mgr), { n: 5, customerId: null, source: 'WALK_IN', createdBy: P.mgr.uid }).batch.commit());
  });
  it('disabled manager cannot bump anything', async () => { await assertFails(updateDoc(ref(P.mgrOff), { hk: 8 })); });
  it('admin may advance counters in bulk (sample loader) up to +200, never backwards', async () => {
    await assertSucceeds(updateDoc(ref(P.admin), { booking: 105, hk: 57, req: 23 }));
    await assertFails(updateDoc(ref(P.admin), { booking: 10 }));
    await assertFails(updateDoc(ref(P.admin), { hk: 1 }));
    await assertFails(updateDoc(ref(P.admin), { hk: 57 + 201 }));
  });
  it('admin cannot jump more than 200', async () => { await assertFails(updateDoc(ref(P.admin), { booking: 206 })); });
  it('nobody can delete the counters', async () => {
    for (const p of [P.mgr, P.admin]) await assertFails(deleteDoc(ref(p)));
  });
  it('admin creates the counters doc starting from missing (=1) -> 2 or a sample jump', async () => {
    await seed(env, async fs => { await deleteDoc(doc(fs, 'counters', 'main')); });
    await assertSucceeds(setDoc(ref(P.admin), { booking: 40, hk: 15, req: 5 }));
  });
});
