/* AURELIA STAY — Firestore transaction plumbing shared by the services.
 *
 * Exports:
 *   runTx(fn, opts?) -> Promise<any>   F.runTransaction with 10 attempts and a 30 s cap (offline/hung network rejects with code 'deadline-exceeded',
 *                                 which errors.js maps to SERVER_500 "Network problem"). fn(tx) must be free of side effects: the SDK re-runs it on contention.
 *                                 Rule: ALL tx.get calls first, writes after (counters.nextSeqs reads+writes, so call it last among the reads).
 *                                 opts.counters = true for transactions that bump counters/main: the security rules only accept "current value + 1", so a
 *                                 transaction that read a stale counter is answered with permission-denied (not 'aborted') and the SDK would not retry it.
 *                                 Such a denial is retried here (fresh reads, jittered delay, 6 attempts); a genuine denial still ends as PERMISSION_001.
 *   ref(...path) -> DocumentReference
 *   getData(tx, ref) -> Promise<object|null>   plain data (Timestamps -> ISO), null when the doc does not exist
 *   pushNotes(list) -> Promise<void>           after-commit RTDB notifications; list = [[to, type, title, message], ...]; best-effort, never throws
 *   settle(cond, ms = 3000) -> Promise<boolean> resolves once cond() is true in the mirror (checked on every mirror emit), or false after ms
 *   afterCommit(notes, cond?) -> Promise<void> pushNotes(notes) AND (concurrently) settle(cond): a service awaits this last, so when the page's
 *                                `await S.something()` returns, the notifications are out and S.db already shows the result (synchronous reads stay valid).
 *                                Transactions bypass the SDK's local write queue, hence the explicit wait for the listener snapshot.
 */
import { fs, F } from '../sdk.js';
import { withTimeout, plain, sleep } from '../util.js';
import { notify } from '../notifications.js';
import { subscribe } from '../state.js';

export const TX_TIMEOUT_MS = 30000;
const TIMEOUT = {};

const denied = e => !!e && /permission-denied/.test(String(e.code || ''));
const once = async fn => {
  const r = await withTimeout(F.runTransaction(fs, fn, { maxAttempts: 10 }), TX_TIMEOUT_MS, TIMEOUT);
  if (r === TIMEOUT) throw Object.assign(new Error('Transaction timed out'), { code: 'deadline-exceeded' });
  return r;
};

export async function runTx(fn, opts) {
  const tries = opts && opts.counters ? 6 : 1;
  for (let i = 1; ; i++) {
    try { return await once(fn); }
    catch (e) { if (i >= tries || !denied(e)) throw e; await sleep(40 + Math.random() * 160 * i); }
  }
}

export const ref = (...path) => F.doc(fs, ...path);

export async function getData(tx, r) {
  const s = await tx.get(r);
  return s.exists() ? plain(s.data()) : null;
}

export async function pushNotes(list) {
  await Promise.all((list || []).filter(Boolean).map(n => notify(n[0], n[1], n[2], n[3]).catch(() => null)));
}

export function settle(cond, ms) {
  return new Promise(resolve => {
    if (cond()) return resolve(true);
    let off = null;
    const t = setTimeout(() => { if (off) off(); resolve(false); }, ms || 3000);
    off = subscribe(() => { if (cond()) { clearTimeout(t); off(); resolve(true); } });
  });
}

export const afterCommit = (notes, cond) => Promise.all([pushNotes(notes), cond ? settle(cond) : null]).then(() => undefined);
