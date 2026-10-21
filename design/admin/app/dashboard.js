/* AURELIA STAY — Admin portal: Dashboard (user / booking / room figures, this month's revenue, recent audit activity, health summary).
 * Exports: dashboard(x, v)
 */
import { healthRows } from './health.js';

export function dashboard(x, v) {
  const { S, db, T, actor, revenueOf } = x;
  const month = T.slice(0, 7); const us = db.users;
  v.health = healthRows(S);
  v.groups = [
    { title: 'Users', stats: [['Customers', us.filter(u => u.role === 'customer').length], ['Hotel Managers', us.filter(u => u.role === 'hotel_manager').length], ['Admins', us.filter(u => u.role === 'admin').length], ['Disabled', us.filter(u => u.status !== 'active').length], ['Online now', S.onlineUids().size]] },
    { title: 'Bookings', stats: [['Total', db.bookings.length], ['Upcoming', db.bookings.filter(b => b.status === 'CONFIRMED').length], ['In-house', db.bookings.filter(b => b.status === 'CHECKED_IN').length], ['Cancelled', db.bookings.filter(b => b.status === 'CANCELLED').length]] },
    { title: 'Rooms', stats: [['Total', db.rooms.length], ['Available', db.rooms.filter(r => r.status === 'AVAILABLE').length], ['Occupied', db.rooms.filter(r => r.status === 'OCCUPIED').length], ['Maintenance', db.rooms.filter(r => r.status === 'MAINTENANCE').length]] }
  ].map(g => ({ title: g.title, stats: g.stats.map(([k, n], i) => ({ k, n, delay: i * 60 })) }));
  v.monthRevenue = revenueOf(db.bookings.filter(b => String(b.checkIn).slice(0, 7) === month));
  v.recent = db.audit.slice(0, 7).map(a => ({ time: S.fmtShort(S.isoOf(new Date(a.at))) + ' ' + S.fmtTime(a.at), action: a.action, actor: actor(a.actorId), entity: a.entityType + ' ' + a.entityId }));
}
