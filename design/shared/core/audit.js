/* AURELIA STAY — append-only audit trail (Firestore `auditLogs/{autoId}`).
 *
 * Exports:
 *   auditEntry(actor, action, entityType, entityId, before, after, reason) -> plain doc data (no id)
 *   writeAudit(batchOrTx|null, actor, action, entityType, entityId, before, after, reason)
 *       - with a WriteBatch / Transaction: adds the doc to it and returns the entry (with `id`) SYNCHRONOUSLY — it commits with the caller's write.
 *       - with null: writes on its own; returns Promise<entry|null>. Never rejects, never hangs (4 s cap) — audit failure must not fail the operation.
 *   `actor` is a user id string or a user object ({ id }). ip is '' (client-side app has no server to observe it).
 */
import { fs, F } from './sdk.js';
import { nowIso, stripUndefined, withTimeout } from './util.js';

export function auditEntry(actor, action, entityType, entityId, before, after, reason) {
  return stripUndefined({
    at: nowIso(), actorId: actor && typeof actor === 'object' ? actor.id : actor, action, entityType, entityId: String(entityId),
    before: before || null, after: after || null, reason: reason || null, ip: '', userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, 60)
  });
}

export function writeAudit(batch, actor, action, entityType, entityId, before, after, reason) {
  const entry = auditEntry(actor, action, entityType, entityId, before, after, reason);
  const ref = F.doc(F.collection(fs, 'auditLogs'));
  const out = Object.assign({ id: ref.id }, entry);
  if (batch) { batch.set(ref, entry); return out; }
  return withTimeout(F.setDoc(ref, entry).then(() => out), 4000, null).catch(e => { console.warn('[aurelia] audit write failed', e && e.code); return null; });
}
