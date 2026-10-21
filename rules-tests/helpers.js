// Shared fixtures for the rules tests: environment, identities, seeding, date + booking factories.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, writeBatch, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';

setLogLevel('silent'); // denied writes are expected; keep the test output readable

export { assertSucceeds, assertFails, doc, setDoc, getDoc, writeBatch, updateDoc, deleteDoc };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ADMIN_EMAIL = 'admin@aureliastay.local';
export const PRICES = { 1: 80, 2: 85, 3: 90, 4: 95 };
export const CAPACITY = { 1: 1, 2: 2, 3: 2, 4: 4 };
export const TYPE_OF_ROOM = { 101: 1, 102: 1, 201: 2, 202: 2, 301: 3, 302: 3, 401: 4, 402: 4 };

/** One isolated emulator namespace per test file (node --test runs files in parallel processes). */
export function makeEnv(suite) {
  return initializeTestEnvironment({
    projectId: 'demo-aurelia-' + suite,
    firestore: { rules: readFileSync(join(ROOT, 'firestore.rules'), 'utf8') },
    database: { rules: readFileSync(join(ROOT, 'database.rules.json'), 'utf8') }
  });
}

/** People used across the suites. `email` is what the verified Google token carries. */
export const P = {
  admin: { uid: 'adm1', email: ADMIN_EMAIL, role: 'admin', name: 'Default Admin', primary: true },
  mgr: { uid: 'mgr1', email: 'manager.one@gmail.com', role: 'hotel_manager', name: 'Manager One' },
  mgr2: { uid: 'mgr2', email: 'manager.two@gmail.com', role: 'hotel_manager', name: 'Manager Two' },
  mgrOff: { uid: 'mgr3', email: 'manager.off@gmail.com', role: 'hotel_manager', name: 'Disabled Manager', status: 'disabled' },
  cust: { uid: 'cust1', email: 'cust.one@gmail.com', role: 'customer', name: 'Cust One' },
  cust2: { uid: 'cust2', email: 'cust.two@gmail.com', role: 'customer', name: 'Cust Two' },
  custOff: { uid: 'cust3', email: 'cust.off@gmail.com', role: 'customer', name: 'Disabled Cust', status: 'disabled' },
  stranger: { uid: 'new1', email: 'stranger@gmail.com' } // signed in with Google, no profile yet
};

export const profileOf = p => Object.assign({
  id: p.uid, role: p.role, name: p.name, email: p.email, photoURL: '', phone: '012-345 6789', googleUid: p.uid,
  status: p.status || 'active', authProvider: 'google', createdAt: '2026-01-05T09:00:00.000Z', lastLoginAt: null
}, p.primary ? { primary: true } : {});

/** Authenticated context for a person (verified e-mail unless `claims` says otherwise). */
export const ctx = (env, p, claims) => env.authenticatedContext(p.uid, Object.assign({ email: p.email, email_verified: true }, claims || {}));
export const fsOf = (env, p, claims) => ctx(env, p, claims).firestore();
export const dbOf = (env, p, claims) => ctx(env, p, claims).database();
export const anonFs = env => env.unauthenticatedContext().firestore();

/** Runs `fn(db)` with rules disabled (arrange phase). */
export const seed = (env, fn) => env.withSecurityRulesDisabled(async c => { await fn(c.firestore(), c.database()); });

/** Standard population: 1 admin, 2 managers (+1 disabled), 2 customers (+1 disabled), 1 invite. */
export async function seedUsers(env) {
  await seed(env, async fs => {
    for (const p of [P.admin, P.mgr, P.mgr2, P.mgrOff, P.cust, P.cust2, P.custOff]) await setDoc(doc(fs, 'users', p.uid), profileOf(p));
    await setDoc(doc(fs, 'staffInvites', 'invited.manager@gmail.com'), {
      email: 'invited.manager@gmail.com', name: 'Invited Manager', phone: '', role: 'hotel_manager', invitedBy: P.admin.uid, createdAt: '2026-02-01T09:00:00.000Z'
    });
  });
}

// ---- dates (always UTC ISO strings, as the app stores them)
export const addDays = (n, from) => { const d = from ? new Date(from + 'T00:00:00Z') : new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const nightsOf = (ci, co) => { const out = []; for (let d = ci; d < co; d = addDays(1, d)) out.push(d); return out; };
export const nowIso = () => new Date().toISOString();

// ---- booking factory: a valid online booking for room 101 (typeId 1, RM80, fee 10) unless overridden
export function bookingData(o) {
  const x = Object.assign({ n: 1, roomId: 101, typeId: 1, customerId: P.cust.uid, createdBy: P.cust.uid, source: 'ONLINE', guests: 1, nights: 2, offset: 10 }, o || {});
  const ci = x.checkIn || addDays(x.offset);
  const co = x.checkOut || addDays(x.nights, ci);
  const nights = nightsOf(ci, co).length;
  const price = x.roomPrice === undefined ? PRICES[x.typeId] : x.roomPrice;
  const fee = x.serviceFee === undefined ? 10 : x.serviceFee;
  const b = {
    ref: 'AUR-2026-' + String(x.n).padStart(5, '0'), customerId: x.customerId, roomId: x.roomId, typeId: x.typeId, source: x.source,
    checkIn: ci, checkOut: co, guests: x.guests, roomPrice: price, nights, serviceFee: fee, subtotal: price * nights, total: price * nights + fee,
    status: 'CONFIRMED', guestName: 'Cust One', guestEmail: 'cust.one@gmail.com', guestPhone: '012-345 6789', payment: 'Pay at Hotel',
    createdAt: nowIso(), createdBy: x.createdBy, checkedInAt: null, checkedOutAt: null, cancelledAt: null, cancelledBy: null, cancellationReason: null
  };
  return Object.assign(b, x.over || {});
}

/**
 * Builds the batch the client uses to create a booking: counter bump + booking + one lock per night (+ optional audit).
 * opts: n (booking number = current counter), booking overrides via `over`, `locks` (array of night indexes, default all), `noCounter`, `id`.
 */
export function bookingBatch(fs, opts) {
  const o = opts || {};
  const n = o.n === undefined ? 1 : o.n;
  const b = bookingData(Object.assign({}, o, { n }));
  (o.omit || []).forEach(k => { delete b[k]; });
  const id = o.id || 'b' + n;
  const wb = writeBatch(fs);
  if (!o.noCounter) wb.set(doc(fs, 'counters', 'main'), { booking: o.counterTo === undefined ? n + 1 : o.counterTo }, { merge: true });
  wb.set(doc(fs, 'bookings', id), b);
  const base = bookingData(Object.assign({}, o, { n, over: {} })); // lock dates come from the honest stay, not from tampered overrides
  const nights = nightsOf(base.checkIn, base.checkOut);
  (o.locks || nights.map((_, i) => i)).forEach(i => {
    const rid = o.lockRoom === undefined ? b.roomId : o.lockRoom;
    wb.set(doc(fs, 'roomNights', rid + '_' + nights[i]), { roomId: rid, date: nights[i], bookingId: o.lockBooking || id, typeId: base.typeId });
  });
  return { batch: wb, booking: b, id };
}

/** Arrange: a CONFIRMED booking (and its locks) owned by `owner` already in the database. */
export async function seedBooking(env, o) {
  const opts = Object.assign({ n: 1 }, o || {});
  const b = bookingData(opts);
  const id = opts.id || 'b' + opts.n;
  await seed(env, async fs => {
    await setDoc(doc(fs, 'bookings', id), b);
    await setDoc(doc(fs, 'counters', 'main'), { booking: opts.n + 1, hk: 1, req: 1 }, { merge: true });
    if (!opts.noLocks) for (const d of nightsOf(b.checkIn, b.checkOut)) await setDoc(doc(fs, 'roomNights', b.roomId + '_' + d), { roomId: b.roomId, date: d, bookingId: id, typeId: b.typeId });
  });
  return { id, booking: b };
}

export const clearAll = async env => { await env.clearFirestore(); await env.clearDatabase(); };
