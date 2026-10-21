/* AURELIA STAY — error model + result objects. Mutations never throw to page code; they resolve to a result object:
 *   { ok: true, ...data }  |  { ok: false, code, error, http, fields? }
 *
 * Exports:
 *   class AppError(code, message, http = 400, fields?)       thrown inside services, converted by guard()/fromFirebase()
 *   fail(code, msg, http?, fields?)                          throw new AppError(...)
 *   okResult(data?)                                          { ok: true, ...data }
 *   errResult(code, error, http = 400, fields?)              { ok: false, code, error, http[, fields] }
 *   fromFirebase(err)                                        any thrown value -> error result (permission-denied -> PERMISSION_001 'Forbidden.', network -> SERVER_500)
 *   fromAuthError(err)                                       Firebase Auth popup/credential errors -> friendly error result (AUTH_00x)
 *   guard(fn)                                                async wrapper: result of fn() (object with boolean `ok` passes through; other objects are merged into { ok: true }; throws -> error result)
 *
 * Codes added on top of the legacy set (documented in the task result): AUTH_007 unverified Google email, AUTH_008 popup blocked, AUTH_009 sign-in cancelled.
 */

export class AppError extends Error {
  constructor(code, message, http, fields) { super(message); this.code = code; this.http = http || 400; if (fields) this.fields = fields; }
}
export const fail = (code, msg, http, fields) => { throw new AppError(code, msg, http, fields); };

export const okResult = data => Object.assign({ ok: true }, data || {});
export const errResult = (code, error, http, fields) => {
  const r = { ok: false, code, error, http: http || 400 };
  if (fields) r.fields = fields;
  return r;
};

const NETWORK = ['unavailable', 'deadline-exceeded', 'cancelled', 'network-request-failed'];
const BUSY = ['aborted', 'resource-exhausted'];
const codeOf = err => String((err && err.code) || '').replace(/^(auth|firestore|database|functions)\//, '');

export function fromFirebase(err) {
  if (err instanceof AppError) return errResult(err.code, err.message, err.http, err.fields);
  const c = codeOf(err);
  if (c === 'permission-denied' || c === 'unauthenticated' || /permission[_ -]denied/i.test((err && err.message) || '')) return errResult('PERMISSION_001', 'Forbidden.', 403);
  if (NETWORK.indexOf(c) >= 0) return errResult('SERVER_500', 'Network problem. Please check your connection and try again.', 503);
  if (BUSY.indexOf(c) >= 0) return errResult('SERVER_500', 'The system is busy. Please try again in a moment.', 503);
  console.error(err);
  return errResult('SERVER_500', 'Something went wrong.', 500);
}

export function fromAuthError(err) {
  const c = codeOf(err);
  if (c === 'popup-blocked') return errResult('AUTH_008', 'Your browser blocked the Google sign-in window. Please allow pop-ups for this site and try again.', 400);
  if (c === 'popup-closed-by-user' || c === 'cancelled-popup-request') return errResult('AUTH_009', 'Sign-in was cancelled.', 400);
  if (c === 'user-disabled') return errResult('AUTH_003', 'This account has been disabled. Please contact the hotel.', 403);
  if (c === 'unauthorized-domain') return errResult('SERVER_500', 'This website address is not authorised for Google sign-in yet.', 500);
  if (c === 'network-request-failed') return errResult('SERVER_500', 'Network problem. Please check your connection and try again.', 503);
  return fromFirebase(err);
}

export async function guard(fn) {
  try {
    const r = await fn();
    if (r && typeof r === 'object' && typeof r.ok === 'boolean') return r;
    return okResult(r);
  } catch (err) { return fromFirebase(err); }
}
