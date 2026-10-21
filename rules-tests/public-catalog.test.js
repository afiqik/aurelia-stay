// Public catalogue (settings, roomTypes, rooms), contact messages, and the default-deny rule.
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  makeEnv, P, fsOf, anonFs, seed, seedUsers, clearAll, nowIso,
  assertSucceeds, assertFails, doc, setDoc, getDoc, updateDoc, deleteDoc
} from './helpers.js';
import { getDocs, collection, addDoc } from 'firebase/firestore';

let env;
before(async () => { env = await makeEnv('catalog'); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await clearAll(env); await seedUsers(env); });
const W = (p, col, id, data, merge) => setDoc(doc(fsOf(env, p), col, id), data, merge ? { merge: true } : undefined);

describe('settings/main', () => {
  it('public read, even with an empty database and without signing in', async () => {
    await assertSucceeds(getDoc(doc(anonFs(env), 'settings', 'main')));
    await seed(env, async fs => { await setDoc(doc(fs, 'settings', 'main'), { hotelName: 'AURELIA STAY' }); });
    await assertSucceeds(getDoc(doc(anonFs(env), 'settings', 'main')));
  });
  it('admin writes (upsert with merge) valid settings', async () => {
    await assertSucceeds(W(P.admin, 'settings', 'main', { serviceFee: 12, hotelName: 'AURELIA STAY', adminTimeout: 30, managerTimeout: 20, allowOnline: true, allowWalkIn: false, allowCancel: true, auditLogging: true, checkInTime: '14:00' }, true));
  });
  it('anonymous, customer, manager cannot write settings (no price / fee / flag tampering)', async () => {
    await assertFails(setDoc(doc(anonFs(env), 'settings', 'main'), { serviceFee: 0 }));
    await assertFails(W(P.cust, 'settings', 'main', { serviceFee: 0 }, true));
    await assertFails(W(P.mgr, 'settings', 'main', { serviceFee: 0 }, true));
    await assertFails(W(P.mgr, 'settings', 'main', { allowOnline: false }, true));
    await assertFails(W(P.mgrOff, 'settings', 'main', { allowOnline: false }, true));
    await assertFails(W(P.custOff, 'settings', 'main', { allowOnline: false }, true));
  });
  it('manager cannot update an existing settings doc either', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'settings', 'main'), { serviceFee: 10 }); });
    await assertFails(updateDoc(doc(fsOf(env, P.mgr), 'settings', 'main'), { serviceFee: 0 }));
  });
  it('invalid values rejected even for the admin', async () => {
    for (const bad of [{ serviceFee: -1 }, { serviceFee: 501 }, { serviceFee: '10' }, { adminTimeout: 4 }, { adminTimeout: 241 }, { managerTimeout: 5.5 }, { allowOnline: 'yes' }, { allowCancel: 1 }, { hotelName: 'x'.repeat(300) }])
      await assertFails(W(P.admin, 'settings', 'main', bad, true));
  });
  it('only settings/main exists; settings can never be deleted', async () => {
    await assertFails(W(P.admin, 'settings', 'other', { serviceFee: 1 }));
    await seed(env, async fs => { await setDoc(doc(fs, 'settings', 'main'), { serviceFee: 10 }); });
    await assertFails(deleteDoc(doc(fsOf(env, P.admin), 'settings', 'main')));
  });
});

describe('roomTypes/{id}', () => {
  it('public read and list', async () => {
    await assertSucceeds(getDoc(doc(anonFs(env), 'roomTypes', '1')));
    await assertSucceeds(getDocs(collection(anonFs(env), 'roomTypes')));
  });
  it('admin updates price, description, active (merge upsert on an absent override doc)', async () => {
    await assertSucceeds(W(P.admin, 'roomTypes', '1', { price: 99, updatedAt: nowIso() }, true));
    await assertSucceeds(W(P.admin, 'roomTypes', '2', { description: 'A refreshed description for this room type.' }, true));
    await assertSucceeds(W(P.admin, 'roomTypes', '3', { active: false }, true));
  });
  it('manager cannot touch prices (create or update); neither can customers or anonymous', async () => {
    await assertFails(W(P.mgr, 'roomTypes', '1', { price: 1 }, true));
    await seed(env, async fs => { await setDoc(doc(fs, 'roomTypes', '1'), { price: 80 }); });
    await assertFails(updateDoc(doc(fsOf(env, P.mgr), 'roomTypes', '1'), { price: 1 }));
    await assertFails(updateDoc(doc(fsOf(env, P.cust), 'roomTypes', '1'), { price: 1 }));
    await assertFails(updateDoc(doc(anonFs(env), 'roomTypes', '1'), { price: 1 }));
    await assertFails(updateDoc(doc(fsOf(env, P.mgrOff), 'roomTypes', '1'), { price: 1 }));
  });
  it('invalid prices rejected for the admin (0, negative, fractional, huge, string)', async () => {
    for (const price of [0, -5, 80.5, 5001, '80']) await assertFails(W(P.admin, 'roomTypes', '1', { price }, true));
  });
  it('unknown type id and deletion rejected', async () => {
    await assertFails(W(P.admin, 'roomTypes', '5', { price: 100 }, true));
    await seed(env, async fs => { await setDoc(doc(fs, 'roomTypes', '1'), { price: 80 }); });
    await assertFails(deleteDoc(doc(fsOf(env, P.admin), 'roomTypes', '1')));
  });
});

describe('rooms/{number}', () => {
  it('public read and list', async () => {
    await assertSucceeds(getDoc(doc(anonFs(env), 'rooms', '101')));
    await assertSucceeds(getDocs(collection(anonFs(env), 'rooms')));
  });
  it('manager and admin write room status (upsert)', async () => {
    await assertSucceeds(W(P.mgr, 'rooms', '101', { status: 'CLEANING', updatedAt: nowIso() }, true));
    await assertSucceeds(W(P.admin, 'rooms', '402', { status: 'OUT_OF_SERVICE', updatedAt: nowIso() }, true));
  });
  it('customers, anonymous and disabled staff cannot write rooms', async () => {
    await assertFails(W(P.cust, 'rooms', '101', { status: 'AVAILABLE' }, true));
    await assertFails(setDoc(doc(anonFs(env), 'rooms', '101'), { status: 'AVAILABLE' }));
    await assertFails(W(P.mgrOff, 'rooms', '101', { status: 'AVAILABLE' }, true));
    await assertFails(W(P.custOff, 'rooms', '101', { status: 'AVAILABLE' }, true));
  });
  it('RESERVED is derived, never stored; unknown statuses and unknown rooms rejected', async () => {
    await assertFails(W(P.mgr, 'rooms', '101', { status: 'RESERVED' }, true));
    await assertFails(W(P.mgr, 'rooms', '101', { status: 'BROKEN' }, true));
    await assertFails(W(P.mgr, 'rooms', '999', { status: 'AVAILABLE' }, true));
    await assertFails(W(P.mgr, 'rooms', '501', { status: 'AVAILABLE' }, true));
  });
  it('rooms cannot be deleted', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'rooms', '101'), { status: 'AVAILABLE' }); });
    await assertFails(deleteDoc(doc(fsOf(env, P.admin), 'rooms', '101')));
    await assertFails(deleteDoc(doc(fsOf(env, P.mgr), 'rooms', '101')));
  });
});

describe('messages (public contact form)', () => {
  const msg = over => Object.assign({ name: 'Aisyah', email: 'aisyah@example.com', subject: 'Late check-in', message: 'Can I check in after 10pm?', at: nowIso() }, over || {});
  const add = (db, data) => addDoc(collection(db, 'messages'), data);

  it('anonymous visitor can send a valid message', async () => { await assertSucceeds(add(anonFs(env), msg())); });
  it('signed-in users (any role) can send too', async () => {
    for (const p of [P.cust, P.mgr, P.admin]) await assertSucceeds(add(fsOf(env, p), msg()));
  });
  it('oversized fields denied (name 101, subject 151, message 2001, at 41)', async () => {
    await assertFails(add(anonFs(env), msg({ name: 'x'.repeat(101) })));
    await assertFails(add(anonFs(env), msg({ subject: 'x'.repeat(151) })));
    await assertFails(add(anonFs(env), msg({ message: 'x'.repeat(2001) })));
    await assertFails(add(anonFs(env), msg({ at: 'x'.repeat(41) })));
    await assertSucceeds(add(anonFs(env), msg({ message: 'x'.repeat(2000), name: 'x'.repeat(100), subject: 'x'.repeat(150) })));
  });
  it('invalid e-mail / empty fields / wrong types denied', async () => {
    for (const bad of [{ email: 'not-an-email' }, { email: 'a@b' }, { email: '' }, { name: '' }, { subject: '' }, { message: '' }, { name: 5 }, { message: { x: 1 } }, { email: null }])
      await assertFails(add(anonFs(env), msg(bad)));
  });
  it('missing or extra fields denied (no field-stuffing / spam payloads)', async () => {
    const m = msg(); delete m.subject;
    await assertFails(add(anonFs(env), m));
    await assertFails(add(anonFs(env), msg({ isAdmin: true })));
    await assertFails(add(anonFs(env), msg({ attachment: 'x'.repeat(10) })));
  });
  it('only the admin can read messages (get + list)', async () => {
    const ref = await add(anonFs(env), msg());
    await assertSucceeds(getDoc(doc(fsOf(env, P.admin), 'messages', ref.id)));
    await assertSucceeds(getDocs(collection(fsOf(env, P.admin), 'messages')));
    for (const db of [anonFs(env), fsOf(env, P.cust), fsOf(env, P.mgr), fsOf(env, P.mgrOff)]) {
      await assertFails(getDoc(doc(db, 'messages', ref.id)));
      await assertFails(getDocs(collection(db, 'messages')));
    }
  });
  it('messages are immutable and cannot be deleted by anyone (even admin)', async () => {
    const ref = await add(anonFs(env), msg());
    for (const p of [P.cust, P.mgr, P.admin]) {
      await assertFails(updateDoc(doc(fsOf(env, p), 'messages', ref.id), { subject: 'edited' }));
      await assertFails(deleteDoc(doc(fsOf(env, p), 'messages', ref.id)));
    }
    await assertFails(deleteDoc(doc(anonFs(env), 'messages', ref.id)));
  });
});

describe('default deny', () => {
  it('unknown collections are closed to everyone, including admin', async () => {
    for (const col of ['secrets', 'admin', 'config', 'sessions', 'payments']) {
      for (const db of [anonFs(env), fsOf(env, P.cust), fsOf(env, P.mgr), fsOf(env, P.admin)]) {
        await assertFails(setDoc(doc(db, col, 'x'), { a: 1 }));
        await assertFails(getDoc(doc(db, col, 'x')));
        await assertFails(getDocs(collection(db, col)));
      }
    }
  });
  it('nested paths under allowed collections are closed (e.g. users/{uid}/private)', async () => {
    await assertFails(setDoc(doc(fsOf(env, P.cust), 'users', P.cust.uid, 'private', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(fsOf(env, P.admin), 'users', P.cust.uid, 'private', 'x')));
    await assertFails(setDoc(doc(fsOf(env, P.admin), 'bookings', 'b1', 'notes', 'x'), { a: 1 }));
  });
});
