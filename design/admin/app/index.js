/* AURELIA STAY — Admin portal logic aggregator (loaded by ../admin-app.js). One module per page area; this file only wires them to window.AureliaAdmin's API:
 *   F, state(), mount(c), unmount(c), vals(c, page)
 * Pages call vals(this, '<page>') on every render; the returned view-model keys are the ones the .dc.html templates bind to.
 */
import { F, makeCtx, baseVals } from './common.js';
import { initialState, mount, unmount } from './mount.js';
import { dashboard } from './dashboard.js';
import { health } from './health.js';
import { users, user } from './users.js';
import { addManager } from './invite.js';
import { bookings, booking } from './bookings.js';
import { pricing } from './pricing.js';
import { reports } from './reports.js';
import { audit } from './audit.js';
import { settings } from './settings.js';
import { notifications, profile } from './notifications.js';

const PAGES = { dashboard, health, users, user, 'create-manager': addManager, bookings, booking, pricing, reports, audit, settings, notifications, profile };

export function createAdmin() {
  return {
    F, state: initialState, mount, unmount,
    vals(c, page) {
      const x = makeCtx(c);
      if (!x) return { ready: false, loading: true, flash: {}, me: {}, rows: [] };
      const v = baseVals(x); const fn = PAGES[page]; if (fn) fn(x, v);
      return v;
    }
  };
}
