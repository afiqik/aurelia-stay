// housekeeping, maintenance (staff only) and auditLogs (append-only).
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  makeEnv, P, fsOf, anonFs, seed, seedUsers, clearAll, nowIso, bookingBatch,
  assertSucceeds, assertFails, doc, setDoc, getDoc, updateDoc, deleteDoc
} from './helpers.js';
import { getDocs, collection, addDoc, query, orderBy, limit, writeBatch } from 'firebase/firestore';

let env;
before(async () => { env = await makeEnv('staffops'); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await clearAll(env); await seedUsers(env); });

const hk = over => Object.assign({ roomId: 101, bookingId: 'b1', status: 'DIRTY', createdAt: nowIso(), completedAt: null, assignedTo: null }, over || {});
const req = over => Object.assign({ roomId: 105, reportedBy: P.mgr.uid, issueType: 'Air Conditioning', description: 'Unit blowing warm air.', priority: 'HIGH', status: 'OPEN', createdAt: nowIso(), updatedAt: nowIso(), resolvedAt: null }, over || {});

describe('housekeeping', () => {
  it('manager and admin create, advance and read tasks', async () => {
    await assertSucceeds(setDoc(doc(fsOf(env, P.mgr), 'housekeeping', 'HK-0001'), hk()));
    await assertSucceeds(updateDoc(doc(fsOf(env, P.mgr), 'housekeeping', 'HK-0001'), { status: 'CLEANING', assignedTo: P.mgr.uid }));
    await assertSucceeds(setDoc(doc(fsOf(env, P.admin), 'housekeeping', 'HK-0002'), hk({ roomId: 102 })));
    await assertSucceeds(getDoc(doc(fsOf(env, P.mgr), 'housekeeping', 'HK-0001')));
    await assertSucceeds(getDocs(collection(fsOf(env, P.admin), 'housekeeping')));
  });
  it('customers, anonymous, disabled staff: no read, no write', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'housekeeping', 'HK-0001'), hk()); });
    for (const db of [anonFs(env), fsOf(env, P.cust), fsOf(env, P.custOff), fsOf(env, P.mgrOff), fsOf(env, P.stranger)]) {
      await assertFails(getDoc(doc(db, 'housekeeping', 'HK-0001')));
      await assertFails(getDocs(collection(db, 'housekeeping')));
      await assertFails(setDoc(doc(db, 'housekeeping', 'HK-0009'), hk()));
      await assertFails(updateDoc(doc(db, 'housekeeping', 'HK-0001'), { status: 'COMPLETED' }));
    }
  });
  it('unknown status rejected', async () => { await assertFails(setDoc(doc(fsOf(env, P.mgr), 'housekeeping', 'HK-0001'), hk({ status: 'WHATEVER' }))); });
  it('deletes: only admin, only sample docs', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'housekeeping', 'HK-0001'), hk()); await setDoc(doc(fs, 'housekeeping', 'HK-0002'), hk({ sample: true })); });
    await assertFails(deleteDoc(doc(fsOf(env, P.mgr), 'housekeeping', 'HK-0002')));
    await assertFails(deleteDoc(doc(fsOf(env, P.admin), 'housekeeping', 'HK-0001')));
    await assertSucceeds(deleteDoc(doc(fsOf(env, P.admin), 'housekeeping', 'HK-0002')));
  });
});

describe('maintenance', () => {
  it('manager and admin report, advance and read requests', async () => {
    await assertSucceeds(setDoc(doc(fsOf(env, P.mgr), 'maintenance', 'REQ-0001'), req()));
    await assertSucceeds(updateDoc(doc(fsOf(env, P.mgr), 'maintenance', 'REQ-0001'), { status: 'IN_PROGRESS', updatedAt: nowIso() }));
    await assertSucceeds(setDoc(doc(fsOf(env, P.admin), 'maintenance', 'REQ-0002'), req({ reportedBy: P.admin.uid })));
    await assertSucceeds(getDocs(collection(fsOf(env, P.mgr), 'maintenance')));
  });
  it('customers, anonymous, disabled staff: no read, no write', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'maintenance', 'REQ-0001'), req()); });
    for (const db of [anonFs(env), fsOf(env, P.cust), fsOf(env, P.custOff), fsOf(env, P.mgrOff), fsOf(env, P.stranger)]) {
      await assertFails(getDoc(doc(db, 'maintenance', 'REQ-0001')));
      await assertFails(getDocs(collection(db, 'maintenance')));
      await assertFails(setDoc(doc(db, 'maintenance', 'REQ-0009'), req()));
      await assertFails(updateDoc(doc(db, 'maintenance', 'REQ-0001'), { status: 'RESOLVED' }));
    }
  });
  it('unknown status rejected', async () => { await assertFails(setDoc(doc(fsOf(env, P.mgr), 'maintenance', 'REQ-0001'), req({ status: 'DONE' }))); });
  it('deletes: only admin, only sample docs', async () => {
    await seed(env, async fs => { await setDoc(doc(fs, 'maintenance', 'REQ-0001'), req()); await setDoc(doc(fs, 'maintenance', 'REQ-0002'), req({ sample: true })); });
    await assertFails(deleteDoc(doc(fsOf(env, P.mgr), 'maintenance', 'REQ-0002')));
    await assertFails(deleteDoc(doc(fsOf(env, P.admin), 'maintenance', 'REQ-0001')));
    await assertSucceeds(deleteDoc(doc(fsOf(env, P.admin), 'maintenance', 'REQ-0002')));
  });
});

describe('auditLogs', () => {
  const log = (p, over) => Object.assign({ at: nowIso(), actorId: p.uid, action: 'BOOKING_CREATED', entityType: 'booking', entityId: 'AUR-2026-00001', before: null, after: { status: 'CONFIRMED' }, reason: null, ip: '', userAgent: 'node-test' }, over || {});
  const add = (p, over) => addDoc(collection(fsOf(env, p), 'auditLogs'), log(p, over));

  it('customer appends own-action entries from the allowed customer action set', async () => {
    for (const action of ['LOGIN', 'LOGOUT', 'CUSTOMER_REGISTERED', 'UPDATE_PROFILE', 'BOOKING_CREATED', 'BOOKING_CANCELLED']) await assertSucceeds(add(P.cust, { action }));
  });
  it('customer cannot forge staff / admin actions in the audit trail', async () => {
    for (const action of ['USER_DISABLED', 'UPDATE_ROOM_TYPE_PRICE', 'ADMIN_BOOKING_OVERRIDE', 'UPDATE_SETTINGS', 'CREATE_MANAGER']) await assertFails(add(P.cust, { action }));
  });
  it('manager and admin may log any action', async () => {
    await assertSucceeds(add(P.mgr, { action: 'BOOKING_CHECKED_IN' }));
    await assertSucceeds(add(P.admin, { action: 'UPDATE_ROOM_TYPE_PRICE', entityType: 'room_type', before: { price: 80 }, after: { price: 90 }, reason: 'Season' }));
  });
  it('actorId must be the signed-in user (no framing someone else)', async () => {
    await assertFails(add(P.cust, { actorId: P.admin.uid }));
    await assertFails(add(P.mgr, { actorId: P.cust.uid }));
    await assertFails(add(P.admin, { actorId: 'c-nurul' }));
  });
  it('anonymous, unverified, disabled accounts cannot write', async () => {
    await assertFails(addDoc(collection(anonFs(env), 'auditLogs'), log(P.cust)));
    await assertFails(addDoc(collection(fsOf(env, P.cust, { email_verified: false }), 'auditLogs'), log(P.cust)));
    await assertFails(add(P.custOff));
    await assertFails(add(P.mgrOff, { action: 'LOGIN' }));
  });
  it('brand-new user without a profile can log their own registration (bootstrap)', async () => {
    await assertSucceeds(add(P.stranger, { action: 'CUSTOMER_REGISTERED', entityType: 'user', entityId: P.stranger.uid }));
    await assertFails(add(P.stranger, { action: 'USER_DISABLED' }));
  });
  it('unknown fields, oversized fields, bad types and missing fields rejected', async () => {
    await assertFails(add(P.mgr, { extra: 1 }));
    await assertFails(add(P.mgr, { reason: 'x'.repeat(600) }));
    await assertFails(add(P.mgr, { userAgent: 'x'.repeat(400) }));
    await assertFails(add(P.mgr, { action: 'x'.repeat(100) }));
    await assertFails(add(P.mgr, { after: 'a string' }));
    await assertFails(add(P.mgr, { after: Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['k' + i, i])) }));
    const bad = log(P.mgr); delete bad.entityId;
    await assertFails(addDoc(collection(fsOf(env, P.mgr), 'auditLogs'), bad));
  });
  it('audit entry can ride along in the booking batch (booking + counter + locks + audit)', async () => {
    const fs = fsOf(env, P.cust);
    const { batch } = bookingBatch(fs, {});
    batch.set(doc(collection(fs, 'auditLogs')), log(P.cust));
    await assertSucceeds(batch.commit());
  });

  describe('immutability', () => {
    let id;
    beforeEach(async () => { id = 'AL-1'; await seed(env, async fs => { await setDoc(doc(fs, 'auditLogs', id), log(P.mgr, { action: 'BOOKING_CHECKED_IN' })); }); });
    it('nobody can update an entry (author, other staff, admin, customer)', async () => {
      for (const p of [P.mgr, P.mgr2, P.admin, P.cust]) {
        await assertFails(updateDoc(doc(fsOf(env, p), 'auditLogs', id), { action: 'LOGIN' }));
        await assertFails(updateDoc(doc(fsOf(env, p), 'auditLogs', id), { reason: 'cover-up' }));
      }
    });
    it('nobody can delete an entry, and set() over an existing id is an update (denied)', async () => {
      for (const p of [P.mgr, P.admin, P.cust]) await assertFails(deleteDoc(doc(fsOf(env, p), 'auditLogs', id)));
      await assertFails(setDoc(doc(fsOf(env, P.admin), 'auditLogs', id), log(P.admin)));
    });
  });
  describe('reads', () => {
    beforeEach(async () => { await seed(env, async fs => { await setDoc(doc(fs, 'auditLogs', 'AL-1'), log(P.mgr)); }); });
    it('manager and admin read (get, list, ordered+limited query like the app)', async () => {
      for (const p of [P.mgr, P.admin]) {
        await assertSucceeds(getDoc(doc(fsOf(env, p), 'auditLogs', 'AL-1')));
        await assertSucceeds(getDocs(query(collection(fsOf(env, p), 'auditLogs'), orderBy('at', 'desc'), limit(300))));
      }
    });
    it('customers, anonymous and disabled staff cannot read the audit trail', async () => {
      for (const db of [anonFs(env), fsOf(env, P.cust), fsOf(env, P.custOff), fsOf(env, P.mgrOff), fsOf(env, P.stranger)]) {
        await assertFails(getDoc(doc(db, 'auditLogs', 'AL-1')));
        await assertFails(getDocs(collection(db, 'auditLogs')));
      }
    });
  });
});
