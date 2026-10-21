# AURELIA STAY — Firebase architecture (binding contract)

Project: `zyphora-dfe10` · Web app id `1:508512229373:web:9893142fd1eae5679c2b94` · Firestore `(default)` (nam5) · RTDB `https://zyphora-dfe10-default-rtdb.firebaseio.com` · both databases were freshly created and are empty.
Original (pre-Firebase) project copy for parity checks: `SCRATCH/design-original/` (path is given in each agent prompt). The old engine is also at `docs/legacy-aurelia-store.js.txt`.

The project is a **static front-end** (no build step, no server, no Cloud Functions — Spark plan). Pages are `.dc.html` files rendered by `design/support.js` (do **not** edit any `support.js`). All business logic runs client-side; **security is enforced by Firestore/RTDB security rules**.

## 0. Hard rules for everyone

1. **Modular.** Never put everything in one file. One responsibility per file, target ≤ 300 lines/file (hard max 400). Page logic that is shared lives in the portal's `*-app.js`; if that grows past the limit, split into `design/<portal>/app/*.js` modules and keep `*-app.js` as a thin aggregator.
2. Match surrounding style (2-space indent, single quotes, `const`, terse arrow fns, same comment density). No TypeScript, no build tools, no npm packages in the browser.
3. **Do not change the visual design** (colours, fonts, layout, copy) except where this contract demands it (Google-only sign-in, removal of password UI).
4. `support.js` files are generated — never touch. Do not touch `design/uploads/**`.
5. Never write secrets. The Firebase web config in `core/config.js` is public by design.
6. All dates stay ISO strings (`YYYY-MM-DD` for dates, full ISO for timestamps) — **never** store/expose Firestore `Timestamp` objects to page code.
7. Production Firebase project is `zyphora-dfe10`. **Tests and experiments must use the emulators with project id `demo-aurelia`** (see §9). Do not run `firebase deploy` and do not write to the live project — the lead does that.

## 1. Runtime model

* Pages include **only** `../shared/aurelia-store.js` (classic script, unchanged `<script src>` in every page `<helmet>`; the dc runtime injects helmet scripts **async, in no guaranteed order**).
* `design/shared/aurelia-store.js` becomes a ~40-line **bootstrap**: it `import('./core/index.js')` (ES modules resolve relative to the script URL), awaits `createStore()`, and **only then** assigns `window.AureliaStore`. It also exposes `window.AureliaStoreReady` (Promise) and, if boot fails (offline / blocked CDN), `window.AureliaStoreError = Error` and shows a small fixed error banner with a Retry link. It must also emit `window.dispatchEvent(new Event('aurelia-store-ready'))`.
* **Because `window.AureliaStore` only exists after Firebase Auth state is resolved and the first listener snapshots are in, every existing page idiom keeps working unchanged:** pages poll `window.AureliaStore && window.AureliaUI`, then call `S.sessionUser(...)` / read `S.db...` **synchronously**. Do not break this.
* **Reads are synchronous** from an in-memory mirror (`S.db`) kept live by Firestore `onSnapshot` + RTDB `onValue` listeners; `S.subscribe(fn)` fires on every mirror change (listener updates, latency-compensated local writes, auth changes). **Mutations are asynchronous** and return `Promise<{ ok: true, ...data } | { ok: false, code, error, http, fields? }>` — same result shape as before, same error codes/messages (`AUTH_00x`, `VALIDATION_001`, `BOOKING_00x`, `ROOM_00x`, `PERMISSION_001`, `USER_00x`). Firebase `permission-denied` → `{ok:false, code:'PERMISSION_001', error:'Forbidden.'}`; network errors → `SERVER_500`.
* Mutations never throw to page code. Page call sites must `await` them.

## 2. Module layout (`design/shared/core/`)

| File | Responsibility |
|---|---|
| `config.js` | **(exists)** SDK version/CDN base, `FIREBASE_CONFIG`, `DEFAULT_ADMIN_EMAIL`, emulator flag/ports. |
| `sdk.js` | Dynamic `import()` of the modular Firebase SDK from `SDK_BASE` (`firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`, `firebase-database.js`), `initializeApp`, `getAuth/getFirestore/getDatabase`, connects emulators when `emulatorEnabled()`. Exports `{ app, auth, fs, rtdb, A, F, R }` (A/F/R = the auth/firestore/database module namespaces). Single place that knows the CDN. |
| `util.js` | Pure helpers moved from the old store: `pad, isoOf, parse, today, addDays, nightsBetween, fmtDate, fmtShort, fmtTime, fmtStamp, rm, ago, refOf, emailKey(email)` (lowercase, `.`→`,`), `isEmail`, `isPhone`. |
| `catalog.js` | Static catalogue: `AMEN`, `TYPES` (4 room types), `ROOMS` (20 fixed rooms 101-106, 201-208, 301-304, 401-402 with `typeId`, `floor`), `DEFAULT_SETTINGS`. See §4 "defaults + overrides". |
| `errors.js` | `AppError`, `fail(code,msg,http)`, `okResult/errResult`, `fromFirebase(err)` mapping, `guard(fn)` wrapper that converts thrown errors to result objects. |
| `state.js` | The mirror `db` (`{roomTypes, rooms, users, bookings, roomNights, housekeeping, maintenance, notifications, audit, messages, staffInvites, presence, settings, session}`), `subscribe/emit`, derived room status (§6), lookup helpers (`user, room, roomByNo, type, booking`). |
| `listeners.js` | Role-scoped listener manager: `start(profile)` / `stop()`; resolves a "first snapshot of everything this role needs" promise. Table in §5. |
| `auth.js` | Google sign-in/out, `onAuthStateChanged` bootstrap, profile bootstrap/claim (§3), `sessionUser(role)`, `touch(role)` idle timeout, `logout`. |
| `presence.js` | RTDB presence with `onDisconnect`. |
| `notifications.js` | RTDB notification feed: `notify(to, type, title, message)`, `notificationsFor(u)`, `markRead`, `markAllRead`. |
| `audit.js` | `writeAudit(batchOrNull, actor, action, entityType, entityId, before, after, reason)` → adds an `auditLogs` doc (inside the caller's batch/transaction when given). |
| `availability.js` | `validateStay`, `roomFree`, `candidates`, `availability`, `previewRoom` using `db.roomNights` + `db.rooms`. |
| `counters.js` | `nextSeq(tx, key)` via `counters/main` inside a transaction. |
| `services/booking.js` | `createBooking`, `cancelBooking`, `checkIn`, `checkOut`, `reassignRoom` (transactions + roomNights locks). |
| `services/housekeeping.js` | `advanceHousekeeping`, `markClean`. |
| `services/maintenance.js` | `reportMaintenance`, `advanceMaintenance`, `setRoomStatus`. |
| `services/users.js` | `updatePhone`, `setUserStatus`, `inviteManager`, `revokeInvite`, (`unlockUser` removed). |
| `services/admin.js` | `setPrice`, `updateType`, `updateSettings`. |
| `services/contact.js` | `sendContact` (public, unauthenticated write to `messages`). |
| `services/sample.js` | `loadSampleData(actorId)`, `clearSampleData(actorId)` (admin only, `sample:true` docs). |
| `index.js` | `createStore()` — wires everything into the public `AureliaStore` object (§7) and returns it. |

Tests live in `design/tests/` (browser test page, §9) and `rules-tests/` (rules unit tests).

## 3. Authentication — Google only, three roles

* **Only provider: Google** (`GoogleAuthProvider`, `signInWithPopup`; `auth/popup-blocked` → friendly message). No email/password anywhere. Remove all password UI (staff login forms, "Forgot password", temporary password, lockout, unlock, "Failed-login protection" toggle).
* Role is stored in Firestore `users/{uid}.role` ∈ `customer | hotel_manager | admin`. Security rules and the client both derive authorisation from it.
* **Sign-in entry points** call `S.signInWithGoogle(portal)` with `portal` ∈ `'customer' | 'hotel_manager' | 'admin'` (customer site Login page → `'customer'`, `manager/Login` → `'hotel_manager'`, `admin/Login` → `'admin'`). The admin portal passes `login_hint = DEFAULT_ADMIN_EMAIL` to Google (account chooser pre-selects it) and the admin Login page shows the default administrator email as a hint.
* **Profile bootstrap after Google sign-in** (`auth.js`), with `email = user.email.toLowerCase()` and `email_verified === true` required:
  1. `users/{uid}` exists → use it (refresh `lastLoginAt`, `name`/`photoURL` from Google if blank).
  2. Else if `email === DEFAULT_ADMIN_EMAIL` → create `{role:'admin', primary:true}`.
  3. Else if `staffInvites/{email}` exists → create `{role: invite.role ('hotel_manager'), name: invite.name || google name, phone: invite.phone||''}` and mark the invite `claimedBy/claimedAt`.
  4. Else → create `{role:'customer'}` (phone empty → `needsProfile: true`).
* **Portal/role matching:** the signed-in profile's role must equal the portal's role, otherwise sign out and return `{ok:false}` with a clear message: customer-portal sign-in by a staff account → `AUTH_004` "This Google account is a staff account. Please use the Manager or Admin portal."; staff portal sign-in by a non-staff account → `AUTH_006` "This Google account is not authorised for the {Manager|Admin} portal. Ask an administrator to add your Google email." (do NOT create a customer profile for it when the portal is a staff portal — check invites first and only create the profile if allowed; in that case the user is simply signed out). Disabled profile → `AUTH_003` and sign out.
* `S.sessionUser(role)` stays **synchronous**: returns the profile only if a Firebase user is signed in, profile role === `role`, status active; for staff roles returns `{expired:true}` once the idle time since the last `touch(role)` exceeds `settings.adminTimeout|managerTimeout` minutes (and then signs out in the background). Idle clock is per-uid in `localStorage` (`aurelia-active-<uid>`). Customers never expire.
* `S.logout(role)` is async: clears presence, `signOut`, returns `{ok:true}`. Call sites `await` it before navigating.
* Admin cannot demote/disable themselves; the primary admin (the default admin email) can never be disabled (also enforced in rules).
* Staff are provisioned by admins: Admin → "Create Manager" now **adds a Google email invitation** (name, Google email, phone — **no password**). The manager signs in at the Manager portal with that Google account. Invitations listed on the admin Users page with an "Invited" badge until claimed.
* Auth state change (sign-in/out in another tab) → store tears down/re-creates listeners and emits; if the current page was an authenticated page it will redirect via its guard on the next `subscribe` tick — page guards must therefore also re-check on `subscribe` where cheap (see §10).

## 4. Firestore data model

All docs use ISO-string dates/timestamps. "defaults + overrides": the catalogue (4 types, 20 rooms, default settings) is **static in `catalog.js`**, so the public site works with a completely empty database; Firestore only holds the dynamic/overridden parts, and the mirror merges them (doc present → override field-by-field; absent → default). Admin edits and staff status changes `setDoc(..., {merge:true})` (upsert).

| Collection / doc | Fields | Notes |
|---|---|---|
| `settings/main` | overrides of `DEFAULT_SETTINGS` (`hotelName,address,phone,email,checkInTime,checkOutTime,serviceFee,allowOnline,allowWalkIn,allowCancel,adminTimeout,managerTimeout,auditLogging`) | public read, admin write. `failedLoginProtection` is **removed**. |
| `roomTypes/{id}` (id `'1'..'4'`) | `price, description, active, updatedAt` | overrides only. public read, admin write. |
| `rooms/{number}` (id = room number string) | `status, updatedAt` | `status` ∈ `AVAILABLE, OCCUPIED, CLEANING, MAINTENANCE, OUT_OF_SERVICE` (**RESERVED is derived**, §6). Absent doc ⇒ `AVAILABLE`. public read, staff write. |
| `roomNights/{roomId}_{YYYY-MM-DD}` | `roomId (number), date, bookingId, typeId` | **Double-booking lock + public availability index**, contains no PII. One doc per night in `[checkIn, checkOut)`. Create-only for customers (rules verify the booking being created in the same batch via `getAfter`), delete by owner/staff. Existing doc ⇒ night taken. Listener: `where('date','>=',today)`. |
| `bookings/{id}` (`id='b'+seq`) | `ref, customerId (uid|null), roomId, typeId, source ('ONLINE'|'WALK_IN'), checkIn, checkOut, guests, roomPrice, nights, serviceFee, subtotal, total, status, guestName, guestEmail, guestPhone, payment, createdAt, createdBy, checkedInAt, checkedOutAt, cancelledAt, cancelledBy, cancellationReason, sample?` | read: owner or staff; create: customer (own, `ONLINE`, `CONFIRMED`, price/total validated against room type + settings in rules) or staff (`WALK_IN`); update: customer may only cancel own `CONFIRMED`; staff status transitions; no deletes (except admin clearing `sample`). |
| `users/{uid}` | `id (=uid), role, name, email, photoURL, phone, googleUid (=uid), status ('active'|'disabled'), authProvider:'google', primary?, createdAt, lastLoginAt, updatedAt` | read: self, or staff (manager reads customers; admin reads all). create: self only (see §3 bootstrap — rules enforce role/email/invite). update: self limited to `name, photoURL, phone, lastLoginAt, updatedAt`; admin may change `status` (never self/primary). |
| `staffInvites/{emailLower}` | `email, name, phone, role:'hotel_manager', invitedBy, createdAt, claimedBy, claimedAt` | admin read/write; the invited user may `get` their own and set `claimedBy/claimedAt` once. |
| `housekeeping/{id}` (`HK-0001`) | `roomId, bookingId, status ('DIRTY'|'CLEANING'|'COMPLETED'), createdAt, completedAt, assignedTo, sample?` | staff only. |
| `maintenance/{id}` (`REQ-0001`) | `roomId, reportedBy, issueType, description, priority, status ('OPEN'|'IN_PROGRESS'|'RESOLVED'), createdAt, updatedAt, resolvedAt, sample?` | staff only. |
| `auditLogs/{autoId}` | `at, actorId, action, entityType, entityId, before, after, reason, ip:'', userAgent` | create: any signed-in user with `actorId == uid`; **immutable**; read: staff (admin all; manager sees all too — pages already filter to operational actions). |
| `messages/{autoId}` | `name,email,subject,message,at` | **public create** (shape/size validated), admin read. |
| `counters/main` | `booking, hk, req` (next numbers; missing ⇒ 1) | increment-by-1 only via transaction; customers may only touch `booking`. |

Booking refs `AUR-2026-00001` (`refOf`). Sample data uses the same counters.

## 5. Listener scope (what each role subscribes to)

| Role | Firestore | RTDB |
|---|---|---|
| anonymous | `settings/main`, `roomTypes`, `rooms`, `roomNights where date>=today` | — |
| customer | + `users/{uid}`, `bookings where customerId==uid` | `notifications/{uid}` |
| hotel_manager | + `users` (all), `bookings` (all), `housekeeping`, `maintenance`, `auditLogs orderBy at desc limit 300` | `notifications/{uid}`, `notifications/managers`, `presence` |
| admin | + `messages`, `staffInvites` | `notifications/{uid}`, `notifications/admins`, `presence` |

Listener errors (e.g. permission-denied after role change) must not crash the store; log and continue. The initial-hydration promise resolves after the first snapshot (or error) of every listener for that role.

## 6. Room status (derived RESERVED)

Customers cannot write `rooms`. The stored status never contains `RESERVED`. In the mirror, **for staff roles** (who have all bookings): `status = 'RESERVED'` when stored status is `AVAILABLE` and a `CONFIRMED` booking for that room has `checkIn <= today <= checkOut-1` (arriving/overdue today) — i.e. `checkIn <= today && checkOut > today`; otherwise the stored status. The store keeps the raw value as `room.storedStatus`. For anonymous/customer the stored status is shown as-is. All manager transitions (check-in requires `RESERVED|AVAILABLE`, housekeeping, maintenance, out-of-service) keep the old rules, applied to the *derived* status for guards and writing the *stored* status.

## 7. Public `window.AureliaStore` API (compat + new)

Kept **synchronous, same names/semantics** as the legacy store: `db` (getter; same array shapes), `today, addDays, nightsBetween, fmtDate, fmtShort, fmtTime, fmtStamp, rm, ago, parse, isoOf, user, room, roomByNo, type, booking, validateStay, availability, candidates, subscribe, sessionUser(role), touch(role), previewRoom, notificationsFor(u)`, plus `KEY` removed.

Now **async** (return Promise of result): `signInWithGoogle(portal)`, `logout(role)`, `createBooking(o)`, `cancelBooking(ref, actorId, reason)`, `checkIn`, `checkOut`, `advanceHousekeeping`, `markClean`, `reportMaintenance(o, actorId)`, `advanceMaintenance`, `setRoomStatus`, `reassignRoom`, `setUserStatus`, `updatePhone`, `inviteManager({name,email,phone}, actorId)` (replaces `createManager`), `revokeInvite(email, actorId)`, `setPrice`, `updateType`, `updateSettings`, `sendContact`, `markRead(id)`, `markAllRead(u)`, `loadSampleData(actorId)`, `clearSampleData(actorId)`.

New sync/read helpers: `S.me()` (current profile or null), `S.mode` (`'live'|'emulator'`), `S.onlineUids()` (Set from RTDB presence; staff only), `S.isOnline(uid)`, `S.staffInvites()` (admin).

**Removed** (callers must be cleaned up): `googleSignIn`, `staffLogin`, `unlockUser`, `createManager`, `reset`. `db.session` is gone (use `sessionUser`). Guest-only fields (`customer.googleUid`) remain on profiles.

Per-call authorisation checks from the legacy engine (`actorOf`, `isStaff`, admin-only guards, customer ownership) are **kept client-side too** (fast, good messages) — rules are the real enforcement.

## 8. Realtime Database

```
/staffEmails/{emailKey}          'hotel_manager' | 'admin'   mirror of staff identity (rules can't read Firestore). admin writes on invite/revoke/disable/enable. emailKey = email lowercased with '.'→','
/presence/{uid}                  { state:'online'|'offline', lastChanged: ServerValue.TIMESTAMP, name, role, portal }
/notifications/{target}/{pushId} { type, title, message, at (ISO), read:false, from }   target = uid | 'managers' | 'admins'
```
* Default admin email is hard-coded in `database.rules.json` (`auth.token.email === 'admin@aureliastay.local' && email_verified`). Staff = default admin OR `staffEmails/<key(auth.token.email)>` exists.
* `presence/{uid}`: write only own; read staff only. Used by Admin dashboard ("Online now"), Admin Users list (online dot) and System Health, Manager dashboard ("Staff online").
* `notifications/{uid}` read/update(`read`)/ by owner; `notifications/managers` read by staff; `notifications/admins` read by admin; **create** by any signed-in user (validated shape: required `type,title,message,at,read===false`, string lengths bounded, `at` ≈ now); only the owner/target may flip `read` and nothing else; no deletes except owner.
* Notification `to` semantics from the legacy engine map 1:1 (`customerId` → uid; `'managers'`; `'admins'`). The mirror `db.notifications` is the flattened list (each with `id`, `to`, …) so `notificationsFor(u)` and the pages' reads are unchanged.

## 9. Emulators & tests

* `firebase.json` already configures emulators (auth 9099, firestore 8080, database 9000, hosting 5000). Always pass `--project demo-aurelia` (`demo-` ids never touch production), e.g. `firebase emulators:start --only auth,firestore,database --project demo-aurelia`. Java 17 is installed.
* Browser pages switch to emulators with `?emulator=1` (see `config.js`); the store prints a visible "EMULATOR" badge when active.
* **Test-only sign-in:** when (and only when) emulator mode is on, the store exposes `S.__test = { signIn(email, name) }` which does `signInWithCredential(GoogleAuthProvider.credential(JSON.stringify({sub: <stable id from email>, email, email_verified: true, name})))` against the Auth emulator and then runs the normal profile bootstrap (`portal` as second arg) — so tests/E2E need no popup. It must not exist in live mode.
* Rules tests: `rules-tests/` using `@firebase/rules-unit-testing` + `node --test` (`npm run test:rules`, wraps `firebase emulators:exec`). Must cover the whole role matrix (customer / manager / admin / default-admin bootstrap / anonymous / disabled user / invited vs uninvited), double-booking lock, notification/RTDB rules, and negative cases.
* Browser test page: `design/tests/store-tests.html` (+ `design/tests/*.js` modules) run against the emulators, print a pass/fail table into the DOM and `window.__TEST_RESULT = {passed, failed, failures}`.

## 10. Page-wiring rules (portal agents)

* Every call to an async mutation gets `await` (make the handler `async`). Helpers like `run(res, ok)` become `async` and are awaited by callers; never ignore the promise. Disable submit buttons / set a `busy` flag while a request is in flight where the original UI had no such state **only if trivial**; otherwise keep the design as-is.
* Guards (`U.requireCustomer / requireStaff`) stay synchronous. Pages that render authenticated content must also re-check the session in their `S.subscribe` callback and redirect to the portal Login if `sessionUser` becomes null (sign-out in another tab).
* Login pages: one primary **"Continue with Google"** button (existing visual style), loading state while the popup is open, inline error from the result. Remove the "demo Google chooser" modal, email/password fields, "Forgot password", lockout copy. Staff login pages show a short helper line: manager → "Hotel Manager accounts are added by an administrator. Sign in with the Google account they registered." admin → "Administrator access. Default administrator: admin@aureliastay.local".
* Anything user-facing that referred to passwords/lockout/localStorage/“demo” data must be rewritten truthfully (System Health "Database: Cloud Firestore (zyphora-dfe10) · Realtime Database", "Authentication: Google sign-in (Firebase Auth)", Demo Portal ticker, etc.).
* **i18n:** do NOT edit `shared/aurelia-i18n.js`. Collect every new/changed English user-facing string on the customer website and report it in your final result (`newStrings: string[]`); the i18n owner adds BM translations afterwards.
* Customer avatar: where the site shows a letter-avatar for the signed-in customer (SiteHeader, Profile), show `photoURL` as an `<img>` (rounded, `referrerpolicy="no-referrer"`) when present, falling back to the letter.
* Empty Firestore must render properly (no bookings yet, no users but the admin). Handle `S.user(id) === null` (customers can't read other users) wherever the audit/booking views resolve actors/customers — show "Customer" / guest name from the booking instead of crashing.

## 11. Security-rule design requirements (rules agent)

* Helper functions: `signedIn()`, `uid()`, `emailLower()`, `verified()`, `isDefaultAdmin()`, `profile()` (`get(users/uid)`), `role()`, `active()`, `isAdmin()`, `isStaff()` (manager or admin, active), `isCustomer()`.
* Hard-code `admin@aureliastay.local` as the default admin (create-own-profile as admin allowed only for that verified email; that profile gets `primary:true` and cannot be disabled/demoted).
* A customer can never create a profile with a staff role; a manager profile can only be created if `staffInvites/{email}` exists with that role; users can never edit their own `role`, `status`, `email`, `primary`.
* Bookings: strict create validation (customer: `customerId == uid`, `source == 'ONLINE'`, `status == 'CONFIRMED'`, `roomPrice == roomType price (doc override or static default)`, `serviceFee == settings serviceFee (override or default 10)`, `total == roomPrice*nights + serviceFee`, `nights == date diff`, dates well-formed, `guests <= capacity`, settings `allowOnline`), customer cancel limited to own `CONFIRMED → CANCELLED` touching only cancellation fields; staff transitions; **no hard deletes** except admin on `sample` docs.
* `roomNights`: customers `create` only when `getAfter(bookings/bookingId)` belongs to them, matches `roomId/typeId` and the night lies in `[checkIn, checkOut)`; **no update** by anyone (create-only = double-booking guard); delete by booking owner (when cancelling) or staff.
* `auditLogs`: append-only. `messages`: public create with size limits. `counters`: increments by exactly 1, only the permitted key per role.
* Provide `firestore.indexes.json` (should be empty/minimal — design queries to avoid composite indexes).
* Everything not listed is denied (`allow read, write: if false`).

## 12. Sample data (optional demo content)

`S.loadSampleData(adminId)` (admin only, button on Admin → System Health) creates a believable history (guest-only bookings with `customerId:null`, `sample:true`, mix of COMPLETED/CHECKED_IN/CONFIRMED/CANCELLED, matching `roomNights`, housekeeping tasks, maintenance requests, a few audit entries) so dashboards/reports are not blank. `S.clearSampleData(adminId)` removes everything with `sample:true` (+ their `roomNights`). Sample bookings only touch rooms/dates in a way that leaves the system consistent (checked-in sample bookings ⇒ those rooms `OCCUPIED`). Idempotent: loading twice does not duplicate.
