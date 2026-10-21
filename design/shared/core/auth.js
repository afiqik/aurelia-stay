/* AURELIA STAY — Google-only authentication (contract §3). Orchestrates: popup sign-in -> profile bootstrap -> presence -> role-scoped listeners.
 * Profile logic lives in auth-profile.js, the synchronous session view + idle timeout in auth-session.js.
 *
 * Exports:
 *   initAuth() -> Promise<void>     subscribe to onAuthStateChanged ONCE; resolves after the first auth state was fully handled
 *                                   (profile loaded, presence started, listeners hydrated). Later changes (sign-in/out in another tab, disabled
 *                                   account) re-create/tear down listeners and emit through state.subscribe.
 *   signInWithGoogle(portal) -> Promise<{ ok:true, user, isNew, needsProfile } | { ok:false, code, error, http }>
 *                                   portal 'customer' | 'hotel_manager' | 'admin'. signInWithPopup is the very first async call (popup blockers).
 *                                   Admin portal passes login_hint = DEFAULT_ADMIN_EMAIL. Rejected sign-ins (AUTH_003/004/006/007) sign out again.
 *   logout(role?) -> Promise<{ ok:true }>   presence offline + LOGOUT audit (both capped), signOut. If `role` is given and the signed-in profile has a
 *                                   different role this is a no-op (the legacy store kept the three portals' sessions apart; Firebase has ONE session).
 *   testSignIn(email, name, portal) -> Promise<result>   EMULATOR ONLY (errors in live mode): signInWithCredential with a fake Google id token, then the normal bootstrap.
 *   sessionUser(role) touch(role) me()    re-exported from auth-session.js (synchronous)
 */
import { auth, A, mode } from './sdk.js';
import { DEFAULT_ADMIN_EMAIL } from './config.js';
import { errResult, fromAuthError, fromFirebase } from './errors.js';
import { db, session, setSession, subscribe } from './state.js';
import { startListeners } from './listeners.js';
import { goOnline, goOffline, stopPresence } from './presence.js';
import { writeAudit } from './audit.js';
import { bootstrapProfile, loadProfile, PORTALS } from './auth-profile.js';
import { sessionUser, touch, me, markActive, clearActive, setExpireHandler } from './auth-session.js';
import { sleep, withTimeout } from './util.js';

export { sessionUser, touch, me };

let busy = 0, started = null, ready = false, chain = Promise.resolve();

async function activate(user, profile) {
  setSession(user, profile);
  if (profile) goOnline(profile); else stopPresence();
  await startListeners(profile);
}
async function deactivate() {
  stopPresence(); setSession(null, null);
  await startListeners(null);
}
const quietSignOut = () => A.signOut(auth).catch(e => console.warn('[aurelia] signOut failed', e && e.code));

async function handle(user) {
  if (busy) return;                                   // an interactive sign-in is running; it finishes the job itself
  if (!user) { if (session.fbUser || !ready) await deactivate(); return; }
  if (session.fbUser && session.fbUser.uid === user.uid && session.profile) { session.fbUser = user; return; }
  let profile = null;                                 // retry briefly: another tab may still be creating the profile
  for (let i = 0; i < 4 && !profile; i++) {
    try { profile = await loadProfile(user.uid); } catch (e) { console.warn('[aurelia] profile load failed', e && e.code); break; }
    if (!profile) await sleep(600);
  }
  if (profile && profile.status !== 'active') { await quietSignOut(); await deactivate(); return; }
  await activate(user, profile);
}

export function initAuth() {
  if (started) return started;
  setExpireHandler(role => logout(role, true));
  let forcing = false;
  subscribe(() => {                                   // an admin disabled this account while it is signed in
    const p = session.profile;
    if (!forcing && session.fbUser && p && p.status && p.status !== 'active') { forcing = true; logout(undefined, true).then(() => { forcing = false; }); }
  });
  started = new Promise(resolve => {
    let first = true;
    A.onAuthStateChanged(auth, user => {
      chain = chain.then(() => handle(user)).catch(e => console.error('[aurelia] auth state', e)).then(() => { ready = true; if (first) { first = false; resolve(); } });
    });
  });
  return started;
}

async function completeSignIn(user, portal) {
  let res;
  try { res = await bootstrapProfile(user, portal); } catch (e) { res = fromFirebase(e); }
  if (!res.ok) { await quietSignOut(); await deactivate(); return res; }
  markActive(user.uid); if (typeof window !== 'undefined') window.__aureliaSigningOut = false;
  await activate(user, res.profile);
  if (res.profile.role !== 'customer') writeAudit(null, res.profile.id, 'LOGIN', 'user', res.profile.id);
  return { ok: true, user: res.profile, isNew: res.isNew, needsProfile: res.needsProfile };
}

async function finish(popup, portal) {
  try { const cred = await popup; return await completeSignIn(cred.user, portal); }
  catch (e) { return fromAuthError(e); }
  finally { busy--; }
}

export function signInWithGoogle(portal) {
  portal = portal || 'customer';
  if (!PORTALS[portal]) return Promise.resolve(errResult('VALIDATION_001', 'Unknown sign-in portal.', 422));
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters(portal === 'admin' ? { prompt: 'select_account', login_hint: DEFAULT_ADMIN_EMAIL } : { prompt: 'select_account' });
  busy++;
  return finish(A.signInWithPopup(auth, provider), portal);   // first async call: must stay in the click handler's synchronous stack
}

const stableSub = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return 'test-' + h.toString(16) + s.length; };

export function testSignIn(email, name, portal) {
  if (mode() !== 'emulator') return Promise.resolve(errResult('SERVER_500', 'Test sign-in is only available against the emulators.', 500));
  email = String(email || '').trim().toLowerCase(); busy++;
  const token = JSON.stringify({ sub: stableSub(email), email, email_verified: true, name: name || email.split('@')[0] });
  return finish(A.signInWithCredential(auth, A.GoogleAuthProvider.credential(token)), portal || 'customer');
}

export async function logout(role, forced) {   // forced = internal sign-out (idle timeout / disabled account): the page must still redirect itself
  const p = session.profile;
  if (role && p && p.role !== role) return { ok: true };
  if (typeof window !== 'undefined') window.__aureliaSigningOut = !forced;   // user-initiated: lets U.watchSession skip its redirect while the page navigates itself
  const user = auth.currentUser;
  if (user && p) await withTimeout(Promise.all([goOffline(), writeAudit(null, p.id, 'LOGOUT', 'user', p.id)]), 4500).catch(() => { });
  stopPresence(); if (user) clearActive(user.uid);
  try { await A.signOut(auth); } catch (e) { return fromAuthError(e); }
  if (session.fbUser) await deactivate();
  return { ok: true };
}
