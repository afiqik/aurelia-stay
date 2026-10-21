// RTDB: staffEmails (staff mirror, admin-only writes), presence privacy, and the e-mail key transform.
import { describe, it, before, after, beforeEach } from 'node:test';
import { makeEnv, P, clearAll, seed } from './helpers.js';
import { emailKey, seedStaff, adm2, rdb, put, read, at, set, remove, serverTimestamp, assertSucceeds, assertFails, ref, get } from './rtdb-helpers.js';

let env;
before(async () => { env = await makeEnv('rtdbstaff'); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await clearAll(env); await seedStaff(env, { [adm2.email]: 'admin' }); });

const key = e => 'staffEmails/' + emailKey(e);
const presence = over => Object.assign({ state: 'online', lastChanged: serverTimestamp(), name: 'Someone', role: 'customer', portal: 'customer' }, over || {});

describe('rtdb staffEmails', () => {
  it('default admin writes manager entries and removes them again', async () => {
    const db = rdb(env, P.admin);
    await assertSucceeds(put(db, key('new.manager@gmail.com'), 'hotel_manager'));
    await assertSucceeds(remove(at(db, key('new.manager@gmail.com'))));
  });
  it('only the default admin may create an admin entry', async () => {
    await assertSucceeds(put(rdb(env, P.admin), key('another.admin@gmail.com'), 'admin'));
    await assertFails(put(rdb(env, adm2), key('third.admin@gmail.com'), 'admin'));
  });
  it('a staffEmails admin entry can manage managers and read the mirror', async () => {
    const db = rdb(env, adm2);
    await assertSucceeds(put(db, key('mgr.by.adm2@gmail.com'), 'hotel_manager'));
    await assertSucceeds(read(db, 'staffEmails'));
  });
  it('values other than hotel_manager/admin are rejected (customer, junk, number, object)', async () => {
    const db = rdb(env, P.admin);
    for (const v of ['customer', 'superuser', '', 1, true, { role: 'admin' }]) await assertFails(put(db, key('x.y@gmail.com'), v));
  });
  it('managers cannot write or read the mirror (no self-promotion, no peeking)', async () => {
    const db = rdb(env, P.mgr);
    await assertFails(put(db, key(P.mgr.email), 'admin'));
    await assertFails(put(db, key('buddy@gmail.com'), 'hotel_manager'));
    await assertFails(remove(at(db, key(P.mgr2.email))));
    await assertFails(read(db, 'staffEmails'));
    await assertFails(read(db, key(P.mgr2.email)));
  });
  it('customers and anonymous cannot write or read the mirror', async () => {
    await assertFails(put(rdb(env, P.cust), key(P.cust.email), 'hotel_manager'));
    await assertFails(put(rdb(env, P.cust), key(P.cust.email), 'admin'));
    await assertFails(read(rdb(env, P.cust), 'staffEmails'));
    const anon = env.unauthenticatedContext().database();
    await assertFails(put(anon, key('a@gmail.com'), 'hotel_manager'));
    await assertFails(read(anon, 'staffEmails'));
  });
  it('the default admin e-mail with an unverified token has no power', async () => {
    const db = rdb(env, P.admin, { email_verified: false });
    await assertFails(put(db, key('x@gmail.com'), 'hotel_manager'));
    await assertFails(read(db, 'staffEmails'));
  });
  it('look-alike addresses are not the default admin', async () => {
    for (const email of ['admin@aureliastay.local.evil.com', 'xadmin@aureliastay.local', 'someone+x@gmail.com']) {
      await assertFails(put(rdb(env, { uid: 'imp', email }), key('x@gmail.com'), 'hotel_manager'));
    }
  });
  it('the default admin is recognised case-insensitively', async () => {
    await assertSucceeds(put(rdb(env, P.admin, { email: 'someone@Gmail.com' }), key('case@gmail.com'), 'hotel_manager'));
  });
  it('nobody can overwrite the whole mirror in one write', async () => {
    await assertFails(put(rdb(env, P.mgr), 'staffEmails', { 'x@gmail,com': 'admin' }));
    await assertFails(put(rdb(env, P.admin), 'staffEmails', { 'x@gmail,com': 'hotel_manager' }));
  });
  it('writes outside the documented tree are denied for everyone (even the default admin)', async () => {
    await assertFails(put(rdb(env, P.admin), 'secrets/x', 1));
    await assertFails(get(ref(rdb(env, P.admin))));
    await assertFails(put(rdb(env, P.mgr), 'config', { a: 1 }));
  });
});

describe('rtdb e-mail key transform (rules .replace vs. app emailKey)', () => {
  // The rules compute the key with auth.token.email.toLowerCase().replace('.', ','); this must replace EVERY dot.
  const multi = { uid: 'multi1', email: 'first.last@sub.gmail.com' };
  it('multi-dot address: key made by the app transform grants staff read', async () => {
    await seed(env, async (fs, rtdb) => { await set(ref(rtdb, 'staffEmails/' + emailKey(multi.email)), 'hotel_manager'); });
    await assertSucceeds(read(rdb(env, multi), 'presence'));
  });
  it('a mirror entry for a different address (same local part / sibling domain) does not grant access', async () => {
    await seed(env, async (fs, rtdb) => { await set(ref(rtdb, 'staffEmails/' + emailKey('first.last@gmail.com')), 'hotel_manager'); await set(ref(rtdb, 'staffEmails/' + emailKey('first.last@sub2.gmail.com')), 'hotel_manager'); });
    await assertFails(read(rdb(env, multi), 'presence'));
  });
  it('mixed-case multi-dot token e-mail still resolves to the lowercase key', async () => {
    await seed(env, async (fs, rtdb) => { await set(ref(rtdb, 'staffEmails/' + emailKey(multi.email)), 'hotel_manager'); });
    await assertSucceeds(read(rdb(env, multi, { email: 'First.Last@Sub.Gmail.com' }), 'presence'));
  });
  it('an admin entry for a multi-dot address grants the admins channel', async () => {
    await seed(env, async (fs, rtdb) => { await set(ref(rtdb, 'staffEmails/' + emailKey('ad.min.user@sub.corp.example.com')), 'admin'); });
    await assertSucceeds(read(rdb(env, { uid: 'ad1', email: 'ad.min.user@sub.corp.example.com' }), 'notifications/admins'));
  });
  it('removing the entry revokes access immediately', async () => {
    await seed(env, async (fs, rtdb) => { await set(ref(rtdb, 'staffEmails/' + emailKey(multi.email)), 'hotel_manager'); });
    await assertSucceeds(read(rdb(env, multi), 'presence'));
    await assertSucceeds(remove(at(rdb(env, P.admin), key(multi.email))));
    await assertFails(read(rdb(env, multi), 'presence'));
  });
});

describe('rtdb presence', () => {
  it('every signed-in user writes their own presence (customer, manager, admin)', async () => {
    await assertSucceeds(put(rdb(env, P.cust), 'presence/' + P.cust.uid, presence()));
    await assertSucceeds(put(rdb(env, P.mgr), 'presence/' + P.mgr.uid, presence({ role: 'hotel_manager', portal: 'hotel_manager' })));
    await assertSucceeds(put(rdb(env, P.admin), 'presence/' + P.admin.uid, presence({ role: 'admin', portal: 'admin' })));
  });
  it('offline flip and an empty display name are accepted (sign-out path)', async () => {
    const db = rdb(env, P.cust);
    await assertSucceeds(put(db, 'presence/' + P.cust.uid, presence({ name: '' })));
    await assertSucceeds(put(db, 'presence/' + P.cust.uid, presence({ state: 'offline' })));
  });
  it('nobody writes another user\'s presence (spoofing / erasing)', async () => {
    await assertFails(put(rdb(env, P.cust2), 'presence/' + P.cust.uid, presence({ state: 'offline' })));
    await assertFails(put(rdb(env, P.mgr), 'presence/' + P.cust.uid, presence()));
    await assertFails(put(rdb(env, P.admin), 'presence/' + P.cust.uid, presence()));
  });
  it('anonymous and unverified users cannot write presence', async () => {
    await assertFails(put(env.unauthenticatedContext().database(), 'presence/x', presence()));
    await assertFails(put(rdb(env, P.cust, { email_verified: false }), 'presence/' + P.cust.uid, presence()));
  });
  it('role claims are verified: customer cannot appear as manager/admin, manager cannot appear as admin', async () => {
    await assertFails(put(rdb(env, P.cust), 'presence/' + P.cust.uid, presence({ role: 'hotel_manager' })));
    await assertFails(put(rdb(env, P.cust), 'presence/' + P.cust.uid, presence({ role: 'admin' })));
    await assertFails(put(rdb(env, P.mgr), 'presence/' + P.mgr.uid, presence({ role: 'admin' })));
    await assertSucceeds(put(rdb(env, adm2), 'presence/' + adm2.uid, presence({ role: 'admin' })));
  });
  it('shape: unknown fields, bad state, missing lastChanged, junk role/portal, oversized name denied', async () => {
    const db = rdb(env, P.cust), p = 'presence/' + P.cust.uid;
    await assertFails(put(db, p, presence({ extra: 1 })));
    await assertFails(put(db, p, presence({ state: 'busy' })));
    await assertFails(put(db, p, { state: 'online', name: 'x' }));
    await assertFails(put(db, p, presence({ role: 'root' })));
    await assertFails(put(db, p, presence({ portal: 'root' })));
    await assertFails(put(db, p, presence({ name: 'x'.repeat(101) })));
    await assertFails(put(db, p, presence({ lastChanged: 'yesterday' })));
  });
  it('staff read the presence list and single entries; the default admin too', async () => {
    await seed(env, async (fs, rtdb) => { await set(ref(rtdb, 'presence/' + P.cust.uid), { state: 'online', lastChanged: 1, name: 'c', role: 'customer', portal: 'customer' }); });
    await assertSucceeds(read(rdb(env, P.mgr), 'presence'));
    await assertSucceeds(read(rdb(env, P.mgr2), 'presence/' + P.cust.uid));
    await assertSucceeds(read(rdb(env, P.admin), 'presence'));
    await assertSucceeds(read(rdb(env, adm2), 'presence'));
  });
  it('privacy: customers (even for their own entry), disabled/unknown managers and anonymous cannot read presence', async () => {
    await seed(env, async (fs, rtdb) => { await set(ref(rtdb, 'presence/' + P.cust.uid), { state: 'online', lastChanged: 1, name: 'c', role: 'customer', portal: 'customer' }); });
    await assertFails(read(rdb(env, P.cust), 'presence'));
    await assertFails(read(rdb(env, P.cust), 'presence/' + P.cust.uid));
    await assertFails(read(rdb(env, P.cust2), 'presence/' + P.cust.uid));
    await assertFails(read(rdb(env, P.mgrOff), 'presence')); // no staffEmails entry (admin removed it when disabling)
    await assertFails(read(env.unauthenticatedContext().database(), 'presence'));
    await assertFails(read(rdb(env, P.mgr, { email_verified: false }), 'presence'));
  });
});

describe('rtdb staffEmails keys', () => {
  it('keys must be lowercase (the rules look the key up lowercased)', async () => {
    await assertFails(put(rdb(env, P.admin), 'staffEmails/Mixed,Case@gmail,com', 'hotel_manager'));
    await assertSucceeds(put(rdb(env, P.admin), 'staffEmails/mixed,case@gmail,com', 'hotel_manager'));
  });
});
