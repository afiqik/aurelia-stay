/* AURELIA STAY — shared guards for every service: who is calling, and are they allowed to. Synchronous, reads the session only.
 * Client-side checks give fast, readable errors (legacy messages); the security rules remain the real enforcement.
 *
 * Exports:
 *   actorOf(actorId)   -> profile   signed-in active profile whose id === actorId, else AUTH_001 'Authentication required.' (401)
 *   isStaff(profile)   -> boolean
 *   staffOf(actorId)   -> profile   + PERMISSION_001 'Forbidden.' unless hotel_manager | admin
 *   adminOf(actorId)   -> profile   + PERMISSION_001 'Forbidden.' unless admin
 */
import { fail } from '../errors.js';
import { me } from '../auth-session.js';
import { isStaffRole } from '../state.js';

export const isStaff = u => !!u && isStaffRole(u.role);

export function actorOf(id) {
  const p = me();
  if (!id || !p || p.id !== id) fail('AUTH_001', 'Authentication required.', 401);
  return p;
}
export function staffOf(id) { const a = actorOf(id); if (!isStaff(a)) fail('PERMISSION_001', 'Forbidden.', 403); return a; }
export function adminOf(id) { const a = actorOf(id); if (a.role !== 'admin') fail('PERMISSION_001', 'Forbidden.', 403); return a; }
