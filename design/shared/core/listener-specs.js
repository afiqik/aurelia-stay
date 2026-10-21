/* AURELIA STAY — WHAT each role listens to (contract §5). listeners.js runs the specs; this file only declares them.
 *
 * Exports:
 *   specsFor(profile|null) -> Spec[]      Spec = { key, watch(ok, err) -> unsubscribe }
 *       ok()  : call after every snapshot that was applied to state (first call == "hydrated")
 *       err(e): call on listener error (permission-denied after a role change, network, ...)
 *   effectiveRole(profile) -> 'customer'|'hotel_manager'|'admin'|null    null when signed out / profile missing / not active
 *
 *   anonymous : settings/main, roomTypes, rooms, roomNights(date >= today)
 *   customer  : + users/{uid}, bookings(customerId == uid)                                  | RTDB notifications/{uid}
 *   manager   : + users, bookings, housekeeping, maintenance, auditLogs(at desc, limit 300) | RTDB notifications/{uid}, notifications/managers, presence
 *   admin     : + messages, staffInvites                                                    | RTDB notifications/{uid}, notifications/admins, presence
 */
import { fs, F } from './sdk.js';
import * as st from './state.js';
import { today, plain } from './util.js';
import { watchNotifications, targetsFor } from './notifications.js';
import { watchPresence } from './presence.js';

const docData = d => Object.assign({ id: d.id }, plain(d.data()));
const mapOf = snap => { const m = {}; snap.forEach(d => { m[d.id] = docData(d); }); return m; };
const listOf = snap => { const a = []; snap.forEach(d => a.push(docData(d))); return a; };
const col = name => F.collection(fs, name);

const docSpec = (key, path, apply) => ({ key, watch: (ok, err) => F.onSnapshot(F.doc(fs, ...path), s => { apply(s.exists() ? docData(s) : null); ok(); }, err) });
const querySpec = (key, mk, apply) => ({ key, watch: (ok, err) => F.onSnapshot(mk(), s => { apply(s); ok(); }, err) });
const listSpec = (key, mk) => querySpec(key, mk, s => st.setList(key, listOf(s)));
const rtdbSpec = (key, watch) => ({ key, watch });

export function effectiveRole(p) { return p && p.status === 'active' && p.role ? p.role : null; }

const publicSpecs = () => [
  docSpec('settings', ['settings', 'main'], st.setSettingsDoc),
  querySpec('roomTypes', () => col('roomTypes'), s => st.setTypeDocs(mapOf(s))),
  querySpec('rooms', () => col('rooms'), s => st.setRoomDocs(mapOf(s))),
  listSpec('roomNights', () => F.query(col('roomNights'), F.where('date', '>=', today())))
];

export function specsFor(profile) {
  const role = effectiveRole(profile); const specs = publicSpecs();
  if (!role) return specs;
  const uid = profile.id;
  specs.push(docSpec('ownProfile', ['users', uid], st.setOwnProfile));
  specs.push(rtdbSpec('notifications', (ok, err) => watchNotifications(targetsFor(profile), ok, err)));
  if (role === 'customer') {
    specs.push(listSpec('bookings', () => F.query(col('bookings'), F.where('customerId', '==', uid))));
    return specs;
  }
  specs.push(listSpec('users', () => col('users')), listSpec('bookings', () => col('bookings')), listSpec('housekeeping', () => col('housekeeping')), listSpec('maintenance', () => col('maintenance')));
  specs.push(listSpec('audit', () => F.query(col('auditLogs'), F.orderBy('at', 'desc'), F.limit(300))));
  specs.push(rtdbSpec('presence', watchPresence));
  if (role === 'admin') specs.push(listSpec('messages', () => col('messages')), listSpec('staffInvites', () => col('staffInvites')));
  return specs;
}
