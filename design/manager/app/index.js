/* AURELIA STAY — Hotel Manager portal: module entry. manager-app.js imports this and publishes window.AureliaManager once everything is loaded.
 *   app/constants.js      page links, room-status chips
 *   app/ctx.js            per-render context (helpers + derived lists) handed to every page module
 *   app/core.js           state / mount / unmount / vals dispatcher (session guard + watcher)
 *   app/confirm.js        shared check-in / check-out / cancel dialog
 *   app/activity.js       audit entries as sentences + Activity page
 *   app/dashboard.js  reservations.js (also check-ins/outs)  rooms.js  housekeeping.js  maintenance.js  guests.js  calendar.js  walkin.js  reports.js  notifications.js (+ profile)
 */
import { F, RC } from './constants.js';
import { state, mount, unmount, vals } from './core.js';

export const initManager = () => ({ F, RC, state, mount, unmount, vals });
