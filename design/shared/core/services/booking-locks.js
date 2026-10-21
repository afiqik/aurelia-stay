/* AURELIA STAY — roomNights: the double-booking lock + public availability index. One create-only doc per night of [checkIn, checkOut):
 *   roomNights/<roomNumber>_<YYYY-MM-DD> = { roomId, date, bookingId, typeId }   (no PII)
 * A booking can only be created in the same transaction that creates all its lock docs; an existing doc means "night taken" (rules forbid updates).
 *
 * Exports:
 *   lockRef(roomId, date)                         DocumentReference
 *   lockData(roomId, date, bookingId, typeId)     the doc body
 *   readLocks(tx, roomId, dates) -> Promise<[{ date, ref, exists, bookingId }]>   one tx.get per night (parallel)
 *   createLocks(tx, roomId, dates, bookingId, typeId)   tx.set for every night (call after ALL reads)
 *   deleteLocks(tx, locks, bookingId?)            tx.delete the existing ones (only those owned by bookingId when given)
 *   fromToday(dates) -> string[]                  nights that are today or later (the nights an early check-out gives back)
 */
import { fs, F } from '../sdk.js';
import { nightId } from '../availability.js';
import { today } from '../util.js';

export const lockRef = (roomId, date) => F.doc(fs, 'roomNights', nightId(roomId, date));
export const lockData = (roomId, date, bookingId, typeId) => ({ roomId: Number(roomId), date, bookingId, typeId: Number(typeId) });

export async function readLocks(tx, roomId, dates) {
  return Promise.all(dates.map(async date => {
    const r = lockRef(roomId, date); const s = await tx.get(r);
    return { date, ref: r, exists: s.exists(), bookingId: s.exists() ? s.data().bookingId : null };
  }));
}

export function createLocks(tx, roomId, dates, bookingId, typeId) {
  dates.forEach(d => tx.set(lockRef(roomId, d), lockData(roomId, d, bookingId, typeId)));
}

export function deleteLocks(tx, locks, bookingId) {
  locks.forEach(l => { if (l.exists && (!bookingId || l.bookingId === bookingId)) tx.delete(l.ref); });
}

export const fromToday = dates => { const t = today(); return dates.filter(d => d >= t); };
