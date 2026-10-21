/* AURELIA STAY — the ASYNCHRONOUS half of the public window.AureliaStore API (contract §7). Every function returns
 * Promise<{ ok:true, ...data } | { ok:false, code, error, http, fields? }> and never throws to page code (each service is wrapped by errors.guard).
 * Call sites must `await` them. This file only maps names to the service modules; the rules live in services/*.js.
 *
 * writeApi() -> object with
 *   signInWithGoogle(portal) logout(role?)                                  auth.js
 *   createBooking(o) cancelBooking(ref, actorId, reason) checkIn(ref, actorId) checkOut(ref, actorId) reassignRoom(ref, roomId, actorId)   services/booking.js
 *   advanceHousekeeping(taskId, actorId) markClean(roomId, actorId)         services/housekeeping.js
 *   reportMaintenance(o, actorId) advanceMaintenance(id, actorId) setRoomStatus(roomId, status, actorId)   services/maintenance.js
 *   updatePhone(userId, phone) setUserStatus(userId, status, actorId) inviteManager({name,email,phone}, actorId) revokeInvite(email, actorId)   services/users.js
 *   setPrice(typeId, price, actorId, reason) updateType(typeId, patch, actorId) updateSettings(patch, actorId)   services/admin.js
 *   sendContact(o)                                                          services/contact.js
 *   markRead(id) markAllRead(u)                                             notifications.js
 *   loadSampleData(actorId) clearSampleData(actorId)                        services/sample.js
 */
import { signInWithGoogle, logout } from './auth.js';
import { markRead, markAllRead } from './notifications.js';
import { createBooking, cancelBooking, checkIn, checkOut, reassignRoom } from './services/booking.js';
import { advanceHousekeeping, markClean } from './services/housekeeping.js';
import { reportMaintenance, advanceMaintenance, setRoomStatus } from './services/maintenance.js';
import { updatePhone, setUserStatus, inviteManager, revokeInvite } from './services/users.js';
import { setPrice, updateType, updateSettings } from './services/admin.js';
import { sendContact } from './services/contact.js';
import { loadSampleData, clearSampleData } from './services/sample.js';

export function writeApi() {
  return {
    signInWithGoogle, logout,
    createBooking, cancelBooking, checkIn, checkOut, reassignRoom,
    advanceHousekeeping, markClean,
    reportMaintenance, advanceMaintenance, setRoomStatus,
    updatePhone, setUserStatus, inviteManager, revokeInvite,
    setPrice, updateType, updateSettings,
    sendContact, markRead, markAllRead,
    loadSampleData, clearSampleData
  };
}
