// users/{uid} + staffInvites/{email}: bootstrap, role matrix, privilege-escalation attempts.
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  makeEnv, P, ADMIN_EMAIL, profileOf, ctx, fsOf, anonFs, seed, seedUsers, clearAll,
  assertSucceeds, assertFails, doc, setDoc, getDoc, updateDoc, deleteDoc
} from './helpers.js';
import { getDocs, collection, query, where } from 'firebase/firestore';

const newbie = { uid: 'nb1', email: 'new.person@gmail.com', name: 'New Person' };
const invitee = { uid: 'inv1', email: 'invited.manager@gmail.com', name: 'Invited Manager' };
const mine = (p, over) => Object.assign({
  id: p.uid, role: 'customer', name: p.name || 'X', email: p.email, photoURL: 'https://lh3.googleusercontent.com/a/x', phone: '', googleUid: p.uid,
  status: 'active', authProvider: 'google', createdAt: new Date().toISOString(), lastLoginAt: null, needsProfile: true
}, over || {});

describe('users: profile creation (bootstrap)', () => {
  let env;
  before(async () => { env = await makeEnv('users'); });
  after(async () => { await env.cleanup(); });
  beforeEach(async () => { await clearAll(env); await seedUsers(env); });

  it('verified new Google user creates own customer profile', async () => {
    await assertSucceeds(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie)));
  });
  it('minimal profile (only role/email/status) is accepted', async () => {
    await assertSucceeds(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), { role: 'customer', email: newbie.email, status: 'active' }));
  });
  it('anonymous cannot create a profile', async () => {
    await assertFails(setDoc(doc(anonFs(env), 'users', newbie.uid), mine(newbie)));
  });
  it('Firebase anonymous-auth user (no e-mail) cannot create a profile', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('anon9').firestore(), 'users', 'anon9'), { role: 'customer', email: '', status: 'active' }));
  });
  it('unverified e-mail cannot create a profile', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie, { email_verified: false }), 'users', newbie.uid), mine(newbie)));
  });
  it('cannot create a profile under someone else\'s uid', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', 'victim'), mine(newbie, { id: 'victim', googleUid: 'victim' })));
  });
  it('profile e-mail must equal the verified token e-mail', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { email: 'someone.else@gmail.com' })));
  });
  it('profile e-mail must be lowercase', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie, { email: 'New.Person@gmail.com' }), 'users', newbie.uid), mine(newbie, { email: 'New.Person@gmail.com' })));
  });
  it('profile must start active (cannot self-create disabled/other status)', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { status: 'disabled' })));
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { status: 'superuser' })));
  });
  it('googleUid / id / authProvider spoofing denied', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { googleUid: 'other' })));
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { id: 'other' })));
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { authProvider: 'password' })));
  });
  it('unknown fields (e.g. isAdmin) are rejected', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { isAdmin: true })));
  });
  it('oversized name rejected', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { name: 'x'.repeat(500) })));
  });

  // ---- privilege escalation at creation
  it('customer cannot create a hotel_manager profile without an invitation', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { role: 'hotel_manager' })));
  });
  it('customer cannot create an admin profile', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { role: 'admin' })));
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { role: 'admin', primary: true })));
  });
  it('customer cannot claim primary:true', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { primary: true })));
  });
  it('invited e-mail may create the invited manager profile', async () => {
    await assertSucceeds(setDoc(doc(fsOf(env, invitee), 'users', invitee.uid), mine(invitee, { role: 'hotel_manager', needsProfile: false })));
  });
  it('invited e-mail cannot become admin', async () => {
    await assertFails(setDoc(doc(fsOf(env, invitee), 'users', invitee.uid), mine(invitee, { role: 'admin' })));
  });
  it('invited e-mail cannot silently become a customer (invite decides the role)', async () => {
    await assertFails(setDoc(doc(fsOf(env, invitee), 'users', invitee.uid), mine(invitee)));
  });
  it('uninvited e-mail cannot reuse another person\'s invitation (token e-mail differs)', async () => {
    await assertFails(setDoc(doc(fsOf(env, newbie), 'users', newbie.uid), mine(newbie, { role: 'hotel_manager', email: invitee.email })));
  });
  it('invitation with unverified e-mail does not help', async () => {
    await assertFails(setDoc(doc(fsOf(env, invitee, { email_verified: false }), 'users', invitee.uid), mine(invitee, { role: 'hotel_manager' })));
  });

  // ---- default admin bootstrap
  const root = { uid: 'root1', email: ADMIN_EMAIL, name: 'Default Admin' };
  it('default admin e-mail (verified) bootstraps as primary admin', async () => {
    await assertSucceeds(setDoc(doc(fsOf(env, root), 'users', root.uid), mine(root, { role: 'admin', primary: true, needsProfile: false })));
  });
  it('default admin bootstrap is case-insensitive on the token e-mail', async () => {
    const c = fsOf(env, root, { email: 'someone@Gmail.com' });
    await assertSucceeds(setDoc(doc(c, 'users', root.uid), mine(root, { role: 'admin', primary: true })));
  });
  it('default admin profile must be primary', async () => {
    await assertFails(setDoc(doc(fsOf(env, root), 'users', root.uid), mine(root, { role: 'admin' })));
  });
  it('default admin e-mail can only create the admin profile (not customer / manager)', async () => {
    await assertFails(setDoc(doc(fsOf(env, root), 'users', root.uid), mine(root)));
    await assertFails(setDoc(doc(fsOf(env, root), 'users', root.uid), mine(root, { role: 'hotel_manager' })));
  });
  it('default-admin e-mail with unverified token cannot bootstrap', async () => {
    await assertFails(setDoc(doc(fsOf(env, root, { email_verified: false }), 'users', root.uid), mine(root, { role: 'admin', primary: true })));
  });
  it('look-alike e-mails cannot bootstrap as admin', async () => {
    for (const email of ['admin@aureliastay.local.evil.com', 'xadmin@aureliastay.local', 'someone+1@gmail.com', 'someone@googlemail.com']) {
      const p = { uid: 'imp1', email, name: 'Imp' };
      await assertFails(setDoc(doc(fsOf(env, p), 'users', p.uid), mine(p, { role: 'admin', primary: true })));
    }
  });
  it('creating over an existing profile is an update, so role cannot be rewritten that way', async () => {
    await assertFails(setDoc(doc(fsOf(env, P.cust), 'users', P.cust.uid), profileOf(Object.assign({}, P.cust, { role: 'admin' }))));
  });
});

describe('users: reads', () => {
  let env;
  before(async () => { env = await makeEnv('usersread'); });
  after(async () => { await env.cleanup(); });
  beforeEach(async () => { await clearAll(env); await seedUsers(env); });

  it('anonymous cannot read any profile or list', async () => {
    await assertFails(getDoc(doc(anonFs(env), 'users', P.cust.uid)));
    await assertFails(getDocs(collection(anonFs(env), 'users')));
  });
  it('customer reads own profile, not another customer\'s, not a manager\'s', async () => {
    await assertSucceeds(getDoc(doc(fsOf(env, P.cust), 'users', P.cust.uid)));
    await assertFails(getDoc(doc(fsOf(env, P.cust), 'users', P.cust2.uid)));
    await assertFails(getDoc(doc(fsOf(env, P.cust), 'users', P.mgr.uid)));
    await assertFails(getDoc(doc(fsOf(env, P.cust), 'users', P.admin.uid)));
  });
  it('customer cannot list users (even filtered by role)', async () => {
    await assertFails(getDocs(collection(fsOf(env, P.cust), 'users')));
    await assertFails(getDocs(query(collection(fsOf(env, P.cust), 'users'), where('role', '==', 'customer'))));
  });
  it('signed-in user without profile can probe their own (missing) doc', async () => {
    await assertSucceeds(getDoc(doc(fsOf(env, P.stranger), 'users', P.stranger.uid)));
    await assertFails(getDoc(doc(fsOf(env, P.stranger), 'users', P.cust.uid)));
  });
  it('manager reads customers and lists all users', async () => {
    await assertSucceeds(getDoc(doc(fsOf(env, P.mgr), 'users', P.cust.uid)));
    await assertSucceeds(getDocs(collection(fsOf(env, P.mgr), 'users')));
  });
  it('admin reads every profile', async () => {
    await assertSucceeds(getDoc(doc(fsOf(env, P.admin), 'users', P.mgr.uid)));
    await assertSucceeds(getDocs(collection(fsOf(env, P.admin), 'users')));
  });
  it('disabled manager loses staff reads but can still read own profile', async () => {
    await assertFails(getDoc(doc(fsOf(env, P.mgrOff), 'users', P.cust.uid)));
    await assertFails(getDocs(collection(fsOf(env, P.mgrOff), 'users')));
    await assertSucceeds(getDoc(doc(fsOf(env, P.mgrOff), 'users', P.mgrOff.uid)));
  });
  it('disabled customer can read own profile (to show "disabled") but nobody else\'s', async () => {
    await assertSucceeds(getDoc(doc(fsOf(env, P.custOff), 'users', P.custOff.uid)));
    await assertFails(getDoc(doc(fsOf(env, P.custOff), 'users', P.cust.uid)));
  });
});

describe('users: updates', () => {
  let env;
  before(async () => { env = await makeEnv('usersupd'); });
  after(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await clearAll(env); await seedUsers(env);
    await seed(env, async fs => { await setDoc(doc(fs, 'users', 'adm2'), profileOf({ uid: 'adm2', email: 'second.admin@gmail.com', role: 'admin', name: 'Second Admin' })); });
  });
  const ref = (p, id) => doc(fsOf(env, p), 'users', id);

  it('customer may update name, phone, photoURL, lastLoginAt, updatedAt, needsProfile', async () => {
    await assertSucceeds(updateDoc(ref(P.cust, P.cust.uid), { phone: '013-999 8888', name: 'Renamed', photoURL: 'https://x/y.png', lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString(), needsProfile: false }));
  });
  it('role escalation by self-edit denied for every role/target', async () => {
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { role: 'admin' }));
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { role: 'hotel_manager' }));
    await assertFails(updateDoc(ref(P.mgr, P.mgr.uid), { role: 'admin' }));
    await assertFails(updateDoc(ref(P.admin, P.admin.uid), { role: 'customer' }));
  });
  it('status / email / primary / googleUid / id self-edit denied', async () => {
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { status: 'disabled' }));
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { email: 'other@gmail.com' }));
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { primary: true }));
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { googleUid: 'x' }));
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { id: 'x' }));
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { phone: '012', isAdmin: true }));
  });
  it('disabled customer cannot re-enable themselves', async () => {
    await assertFails(updateDoc(ref(P.custOff, P.custOff.uid), { status: 'active' }));
    await assertFails(updateDoc(ref(P.custOff, P.custOff.uid), { phone: '012' }));
  });
  it('oversized phone / wrong type rejected', async () => {
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { phone: 'x'.repeat(100) }));
    await assertFails(updateDoc(ref(P.cust, P.cust.uid), { name: 123 }));
  });
  it('nobody edits another user\'s profile fields', async () => {
    await assertFails(updateDoc(ref(P.cust2, P.cust.uid), { phone: '000' }));
    await assertFails(updateDoc(ref(P.mgr, P.cust.uid), { phone: '000' }));
    await assertFails(updateDoc(ref(P.admin, P.cust.uid), { phone: '000' }));
    await assertFails(updateDoc(ref(P.admin, P.cust.uid), { role: 'admin' }));
  });
  it('admin disables and re-enables a customer and a manager', async () => {
    await assertSucceeds(updateDoc(ref(P.admin, P.cust.uid), { status: 'disabled', updatedAt: new Date().toISOString() }));
    await assertSucceeds(updateDoc(ref(P.admin, P.custOff.uid), { status: 'active' }));
    await assertSucceeds(updateDoc(ref(P.admin, P.mgr.uid), { status: 'disabled' }));
  });
  it('admin may only set a valid status value', async () => {
    await assertFails(updateDoc(ref(P.admin, P.cust.uid), { status: 'banned' }));
  });
  it('admin cannot disable or demote themselves', async () => {
    await assertFails(updateDoc(ref(P.admin, P.admin.uid), { status: 'disabled' }));
    await assertFails(updateDoc(ref({ uid: 'adm2', email: 'second.admin@gmail.com' }, 'adm2'), { status: 'disabled' }));
  });
  it('the primary admin can never be disabled, even by another admin', async () => {
    await assertFails(updateDoc(ref({ uid: 'adm2', email: 'second.admin@gmail.com' }, P.admin.uid), { status: 'disabled' }));
  });
  it('admin cannot change anyone\'s role or e-mail through the status path', async () => {
    await assertFails(updateDoc(ref(P.admin, P.cust.uid), { status: 'active', role: 'admin' }));
    await assertFails(updateDoc(ref(P.admin, P.cust.uid), { email: 'x@y.com' }));
  });
  it('manager cannot change any user\'s status (customer, other manager, admin, self)', async () => {
    for (const id of [P.cust.uid, P.mgr2.uid, P.admin.uid, P.mgr.uid]) await assertFails(updateDoc(ref(P.mgr, id), { status: 'disabled' }));
  });
  it('disabled admin-role account (if any) loses admin power', async () => {
    await seed(env, async fs => { await updateDoc(doc(fs, 'users', 'adm2'), { status: 'disabled' }); });
    await assertFails(updateDoc(ref({ uid: 'adm2', email: 'second.admin@gmail.com' }, P.cust.uid), { status: 'disabled' }));
  });
  it('profiles can never be deleted (self, manager, admin)', async () => {
    await assertFails(deleteDoc(ref(P.cust, P.cust.uid)));
    await assertFails(deleteDoc(ref(P.mgr, P.cust.uid)));
    await assertFails(deleteDoc(ref(P.admin, P.cust.uid)));
    await assertFails(deleteDoc(ref(P.admin, P.admin.uid)));
  });
});

describe('staffInvites', () => {
  let env;
  before(async () => { env = await makeEnv('invites'); });
  after(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await clearAll(env); await seedUsers(env);
    await seed(env, async fs => { await setDoc(doc(fs, 'users', invitee.uid), profileOf({ uid: invitee.uid, email: invitee.email, role: 'hotel_manager', name: invitee.name })); });
  });
  const inv = (email, over) => Object.assign({ email, name: 'Fresh', phone: '012-111 2222', role: 'hotel_manager', invitedBy: P.admin.uid, createdAt: new Date().toISOString() }, over || {});
  const iref = (p, e) => doc(fsOf(env, p), 'staffInvites', e);

  it('admin creates an invitation', async () => {
    await assertSucceeds(setDoc(iref(P.admin, 'fresh.mgr@gmail.com'), inv('fresh.mgr@gmail.com')));
  });
  it('invitation role must be hotel_manager (admin invites are impossible)', async () => {
    await assertFails(setDoc(iref(P.admin, 'fresh.mgr@gmail.com'), inv('fresh.mgr@gmail.com', { role: 'admin' })));
    await assertFails(setDoc(iref(P.admin, 'fresh.mgr@gmail.com'), inv('fresh.mgr@gmail.com', { role: 'customer' })));
  });
  it('doc id must equal the (lowercase) e-mail field and invitedBy must be the admin', async () => {
    await assertFails(setDoc(iref(P.admin, 'fresh.mgr@gmail.com'), inv('other@gmail.com')));
    await assertFails(setDoc(iref(P.admin, 'Fresh.Mgr@gmail.com'), inv('Fresh.Mgr@gmail.com')));
    await assertFails(setDoc(iref(P.admin, 'fresh.mgr@gmail.com'), inv('fresh.mgr@gmail.com', { invitedBy: 'someone' })));
    await assertFails(setDoc(iref(P.admin, 'not-an-email'), inv('not-an-email')));
  });
  it('the default admin e-mail cannot be invited as a manager', async () => {
    await assertFails(setDoc(iref(P.admin, ADMIN_EMAIL), inv(ADMIN_EMAIL)));
  });
  it('manager / customer / anonymous cannot create or delete invitations', async () => {
    await assertFails(setDoc(iref(P.mgr, 'fresh.mgr@gmail.com'), inv('fresh.mgr@gmail.com', { invitedBy: P.mgr.uid })));
    await assertFails(setDoc(iref(P.cust, 'fresh.mgr@gmail.com'), inv('fresh.mgr@gmail.com', { invitedBy: P.cust.uid })));
    await assertFails(setDoc(doc(anonFs(env), 'staffInvites', 'fresh.mgr@gmail.com'), inv('fresh.mgr@gmail.com')));
    await assertFails(deleteDoc(iref(P.mgr, invitee.email)));
    await assertFails(deleteDoc(iref(P.cust, invitee.email)));
  });
  it('self-service invite creation by the would-be manager is denied', async () => {
    await assertFails(setDoc(iref(P.cust, P.cust.email), inv(P.cust.email, { invitedBy: P.cust.uid })));
  });
  it('admin can list, read and revoke (delete) invitations', async () => {
    await assertSucceeds(getDocs(collection(fsOf(env, P.admin), 'staffInvites')));
    await assertSucceeds(getDoc(iref(P.admin, invitee.email)));
    await assertSucceeds(deleteDoc(iref(P.admin, invitee.email)));
  });
  it('invitee can get only their own invitation; nobody else can; nobody non-admin can list', async () => {
    await assertSucceeds(getDoc(iref(invitee, invitee.email)));
    await assertFails(getDoc(iref(P.cust, invitee.email)));
    await assertFails(getDoc(iref(P.mgr, invitee.email)));
    await assertFails(getDocs(collection(fsOf(env, invitee), 'staffInvites')));
    await assertFails(getDocs(collection(fsOf(env, P.mgr), 'staffInvites')));
  });
  it('invitee claims the invitation once, only claimedBy/claimedAt', async () => {
    const t = new Date().toISOString();
    await assertSucceeds(updateDoc(iref(invitee, invitee.email), { claimedBy: invitee.uid, claimedAt: t }));
    await seed(env, async fs => { await updateDoc(doc(fs, 'staffInvites', invitee.email), { claimedBy: invitee.uid, claimedAt: t }); });
    await assertFails(updateDoc(iref(invitee, invitee.email), { claimedBy: invitee.uid, claimedAt: 'again' }));
  });
  it('claim cannot rewrite role, claim as someone else, or be done by another account', async () => {
    const t = new Date().toISOString();
    await assertFails(updateDoc(iref(invitee, invitee.email), { claimedBy: invitee.uid, claimedAt: t, role: 'admin' }));
    await assertFails(updateDoc(iref(invitee, invitee.email), { claimedBy: P.cust.uid, claimedAt: t }));
    await assertFails(updateDoc(iref(P.cust, invitee.email), { claimedBy: P.cust.uid, claimedAt: t }));
    await assertFails(updateDoc(iref(P.mgr, invitee.email), { claimedBy: P.mgr.uid, claimedAt: t }));
  });
  it('claim with an unverified token is denied', async () => {
    await assertFails(updateDoc(doc(fsOf(env, invitee, { email_verified: false }), 'staffInvites', invitee.email), { claimedBy: invitee.uid, claimedAt: 'x' }));
  });
  it('claim requires the claimant to actually hold a manager profile', async () => {
    const lone = { uid: 'lone1', email: 'lone.invite@gmail.com' };
    await seed(env, async fs => { await setDoc(doc(fs, 'staffInvites', lone.email), inv(lone.email)); });
    await assertFails(updateDoc(iref(lone, lone.email), { claimedBy: lone.uid, claimedAt: 'x' }));
  });
});
