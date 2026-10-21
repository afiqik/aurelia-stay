/* AURELIA STAY — the SYNCHRONOUS half of the public window.AureliaStore API (contract §7): reads from the in-memory mirror + pure helpers.
 * Same names and semantics as the legacy engine, so every existing page idiom (`S.db...`, `S.sessionUser('admin')`, `S.rm(n)`) keeps working.
 *
 * readApi() -> object with
 *   db (getter)                                        the live mirror (state.js): roomTypes, rooms, users, bookings, roomNights, housekeeping, maintenance,
 *                                                      notifications, audit, messages, staffInvites, presence, settings   (no `session`: use sessionUser())
 *   today addDays nightsBetween fmtDate fmtShort fmtTime fmtStamp rm ago parse isoOf          date/format helpers
 *   user room roomByNo type booking                    lookups (null when missing; `user()` only sees what the role may read)
 *   validateStay availability candidates previewRoom   stay logic on db.roomNights (availability.js)
 *   subscribe(fn) -> unsubscribe                       fires after every mirror change
 *   sessionUser(role) touch(role)                      synchronous session view (auth-session.js)
 *   notificationsFor(u)                                notification feed of a user
 *   me()                                               current active profile or null
 *   mode (getter)                                      'live' | 'emulator'  (a string; read it as S.mode)
 *   onlineUids() isOnline(uid)                         RTDB presence (staff only; empty for others)
 *   staffInvites()                                     pending/claimed staff invitations (admin only; [] for others)
 */
import { today, addDays, nightsBetween, fmtDate, fmtShort, fmtTime, fmtStamp, rm, ago, parse, isoOf } from './util.js';
import { db, subscribe, user, room, roomByNo, type, booking } from './state.js';
import { validateStay, availability, candidates, previewRoom } from './availability.js';
import { sessionUser, touch, me } from './auth-session.js';
import { notificationsFor } from './notifications.js';
import { onlineUids, isOnline } from './presence.js';
import { mode } from './sdk.js';

export function readApi() {
  return {
    get db() { return db; },
    get mode() { return mode(); },
    today, addDays, nightsBetween, fmtDate, fmtShort, fmtTime, fmtStamp, rm, ago, parse, isoOf,
    user, room, roomByNo, type, booking,
    validateStay, availability, candidates, previewRoom,
    subscribe, sessionUser, touch, me, notificationsFor,
    onlineUids, isOnline,
    staffInvites: () => { const p = me(); return p && p.role === 'admin' ? db.staffInvites : []; }
  };
}
