/* AURELIA STAY — Firestore profile bootstrap/claim after a Google sign-in (contract §3). Pure data flow, no UI, no listeners.
 *
 * Exports:
 *   PORTALS                                   { customer: 'Customer', hotel_manager: 'Manager', admin: 'Admin' }
 *   loadProfile(uid) -> Promise<profile|null> users/{uid}
 *   portalError(portal, role) -> errResult|null   role/portal matching (AUTH_004 customer portal + staff account, AUTH_006 staff portal + wrong account)
 *   bootstrapProfile(fbUser, portal) -> Promise<{ ok:true, profile, isNew, needsProfile } | { ok:false, code, error, http }>
 *       email = fbUser.email lowercased and fbUser.emailVerified === true are required (else AUTH_007).
 *       1. users/{uid} exists  -> portal check, disabled check (AUTH_003), refresh lastLoginAt (+ blank name/photoURL from Google)
 *       2. default admin email -> create { role:'admin', primary:true }
 *       3. staffInvites/{email} -> create { role: invite.role, name: invite.name || Google name, phone: invite.phone } and mark the invite claimed
 *       4. otherwise           -> create { role:'customer' } (phone empty => needsProfile)
 *       The role the profile WOULD get is matched against the portal BEFORE anything is created: a rejected sign-in creates nothing.
 *   May throw Firebase errors (caller converts with fromFirebase and signs out).
 */
import { fs, F } from './sdk.js';
import { DEFAULT_ADMIN_EMAIL } from './config.js';
import { errResult } from './errors.js';
import { writeAudit } from './audit.js';
import { notify } from './notifications.js';
import { nowIso, plain, withTimeout } from './util.js';

const ADMIN = DEFAULT_ADMIN_EMAIL.toLowerCase();
export const PORTALS = { customer: 'Customer', hotel_manager: 'Manager', admin: 'Admin' };
const isStaff = r => r === 'hotel_manager' || r === 'admin';

export function portalError(portal, role) {
  if (role === portal) return null;
  if (portal === 'customer') return errResult('AUTH_004', 'This Google account is a staff account. Please use the Manager or Admin portal.', 403);
  return errResult('AUTH_006', 'This Google account is not authorised for the ' + PORTALS[portal] + ' portal. Ask an administrator to add your Google email.', 403);
}
const disabled = role => errResult('AUTH_003', isStaff(role) ? 'This account is disabled. Contact the system administrator.' : 'This account has been disabled. Please contact the hotel.', 403);

export async function loadProfile(uid) {
  const s = await F.getDoc(F.doc(fs, 'users', uid));
  return s.exists() ? Object.assign({ id: s.id }, plain(s.data())) : null;
}

async function readInvite(email) {
  try {
    const s = await F.getDoc(F.doc(fs, 'staffInvites', email));
    return s.exists() ? plain(s.data()) : null;
  } catch (e) { if (e && e.code === 'permission-denied') return null; throw e; }
}

async function refreshExisting(ref, p, fbUser) {
  const now = nowIso(); const patch = { lastLoginAt: now, updatedAt: now };
  if (!p.name && fbUser.displayName) patch.name = fbUser.displayName;
  if (!p.photoURL && fbUser.photoURL) patch.photoURL = fbUser.photoURL;
  try { await withTimeout(F.updateDoc(ref, patch), 4000); } catch (e) { console.warn('[aurelia] profile refresh skipped', e && e.code); }
  return Object.assign({}, p, patch);
}

export async function bootstrapProfile(fbUser, portal) {
  const email = String(fbUser.email || '').trim().toLowerCase();
  if (!email || fbUser.emailVerified !== true) return errResult('AUTH_007', 'Your Google email address is not verified. Please verify it with Google and try again.', 403);
  const uid = fbUser.uid; const ref = F.doc(fs, 'users', uid);
  const snap = await F.getDoc(ref);

  if (snap.exists()) {
    const p = Object.assign({ id: uid }, plain(snap.data()));
    const bad = portalError(portal, p.role); if (bad) return bad;
    if (p.status && p.status !== 'active') return disabled(p.role);
    const profile = await refreshExisting(ref, p, fbUser);
    return { ok: true, profile, isNew: false, needsProfile: !profile.phone };
  }

  let role = 'customer', invite = null;
  if (email === ADMIN) role = 'admin';
  else { invite = await readInvite(email); if (invite && invite.role === 'hotel_manager') role = 'hotel_manager'; else invite = null; }
  const bad = portalError(portal, role); if (bad) return bad;

  const now = nowIso(); const googleName = fbUser.displayName || email.split('@')[0];
  const profile = {
    id: uid, role, name: (invite && invite.name) || googleName, email, photoURL: fbUser.photoURL || '', phone: (invite && invite.phone) || '',
    googleUid: uid, status: 'active', authProvider: 'google', createdAt: now, lastLoginAt: now, updatedAt: now
  };
  if (email === ADMIN) profile.primary = true;
  await F.setDoc(ref, profile);

  if (invite && !invite.claimedBy) F.updateDoc(F.doc(fs, 'staffInvites', email), { claimedBy: uid, claimedAt: now }).catch(e => console.warn('[aurelia] invite claim failed', e && e.code));
  writeAudit(null, uid, role === 'customer' ? 'CUSTOMER_REGISTERED' : 'STAFF_REGISTERED', 'user', uid, null, { email, provider: 'google', role });
  if (role === 'customer') notify(uid, 'CUSTOMER_REGISTERED', 'Welcome to AURELIA STAY', 'Your account is ready. Add your phone number to start booking.');
  return { ok: true, profile, isNew: true, needsProfile: !profile.phone };
}
