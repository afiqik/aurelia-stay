/* AURELIA STAY — Hotel Manager portal: Operational Reports (occupancy + room status / check-in / check-out / housekeeping / maintenance cards). */
import { RC, ROOM_STATES } from './constants.js';

export function reportsVals(v, x) {
  const { db, T, dayOf, count, insToday, outsToday, pendingIn, pendingOut } = x;
  const usable = db.rooms.filter(r => r.status !== 'MAINTENANCE' && r.status !== 'OUT_OF_SERVICE').length;
  v.occ = usable ? Math.round(count('OCCUPIED') / usable * 100) : 0;
  v.occNote = count('OCCUPIED') + ' occupied of ' + usable + ' usable rooms (' + db.rooms.length + ' total)';
  const hk = s => db.housekeeping.filter(t => t.status === s).length, mt = s => db.maintenance.filter(m => m.status === s).length;
  v.cards = [
    { title: 'Room Status', rows: ROOM_STATES.map(s => ({ k: RC[s][0], v: count(s) })) },
    { title: 'Check-in Report', rows: [{ k: 'Arrivals today', v: insToday.length }, { k: 'Checked in', v: insToday.filter(b => b.status === 'CHECKED_IN').length }, { k: 'Waiting', v: pendingIn.length }] },
    { title: 'Check-out Report', rows: [{ k: 'Departures today', v: outsToday.length }, { k: 'Completed', v: outsToday.filter(b => b.status === 'COMPLETED').length }, { k: 'Waiting', v: pendingOut.length }] },
    { title: 'Housekeeping Report', rows: [{ k: 'Dirty', v: hk('DIRTY') }, { k: 'Cleaning', v: hk('CLEANING') }, { k: 'Completed today', v: db.housekeeping.filter(t => t.completedAt && dayOf(t.completedAt) === T).length }] },
    { title: 'Maintenance Report', rows: [{ k: 'Open', v: mt('OPEN') }, { k: 'In progress', v: mt('IN_PROGRESS') }, { k: 'Resolved', v: mt('RESOLVED') }] }
  ].map((c, i) => ({ ...c, delay: (i % 3) * 80 }));
}
