/* AURELIA STAY — stored room status helpers (rooms/{number} = { status, updatedAt, sample }). RESERVED is derived and NEVER stored (contract §6).
 * `sample:false` is written by every real operation so that clearSampleData() can tell which rooms still carry demo-data state (see sample.js).
 *
 * Exports:
 *   roomRef(number)                          DocumentReference of rooms/{number}
 *   readStoredStatus(tx, number) -> Promise<string>   stored status in a transaction ('AVAILABLE' when the doc is absent/unknown)
 *   writeRoomStatus(tx, number, status)      tx.set(rooms/{number}, { status, updatedAt, sample:false }, merge)
 *   label(status) -> 'out of service'        lower-case human form used in error messages
 */
import { fs, F } from '../sdk.js';
import { ROOM_STATUSES } from '../catalog.js';
import { nowIso } from '../util.js';

export const roomRef = number => F.doc(fs, 'rooms', String(number));
export const label = s => String(s).replace(/_/g, ' ').toLowerCase();

export async function readStoredStatus(tx, number) {
  const s = await tx.get(roomRef(number));
  const st = s.exists() ? s.data().status : null;
  return ROOM_STATUSES.indexOf(st) >= 0 ? st : 'AVAILABLE';
}

export function writeRoomStatus(tx, number, status) {
  tx.set(roomRef(number), { status, updatedAt: nowIso(), sample: false }, { merge: true });
}
