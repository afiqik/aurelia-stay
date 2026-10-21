/* AURELIA STAY — staff invitations (admin only), replacing the legacy password-based createManager.
 *
 * inviteManager({ name, email, phone? }, actorId) -> { ok, invite }
 *   Writes Firestore staffInvites/{emailLower} { email, name, phone, role:'hotel_manager', invitedBy, createdAt, claimedBy:null, claimedAt:null } AND the RTDB
 *   mirror /staffEmails/{emailKey} = 'hotel_manager'. If the RTDB write fails the invite is deleted again (compensation) and the error is returned.
 *   The manager then signs in at the Manager portal with that Google account; auth-profile.js claims the invite.
 * revokeInvite(email, actorId): deletes the invite AND the RTDB mirror (restoring the invite if the RTDB removal fails). A claimed invite cannot be revoked
 *   (the account exists — disable it instead).
 */
import { fail, guard } from '../errors.js';
import { db } from '../state.js';
import { DEFAULT_ADMIN_EMAIL } from '../config.js';
import { writeAudit } from '../audit.js';
import { setStaffEmail, removeStaffEmail } from '../staff-emails.js';
import { isEmail, isPhone, nowIso } from '../util.js';
import { adminOf } from './ctx.js';
import { runTx, getData, afterCommit, ref } from './tx.js';

const exists = (email, taken) => fail('USER_004', taken || 'An account with this email already exists.', 409);

export function checkInvite(o) {
  o = o || {};
  const name = String(o.name || '').trim(), email = String(o.email || '').trim().toLowerCase(), phone = String(o.phone || '').trim();
  if (name.length < 2) fail('VALIDATION_001', 'Full name is required.', 422);
  if (!isEmail(email)) fail('VALIDATION_001', 'Enter a valid email address.', 422);
  if (email === DEFAULT_ADMIN_EMAIL.toLowerCase() || db.users.some(u => String(u.email || '').toLowerCase() === email)) exists(email);
  if (db.staffInvites.some(i => i.email === email || i.id === email)) exists(email, 'This email has already been invited.');
  if (name.length > 120) fail('VALIDATION_001', 'Full name is too long.', 422);
  if (phone && !isPhone(phone)) fail('VALIDATION_001', 'Enter a valid phone number.', 422);
  return { name, email, phone };
}

const inviteDoc = (v, actorId) => ({ email: v.email, name: v.name, phone: v.phone, role: 'hotel_manager', invitedBy: actorId, createdAt: nowIso(), claimedBy: null, claimedAt: null });

export function inviteManager(o, actorId) {
  return guard(async () => {
    const a = adminOf(actorId); const v = checkInvite(o);
    const invite = await runTx(async tx => {
      const iRef = ref('staffInvites', v.email); const cur = await getData(tx, iRef);
      if (cur) exists(v.email, 'This email has already been invited.');
      const d = inviteDoc(v, a.id); tx.set(iRef, d); return d;
    });
    const res = await setStaffEmail(v.email, 'hotel_manager');
    if (!res.ok) { await runTx(async tx => { tx.delete(ref('staffInvites', v.email)); }).catch(e => console.warn('[aurelia] invite rollback failed', e && e.code)); return res; }
    await writeAudit(null, a.id, 'CREATE_MANAGER', 'user', v.email, null, { role: 'hotel_manager', name: v.name });
    await afterCommit([['admins', 'NEW_MANAGER_CREATED', 'New Hotel Manager invited', v.name + ' (' + v.email + ')']], () => db.staffInvites.some(i => i.email === v.email || i.id === v.email));
    return { invite: Object.assign({ id: v.email }, invite) };
  });
}

export function revokeInvite(email, actorId) {
  return guard(async () => {
    const a = adminOf(actorId); const key = String(email || '').trim().toLowerCase();
    const inv = db.staffInvites.find(i => i.email === key || i.id === key); if (!inv) fail('USER_001', 'Invitation not found.', 404);
    if (inv.claimedBy) fail('USER_004', 'This invitation has already been accepted. Disable the account instead.', 409);
    const { id, ...data } = inv;
    await runTx(async tx => {
      const iRef = ref('staffInvites', key); const cur = await getData(tx, iRef); if (!cur) fail('USER_001', 'Invitation not found.', 404);
      if (cur.claimedBy) fail('USER_004', 'This invitation has already been accepted. Disable the account instead.', 409);
      tx.delete(iRef);
    });
    const res = await removeStaffEmail(key);
    if (!res.ok) { await runTx(async tx => { tx.set(ref('staffInvites', key), data); }).catch(() => { }); return res; }
    await writeAudit(null, a.id, 'REVOKE_INVITE', 'user', key, { role: inv.role, name: inv.name }, null);
    await afterCommit([], () => !db.staffInvites.some(i => i.email === key || i.id === key));
  });
}
