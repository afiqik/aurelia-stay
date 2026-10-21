/* AURELIA STAY — RTDB mirror of staff identity: /staffEmails/{emailKey} = 'hotel_manager' | 'admin'.
 * Realtime Database rules cannot read Firestore, so they decide "is staff" from this node (plus the hard-coded default admin).
 * Admins write it when they invite / revoke / disable / re-enable a manager (services/users.js). emailKey = util.emailKey (lowercase, '.' -> ',').
 *
 * Exports (all resolve to a result object, never throw, 4 s cap):
 *   setStaffEmail(email, role)    -> Promise<result>   role defaults to 'hotel_manager'
 *   removeStaffEmail(email)       -> Promise<result>
 */
import { rtdb, R } from './sdk.js';
import { emailKey, isEmail, withTimeout } from './util.js';
import { okResult, errResult, fromFirebase } from './errors.js';

const ROLES = ['hotel_manager', 'admin'];
const bad = () => errResult('VALIDATION_001', 'Please enter a valid Google email address.', 422);
const ref = email => R.ref(rtdb, 'staffEmails/' + emailKey(email));

export async function setStaffEmail(email, role) {
  role = role || 'hotel_manager';
  if (!isEmail(email) || ROLES.indexOf(role) < 0) return bad();
  try { await withTimeout(R.set(ref(email), role), 4000); return okResult(); } catch (e) { return fromFirebase(e); }
}

export async function removeStaffEmail(email) {
  if (!isEmail(email)) return bad();
  try { await withTimeout(R.remove(ref(email)), 4000); return okResult(); } catch (e) { return fromFirebase(e); }
}
