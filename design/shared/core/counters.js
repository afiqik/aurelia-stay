/* AURELIA STAY — sequence counters in Firestore `counters/main` { booking, hk, req } (each holds the NEXT number; missing => 1).
 *
 * Exports:
 *   nextSeq(tx, key)            -> Promise<number>   reserve the next number for 'booking' | 'hk' | 'req' inside a Firestore transaction
 *   nextSeqs(tx, keys[])        -> Promise<{ [key]: number }>   several keys with ONE read and ONE write
 *   idOf(key, n)                -> 'b12' | 'HK-0031' | 'REQ-0012'
 *
 * IMPORTANT: Firestore transactions require all reads before all writes — call nextSeq/nextSeqs BEFORE any tx.set/update/delete.
 * Each key is incremented by exactly 1 (the security rules only allow that); concurrent bookings contend and the SDK retries the transaction.
 */
import { fs, F } from './sdk.js';

export const KEYS = ['booking', 'hk', 'req'];
export const idOf = (key, n) => key === 'booking' ? 'b' + n : (key === 'hk' ? 'HK-' : 'REQ-') + String(n).padStart(4, '0');

export async function nextSeqs(tx, keys) {
  const ref = F.doc(fs, 'counters', 'main');
  const snap = await tx.get(ref); const cur = snap.exists() ? snap.data() : {};
  const out = {}, patch = {};
  keys.forEach(k => {
    if (KEYS.indexOf(k) < 0) throw new Error('counters: unknown key ' + k);
    const n = Math.max(1, Math.floor(Number(cur[k])) || 1); out[k] = n; patch[k] = n + 1;
  });
  tx.set(ref, patch, { merge: true });
  return out;
}
export const nextSeq = async (tx, key) => (await nextSeqs(tx, [key]))[key];
