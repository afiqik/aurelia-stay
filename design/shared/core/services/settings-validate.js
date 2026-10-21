/* AURELIA STAY — pure validation + diffing for admin edits (no Firebase; unit-testable). Messages are the legacy ones.
 *
 * Exports:
 *   validatePrice(price, current) -> number           whole RM1..RM5000 and different from current, else throws AppError VALIDATION_001
 *   validateTypePatch(patch, type) -> { before, after }   description (>= 10 chars, <= 1000) / active (boolean); throws 'No changes to save.' when nothing changed
 *   validateSettingsPatch(patch) -> cleaned patch     only known DEFAULT_SETTINGS keys, normalised (numbers coerced), type/length checked
 *   diffSettings(patch, current) -> { before, after } only the keys that really change; throws 'No changes to save.' when empty
 */
import { fail } from '../errors.js';
import { DEFAULT_SETTINGS } from '../catalog.js';
import { isEmail } from '../util.js';

export function validatePrice(price, current) {
  const p = Number(price);
  if (!isFinite(p) || p < 1 || p > 5000 || Math.round(p) !== p) fail('VALIDATION_001', 'Price must be a whole number between RM1 and RM5000.', 422);
  if (p === current) fail('VALIDATION_001', 'Price is unchanged.', 422);
  return p;
}

export function validateTypePatch(patch, t, hasActiveBookings) {
  patch = patch || {}; const before = {}, after = {};
  if ('description' in patch) {
    const d = String(patch.description).trim();
    if (d.length < 10) fail('VALIDATION_001', 'Description must be at least 10 characters.', 422);
    if (d.length > 1000) fail('VALIDATION_001', 'Description must be 1000 characters or fewer.', 422);
    if (d !== t.description) { before.description = t.description; after.description = d; }
  }
  if ('active' in patch) {
    if (typeof patch.active !== 'boolean') fail('VALIDATION_001', 'Active must be true or false.', 422);
    if (patch.active !== t.active) {
      if (!patch.active && hasActiveBookings) fail('ROOM_002', 'This room type has active bookings.', 409);
      before.active = t.active; after.active = patch.active;
    }
  }
  if (!Object.keys(after).length) fail('VALIDATION_001', 'No changes to save.', 422);
  return { before, after };
}

const MAX = { hotelName: 200, address: 400, phone: 60, email: 200, checkInTime: 20, checkOutTime: 20 };

export function validateSettingsPatch(patch) {
  const out = {};
  Object.keys(patch || {}).forEach(k => { if (k in DEFAULT_SETTINGS) out[k] = patch[k]; });          // unknown keys (e.g. the removed failedLoginProtection) are ignored
  if ('hotelName' in out && !String(out.hotelName).trim()) fail('VALIDATION_001', 'Hotel name is required.', 422);
  if ('email' in out && !isEmail(out.email)) fail('VALIDATION_001', 'Enter a valid hotel email.', 422);
  if ('serviceFee' in out) { const f = Number(out.serviceFee); if (!isFinite(f) || f < 0 || f > 500) fail('VALIDATION_001', 'Service fee must be between RM0 and RM500.', 422); out.serviceFee = f; }
  ['adminTimeout', 'managerTimeout'].forEach(k => { if (k in out) { const v = Number(out[k]); if (!Number.isInteger(v) || v < 5 || v > 240) fail('VALIDATION_001', 'Session timeout must be 5–240 minutes.', 422); out[k] = v; } });
  Object.keys(out).forEach(k => {
    const dflt = DEFAULT_SETTINGS[k];
    if (typeof dflt === 'boolean' && typeof out[k] !== 'boolean') fail('VALIDATION_001', 'Invalid value for ' + k + '.', 422);
    if (typeof dflt === 'string') { out[k] = String(out[k]).trim(); if (out[k].length > MAX[k]) fail('VALIDATION_001', 'The value for ' + k + ' is too long.', 422); }
  });
  return out;
}

export function diffSettings(patch, current) {
  const before = {}, after = {};
  Object.keys(patch).forEach(k => { if (current[k] !== patch[k]) { before[k] = current[k]; after[k] = patch[k]; } });
  if (!Object.keys(after).length) fail('VALIDATION_001', 'No changes to save.', 422);
  return { before, after };
}
