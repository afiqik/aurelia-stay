/* AURELIA STAY — account services: updatePhone(userId, phone), setUserStatus(userId, status, actorId); invitations live in invites.js (re-exported).
 *
 * updatePhone: self only (the actor id must be the signed-in user); Malaysian number; writes users/{uid} { phone, updatedAt } + UPDATE_PROFILE audit.
 * setUserStatus (admin only): 'active' | 'disabled'. Never yourself (USER_002), never the primary administrator (USER_003).
 *   Disabling/enabling a STAFF account also removes/restores its RTDB /staffEmails mirror (that is what gives it RTDB staff access); if that second
 *   write fails the Firestore status change is rolled back and the error is returned, so the two stores never disagree.
 *   The disabled user's own browser notices through its users/{uid} listener and signs out (auth.js).
 */
import { fail, guard } from '../errors.js';
import { user } from '../state.js';
import { me } from '../auth-session.js';
import { writeAudit } from '../audit.js';
import { setStaffEmail, removeStaffEmail } from '../staff-emails.js';
import { isPhone, nowIso } from '../util.js';
import { actorOf, adminOf, isStaff } from './ctx.js';
import { runTx, getData, ref, afterCommit } from './tx.js';

export { inviteManager, revokeInvite } from './invites.js';

export function updatePhone(userId, phone) {
  return guard(async () => {
    const u = actorOf(userId);
    if (!isPhone(phone)) fail('VALIDATION_001', 'Please enter a valid Malaysian phone number (e.g. 012-345 6789).', 422);
    const next = String(phone).trim();
    await runTx(async tx => {
      const uRef = ref('users', u.id); const cur = await getData(tx, uRef); if (!cur) fail('USER_001', 'User not found.', 404);
      tx.update(uRef, { phone: next, updatedAt: nowIso() });
      writeAudit(tx, u.id, 'UPDATE_PROFILE', 'user', u.id, { phone: cur.phone || null }, { phone: next });
    });
    await afterCommit([], () => { const p = me(); return !!p && p.phone === next; });
  });
}

const mirror = (u, status) => status === 'active' ? setStaffEmail(u.email, u.role) : removeStaffEmail(u.email);

async function writeStatus(id, status) {
  return runTx(async tx => {
    const uRef = ref('users', id); const cur = await getData(tx, uRef); if (!cur) fail('USER_001', 'User not found.', 404);
    tx.update(uRef, { status, updatedAt: nowIso() });
    return cur.status;
  });
}

export function setUserStatus(userId, status, actorId) {
  return guard(async () => {
    const a = adminOf(actorId); const u = user(userId); if (!u) fail('USER_001', 'User not found.', 404);
    if (u.id === a.id) fail('USER_002', 'You cannot disable your own account.', 403);
    if (u.primary) fail('USER_003', 'The primary admin account cannot be disabled.', 403);
    if (status !== 'active' && status !== 'disabled') fail('VALIDATION_001', 'Status must be active or disabled.', 422);
    const before = await writeStatus(u.id, status);
    if (isStaff(u)) {
      const res = await mirror(u, status);
      if (!res.ok) { await writeStatus(u.id, before || 'active').catch(() => { }); return res; }   // roll back: Firestore and RTDB must agree
    }
    await writeAudit(null, a.id, status === 'active' ? 'USER_ENABLED' : 'USER_DISABLED', 'user', u.email, { status: before }, { status });
    await afterCommit([], () => { const x = user(u.id); return !!x && x.status === status; });
  });
}
