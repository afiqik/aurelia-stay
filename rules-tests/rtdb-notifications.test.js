// RTDB notifications/{target}/{pushId}: owner channels, managers/admins channels, spoofing, tampering, deletes.
import { describe, it, before, after, beforeEach } from 'node:test';
import { makeEnv, P, clearAll } from './helpers.js';
import { seedStaff, adm2, notif, seedNotif, rdb, put, read, at, set, update, remove, push, ref, assertSucceeds, assertFails } from './rtdb-helpers.js';

let env;
before(async () => { env = await makeEnv('rtdbnotif'); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await clearAll(env); await seedStaff(env, { [adm2.email]: 'admin' }); });

const anon = () => env.unauthenticatedContext().database();
const send = (p, target, over, claims) => { const db = rdb(env, p, claims); return set(push(ref(db, 'notifications/' + target)), notif(Object.assign({ from: p.uid }, over || {}))); };
const patch = (p, target, id, v, claims) => update(at(rdb(env, p, claims), 'notifications/' + target + '/' + id), v);

describe('notifications: reads (channel privacy)', () => {
  it('owner reads own channel; another customer cannot; staff cannot read a customer channel either', async () => {
    const id = await seedNotif(env, P.cust.uid, { from: P.mgr.uid });
    await assertSucceeds(read(rdb(env, P.cust), 'notifications/' + P.cust.uid));
    await assertSucceeds(read(rdb(env, P.cust), 'notifications/' + P.cust.uid + '/' + id));
    await assertFails(read(rdb(env, P.cust2), 'notifications/' + P.cust.uid));
    await assertFails(read(rdb(env, P.cust2), 'notifications/' + P.cust.uid + '/' + id));
    await assertFails(read(rdb(env, P.mgr), 'notifications/' + P.cust.uid));
    await assertFails(read(rdb(env, P.admin), 'notifications/' + P.cust.uid));
  });
  it('the whole notifications tree is not listable by anyone (customer, manager, admin, default admin)', async () => {
    await seedNotif(env, P.cust.uid);
    for (const p of [P.cust, P.mgr, P.admin, adm2]) await assertFails(read(rdb(env, p), 'notifications'));
    await assertFails(read(anon(), 'notifications'));
  });
  it('customers cannot read the managers or admins channels', async () => {
    await seedNotif(env, 'managers'); await seedNotif(env, 'admins');
    await assertFails(read(rdb(env, P.cust), 'notifications/managers'));
    await assertFails(read(rdb(env, P.cust), 'notifications/admins'));
    await assertFails(read(rdb(env, P.custOff), 'notifications/managers'));
  });
  it('managers read managers but not admins; admins read both', async () => {
    await seedNotif(env, 'managers'); await seedNotif(env, 'admins');
    await assertSucceeds(read(rdb(env, P.mgr), 'notifications/managers'));
    await assertFails(read(rdb(env, P.mgr), 'notifications/admins'));
    await assertSucceeds(read(rdb(env, P.admin), 'notifications/admins'));
    await assertSucceeds(read(rdb(env, P.admin), 'notifications/managers'));
    await assertSucceeds(read(rdb(env, adm2), 'notifications/admins'));
  });
  it('a manager removed from the mirror (disabled / revoked) loses the managers channel', async () => {
    await seedNotif(env, 'managers');
    await assertFails(read(rdb(env, P.mgrOff), 'notifications/managers'));
  });
  it('a staffEmails manager entry does not unlock the admins channel (cannot be tricked by role claims)', async () => {
    await seedNotif(env, 'admins');
    await assertFails(read(rdb(env, P.mgr, { role: 'admin' }), 'notifications/admins'));
  });
  it('anonymous and unverified tokens read nothing', async () => {
    const id = await seedNotif(env, P.cust.uid);
    await assertFails(read(anon(), 'notifications/' + P.cust.uid + '/' + id));
    await assertFails(read(rdb(env, P.cust, { email_verified: false }), 'notifications/' + P.cust.uid));
    await assertFails(read(rdb(env, P.mgr, { email_verified: false }), 'notifications/managers'));
  });
  it('owner channel read is by uid only: a different uid with the same e-mail cannot read it', async () => {
    await seedNotif(env, P.cust.uid);
    await assertFails(read(rdb(env, { uid: 'cust1b', email: P.cust.email }), 'notifications/' + P.cust.uid));
  });
});

describe('notifications: create (spoofing)', () => {
  it('customer notifies self and the managers channel (booking flow)', async () => {
    await assertSucceeds(send(P.cust, P.cust.uid));
    await assertSucceeds(send(P.cust, 'managers'));
  });
  it('a customer can only post NEW_BOOKING to the managers channel (no fake housekeeping / maintenance / override alerts)', async () => {
    for (const type of ['MAINTENANCE_REPORTED', 'HOUSEKEEPING_REQUIRED', 'ADMIN_BOOKING_OVERRIDE', 'PRICE_CHANGED']) await assertFails(send(P.cust, 'managers', { type }));
    await assertSucceeds(send(P.mgr, 'managers', { type: 'HOUSEKEEPING_REQUIRED' }));
  });
  it('customer cannot notify another customer (cross-user spoofing) or the admins channel', async () => {
    await assertFails(send(P.cust, P.cust2.uid));
    await assertFails(send(P.cust, P.cust2.uid, { from: P.cust2.uid }));
    await assertFails(send(P.cust, 'admins'));
    await assertFails(send(P.custOff, P.cust2.uid));
  });
  it('staff notify customers, managers and admins (booking confirmed, cancel alerts)', async () => {
    await assertSucceeds(send(P.mgr, P.cust.uid));
    await assertSucceeds(send(P.mgr, 'admins'));
    await assertSucceeds(send(P.mgr, 'managers'));
    await assertSucceeds(send(P.admin, P.cust.uid));
    await assertSucceeds(send(P.admin, 'managers'));
  });
  it('a manager removed from the mirror cannot notify customers or admins any more', async () => {
    await assertFails(send(P.mgrOff, P.cust.uid));
    await assertFails(send(P.mgrOff, 'admins'));
  });
  it('the sender field cannot be forged (must equal the caller uid)', async () => {
    await assertFails(send(P.cust, P.cust.uid, { from: P.admin.uid }));
    await assertFails(send(P.mgr, P.cust.uid, { from: P.admin.uid }));
    await assertFails(send(P.cust, 'managers', { from: 'someone-else' }));
    await assertFails(send(P.cust, P.cust.uid, { from: 42 }));
  });
  it('anonymous / unverified users cannot create', async () => {
    await assertFails(set(push(ref(anon(), 'notifications/managers')), notif()));
    await assertFails(send(P.cust, P.cust.uid, {}, { email_verified: false }));
  });
  it('new notifications must start unread', async () => {
    await assertFails(send(P.cust, P.cust.uid, { read: true }));
    await assertFails(send(P.cust, P.cust.uid, { read: 'false' }));
  });
  it('shape: required fields, unknown fields, types and bounds', async () => {
    for (const k of ['type', 'title', 'message', 'at', 'read']) { const n = notif(); delete n[k]; await assertFails(set(push(ref(rdb(env, P.cust), 'notifications/' + P.cust.uid)), n)); }
    await assertFails(send(P.cust, P.cust.uid, { extra: 'x' }));
    await assertFails(send(P.cust, P.cust.uid, { type: '' }));
    await assertFails(send(P.cust, P.cust.uid, { type: 'x'.repeat(61) }));
    await assertFails(send(P.cust, P.cust.uid, { title: '' }));
    await assertFails(send(P.cust, P.cust.uid, { title: 'x'.repeat(201) }));
    await assertFails(send(P.cust, P.cust.uid, { message: 'x'.repeat(1001) }));
    await assertFails(send(P.cust, P.cust.uid, { title: 5 }));
    await assertFails(send(P.cust, P.cust.uid, { at: 'yesterday' }));
    await assertFails(send(P.cust, P.cust.uid, { at: '2026-01-01' }));
    await assertFails(send(P.cust, P.cust.uid, { at: Date.now() }));
  });
  it('limits used by the client (type 40, title 120, message 400, empty message, ISO with ms) are accepted', async () => {
    await assertSucceeds(send(P.cust, P.cust.uid, { type: 'x'.repeat(40), title: 'x'.repeat(120), message: 'm'.repeat(400) }));
    await assertSucceeds(send(P.cust, P.cust.uid, { message: '' }));
  });
  it('markers cannot be smuggled into the target path, nor can a customer write the channel root', async () => {
    await assertFails(set(ref(rdb(env, P.cust), 'notifications/' + P.cust.uid), { a: notif() }));
    await assertFails(set(ref(rdb(env, P.cust), 'notifications/managers'), { a: notif() }));
    await assertFails(set(ref(rdb(env, P.mgr), 'notifications'), { managers: { a: notif({ from: P.mgr.uid }) } }));
  });
  it('overlong targets are rejected even for staff', async () => {
    await assertFails(send(P.mgr, 'u'.repeat(129)));
  });
});

describe('notifications: update (mark read, tamper)', () => {
  it('owner flips read on own notification', async () => {
    const id = await seedNotif(env, P.cust.uid);
    await assertSucceeds(patch(P.cust, P.cust.uid, id, { read: true }));
    await assertSucceeds(set(at(rdb(env, P.cust), 'notifications/' + P.cust.uid + '/' + id + '/read'), false));
  });
  it('another customer / manager / admin cannot flip someone else\'s read flag', async () => {
    const id = await seedNotif(env, P.cust.uid);
    for (const p of [P.cust2, P.mgr, P.admin]) await assertFails(patch(p, P.cust.uid, id, { read: true }));
    await assertFails(set(at(anon(), 'notifications/' + P.cust.uid + '/' + id + '/read'), true));
  });
  it('managers flip read on the managers channel; customers cannot; managers cannot touch admins', async () => {
    const m = await seedNotif(env, 'managers'), a = await seedNotif(env, 'admins');
    await assertSucceeds(patch(P.mgr, 'managers', m, { read: true }));
    await assertSucceeds(patch(P.admin, 'managers', m, { read: true }));
    await assertFails(patch(P.cust, 'managers', m, { read: true }));
    await assertFails(patch(P.mgr, 'admins', a, { read: true }));
    await assertSucceeds(patch(P.admin, 'admins', a, { read: true }));
    await assertSucceeds(patch(adm2, 'admins', a, { read: true }));
    await assertFails(patch(P.cust, 'admins', a, { read: true }));
  });
  it('the author of a managers-channel notification (a customer) cannot edit it afterwards', async () => {
    const r = push(ref(rdb(env, P.cust), 'notifications/managers')); await assertSucceeds(set(r, notif()));
    await assertFails(update(r, { title: 'Edited' }));
    await assertFails(update(r, { read: true }));
    await assertFails(remove(r));
  });
  it('content is immutable: type, title, message, at, from cannot change (owner, staff, anyone)', async () => {
    const id = await seedNotif(env, P.cust.uid, { from: P.mgr.uid });
    for (const v of [{ type: 'X' }, { title: 'Hacked' }, { message: 'Pay to evil.example' }, { at: '2030-01-01T00:00:00.000Z' }, { from: P.cust.uid }]) {
      await assertFails(patch(P.cust, P.cust.uid, id, v));
    }
    const m = await seedNotif(env, 'managers');
    for (const v of [{ title: 'Hacked' }, { message: 'x' }, { from: P.mgr.uid }]) await assertFails(patch(P.mgr, 'managers', m, v));
  });
  it('flipping read cannot be combined with a content change, nor with a new field', async () => {
    const id = await seedNotif(env, P.cust.uid);
    await assertFails(patch(P.cust, P.cust.uid, id, { read: true, title: 'Changed' }));
    await assertFails(patch(P.cust, P.cust.uid, id, { read: true, admin: true }));
  });
  it('read must stay a boolean; fields cannot be deleted', async () => {
    const id = await seedNotif(env, P.cust.uid);
    await assertFails(patch(P.cust, P.cust.uid, id, { read: 'yes' }));
    await assertFails(patch(P.cust, P.cust.uid, id, { title: null }));
    await assertFails(patch(P.cust, P.cust.uid, id, { read: null }));
  });
  it('owner cannot replace the notification with different content through a full set()', async () => {
    const id = await seedNotif(env, P.cust.uid);
    await assertFails(set(at(rdb(env, P.cust), 'notifications/' + P.cust.uid + '/' + id), notif({ title: 'Replaced' })));
  });
  it('markAllRead style multi-path update works across own + managers channels for a manager, and is all-or-nothing', async () => {
    const mine = await seedNotif(env, P.mgr.uid), shared = await seedNotif(env, 'managers'), adm = await seedNotif(env, 'admins');
    const root = ref(rdb(env, P.mgr));
    await assertSucceeds(update(root, { ['notifications/' + P.mgr.uid + '/' + mine + '/read']: true, ['notifications/managers/' + shared + '/read']: true }));
    await assertFails(update(root, { ['notifications/managers/' + shared + '/read']: false, ['notifications/admins/' + adm + '/read']: true }));
    const snap = await read(rdb(env, P.admin), 'notifications/managers/' + shared + '/read');
    if (snap.val() !== true) throw new Error('partial multi-path write leaked through');
  });
  it('customer multi-path markAllRead on own channel works, cross-user path in the same update fails', async () => {
    const mine = await seedNotif(env, P.cust.uid), theirs = await seedNotif(env, P.cust2.uid);
    const root = ref(rdb(env, P.cust));
    await assertSucceeds(update(root, { ['notifications/' + P.cust.uid + '/' + mine + '/read']: true }));
    await assertFails(update(root, { ['notifications/' + P.cust.uid + '/' + mine + '/read']: false, ['notifications/' + P.cust2.uid + '/' + theirs + '/read']: true }));
  });
});

describe('notifications: delete', () => {
  it('owner deletes own notification; nobody else can (including staff)', async () => {
    const id = await seedNotif(env, P.cust.uid);
    await assertFails(remove(at(rdb(env, P.cust2), 'notifications/' + P.cust.uid + '/' + id)));
    await assertFails(remove(at(rdb(env, P.mgr), 'notifications/' + P.cust.uid + '/' + id)));
    await assertFails(remove(at(rdb(env, P.admin), 'notifications/' + P.cust.uid + '/' + id)));
    await assertSucceeds(remove(at(rdb(env, P.cust), 'notifications/' + P.cust.uid + '/' + id)));
  });
  it('shared channels cannot be deleted by anyone (audit trail for staff)', async () => {
    const m = await seedNotif(env, 'managers'), a = await seedNotif(env, 'admins');
    for (const p of [P.cust, P.mgr, P.admin]) {
      await assertFails(remove(at(rdb(env, p), 'notifications/managers/' + m)));
      await assertFails(remove(at(rdb(env, p), 'notifications/admins/' + a)));
    }
  });
  it('whole channels cannot be wiped', async () => {
    await seedNotif(env, P.cust.uid);
    await assertFails(remove(at(rdb(env, P.cust), 'notifications/' + P.cust.uid)));
    await assertFails(remove(at(rdb(env, P.admin), 'notifications')));
  });
});
