/* AURELIA STAY — sendContact({ name, email, subject, message }): the public "Contact us" form. Works signed-out (rules: public create with size limits,
 * admin read). Validation = legacy field errors; failures resolve { ok:false, code:'VALIDATION_001', error:'Please fix the highlighted fields.', fields }.
 * A single create-only write (no transaction needed); capped at 15 s so an offline visitor gets an error instead of a hung button.
 *
 * Exports: sendContact, validateContact(o) -> { errors, data } (pure)
 */
import { fs, F } from '../sdk.js';
import { AppError, guard } from '../errors.js';
import { isEmail, nowIso, withTimeout } from '../util.js';

export function validateContact(o) {
  o = o || {}; const e = {};
  const name = String(o.name || '').trim(), email = String(o.email || '').trim(), subject = String(o.subject || '').trim(), message = String(o.message || '').trim();
  if (!name) e.name = 'Name is required'; else if (name.length > 100) e.name = 'Name must be 100 characters or fewer';
  if (!isEmail(email) || email.length > 200) e.email = 'Enter a valid email address';
  if (!subject) e.subject = 'Subject is required'; else if (subject.length > 150) e.subject = 'Subject must be 150 characters or fewer';
  if (!message) e.message = 'Message is required'; else if (message.length > 2000) e.message = 'Message must be 2000 characters or fewer';
  return { errors: e, data: { name, email, subject, message } };
}

export function sendContact(o) {
  return guard(async () => {
    const { errors, data } = validateContact(o);
    if (Object.keys(errors).length) throw new AppError('VALIDATION_001', 'Please fix the highlighted fields.', 422, errors);
    const r = F.doc(F.collection(fs, 'messages'));
    const ok = await withTimeout(F.setDoc(r, Object.assign({}, data, { at: nowIso() })).then(() => true), 15000, false);
    if (!ok) throw Object.assign(new Error('timeout'), { code: 'deadline-exceeded' });
    return { id: r.id };
  });
}
