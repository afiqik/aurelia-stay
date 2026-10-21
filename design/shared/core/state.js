/* AURELIA STAY — the in-memory mirror every page reads synchronously, kept live by listeners.js / notifications.js / presence.js.
 *
 * Exports:
 *   db        { roomTypes, rooms, users, bookings, roomNights, housekeeping, maintenance, notifications, audit, messages, staffInvites, presence, settings }
 *             legacy array shapes/field names. rooms[] have `status` (derived RESERVED for staff) + `storedStatus`. `presence` is a map uid -> { state, lastChanged, name, role, portal }.
 *   session   { fbUser, profile }  (NOT part of db: contract §7 says db.session is gone). profile = users/{uid} doc or null.
 *   subscribe(fn) -> unsubscribe   fn() fires after every mirror change (coalesced per microtask)
 *   emit() / emitNow()             notify subscribers (coalesced / synchronous)
 *   isStaffRole(role)  isStaffSession()
 *   user(id) room(id) roomByNo(n) type(id) booking(refOrId)     lookups; null when missing
 *   -- writers (called by listeners/auth/notifications/presence; they do NOT emit unless noted) --
 *   setSettingsDoc(doc|null) setTypeDocs(map) setRoomDocs(map)  raw overrides -> merged db.settings/roomTypes/rooms
 *   setList(name, arr)            users|bookings|roomNights|housekeeping|maintenance|audit|messages|staffInvites (sorted like the legacy engine)
 *   setNotifications(list) setPresence(map)
 *   setSession(fbUser, profile)   also re-derives rooms (role changes the RESERVED derivation)
 *   setOwnProfile(profile|null)   live update of session.profile; for non-staff also db.users = [profile]
 *   refreshDerived()              re-derive room status (day rollover / bookings change)
 *   resetPrivate()                clear everything that is not public (sign-out / role change)
 */
import { mergeSettings, mergeTypes, mergeRooms, deriveRooms } from './derive.js';
import { STAFF_ROLES } from './catalog.js';
import { today, seqOf } from './util.js';

export const db = {
  roomTypes: mergeTypes(), rooms: mergeRooms(), users: [], bookings: [], roomNights: [], housekeeping: [], maintenance: [],
  notifications: [], audit: [], messages: [], staffInvites: [], presence: {}, settings: mergeSettings()
};
export const session = { fbUser: null, profile: null };
const raw = { settings: null, roomTypes: {}, rooms: {} };

const subs = new Set();
const run = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
let queued = false;
export const emitNow = () => { queued = false; run(); };
export const emit = () => { if (queued) return; queued = true; Promise.resolve().then(() => { if (queued) emitNow(); }); };
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };

export const isStaffRole = r => STAFF_ROLES.indexOf(r) >= 0;
export const isStaffSession = () => !!(session.fbUser && session.profile && session.profile.status === 'active' && isStaffRole(session.profile.role));

export const user = id => db.users.find(u => u.id === id) || null;
export const room = id => db.rooms.find(r => r.id === Number(id)) || null;
export const roomByNo = n => db.rooms.find(r => r.number === String(n).trim()) || null;
export const type = id => db.roomTypes.find(t => t.id === Number(id)) || null;
export const booking = ref => db.bookings.find(b => b.ref === ref || b.id === ref) || null;

const desc = (k) => (a, b) => String(b[k] || '').localeCompare(String(a[k] || '')) || seqOf(b.id) - seqOf(a.id);
const SORT = {
  bookings: (a, b) => seqOf(a.id) - seqOf(b.id) || (a.id < b.id ? -1 : 1),
  users: (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || (a.id < b.id ? -1 : 1),
  housekeeping: desc('createdAt'), maintenance: desc('createdAt'), messages: desc('at'), staffInvites: desc('createdAt'),
  audit: null, roomNights: null
};

export function refreshDerived() {
  const rooms = mergeRooms(raw.rooms);
  db.rooms = isStaffSession() ? deriveRooms(rooms, db.bookings, today()) : rooms;
}
export function setSettingsDoc(doc) { raw.settings = doc || null; db.settings = mergeSettings(raw.settings); }
export function setTypeDocs(map) { raw.roomTypes = map || {}; db.roomTypes = mergeTypes(raw.roomTypes); }
export function setRoomDocs(map) { raw.rooms = map || {}; refreshDerived(); }

export function setList(name, arr) {
  if (!(name in SORT)) throw new Error('state.setList: unknown collection ' + name);
  const a = arr.slice(); if (SORT[name]) a.sort(SORT[name]);
  db[name] = a;
  if (name === 'bookings') refreshDerived();
}
export function setNotifications(list) { db.notifications = list.slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))); }
export function setPresence(map) { db.presence = map || {}; }

export function setSession(fbUser, profile) { session.fbUser = fbUser || null; session.profile = profile || null; refreshDerived(); emit(); }
export function setOwnProfile(profile) {
  session.profile = profile || null;
  if (!isStaffRole(profile && profile.role)) db.users = profile ? [profile] : [];
  refreshDerived();
}
export function resetPrivate() {
  ['users', 'bookings', 'housekeeping', 'maintenance', 'notifications', 'audit', 'messages', 'staffInvites'].forEach(k => { db[k] = []; });
  db.presence = {}; refreshDerived();
}
