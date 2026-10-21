// Realtime Database fixtures: staff mirror, notification factory, tiny ref/get/set wrappers.
import { ref, set, get, update, remove, push, serverTimestamp } from 'firebase/database';
import { setLogLevel } from 'firebase/app';
import { P, seed, dbOf, assertSucceeds, assertFails } from './helpers.js';

setLogLevel('error'); // denied writes make the database SDK log permission_denied warnings; they are expected here

export { ref, set, get, update, remove, push, serverTimestamp, dbOf, assertSucceeds, assertFails };

/** Same transform as util.emailKey in the app: lowercase, every '.' -> ','. */
export const emailKey = e => String(e).toLowerCase().replace(/\./g, ',');

/** Arrange the staff mirror: managers (and an optional second 'admin') present, disabled manager absent, like after admin actions. */
export async function seedStaff(env, extra) {
  await seed(env, async (fs, rtdb) => {
    await set(ref(rtdb, 'staffEmails/' + emailKey(P.mgr.email)), 'hotel_manager');
    await set(ref(rtdb, 'staffEmails/' + emailKey(P.mgr2.email)), 'hotel_manager');
    for (const [email, role] of Object.entries(extra || {})) await set(ref(rtdb, 'staffEmails/' + emailKey(email)), role);
  });
}

/** A second administrator as it could exist in staffEmails (the default admin is hard-coded in the rules). */
export const adm2 = { uid: 'adm2', email: 'second.admin@gmail.com', role: 'admin', name: 'Second Admin' };

export const notif = over => Object.assign({
  type: 'NEW_BOOKING', title: 'New online booking AUR-2026-00001', message: 'Cust One - Standard - Room 101', at: new Date().toISOString(), read: false, from: P.cust.uid
}, over || {});

export const rdb = (env, p, claims) => dbOf(env, p, claims);
export const at = (db, path) => ref(db, path);
export const put = (db, path, v) => set(ref(db, path), v);
export const read = (db, path) => get(ref(db, path));

/** Pre-existing notification written with rules disabled; returns its push id. */
export async function seedNotif(env, target, over) {
  let id;
  await seed(env, async (fs, rtdb) => {
    const r = push(ref(rtdb, 'notifications/' + target));
    id = r.key; await set(r, notif(over));
  });
  return id;
}
