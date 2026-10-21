/* AURELIA STAY — Admin portal: Reports (revenue by month / room type / source, KPIs). Pure reads of the mirror; every figure copes with an empty database.
 * Exports: reports(x, v)
 */
export function reports(x, v) {
  const { S, db, T, revenueOf } = x;
  const months = []; const d0 = S.parse(T); for (let i = 5; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); months.push(S.isoOf(d).slice(0, 7)); }
  const inMonth = m => db.bookings.filter(b => String(b.checkIn).slice(0, 7) === m);
  const rev = months.map(m => revenueOf(inMonth(m)));
  const max = Math.max(1, ...rev);
  v.bars = months.map((m, i) => ({ label: S.parse(m + '-01').toLocaleDateString('en-GB', { month: 'short' }), value: S.rm(rev[i]), h: Math.max(4, Math.round(rev[i] / max * 100)) + '%', bg: i === months.length - 1 ? '#4E1617' : '#174C38' }));
  v.totalRevenue = S.rm(revenueOf(db.bookings));
  const byType = db.roomTypes.map(t => ({ k: t.name, n: db.bookings.filter(b => Number(b.typeId) === t.id && b.status !== 'CANCELLED').length, r: revenueOf(db.bookings.filter(b => Number(b.typeId) === t.id)) }));
  const maxT = Math.max(1, ...byType.map(y => y.n));
  v.byType = byType.map(y => ({ k: y.k, n: y.n + ' stays', r: S.rm(y.r), w: Math.round(y.n / maxT * 100) + '%' }));
  const nonCancelled = db.bookings.filter(b => b.status !== 'CANCELLED');
  const online = nonCancelled.filter(b => b.source === 'ONLINE').length;
  v.source = [{ k: 'Online', n: online, w: Math.round(online / Math.max(1, nonCancelled.length) * 100) + '%' }, { k: 'Walk-in', n: nonCancelled.length - online, w: Math.round((nonCancelled.length - online) / Math.max(1, nonCancelled.length) * 100) + '%' }];
  const cancelled = db.bookings.filter(b => b.status === 'CANCELLED').length;
  v.kpis = [['Total revenue', v.totalRevenue], ['Bookings', db.bookings.length], ['Cancellation rate', Math.round(cancelled / Math.max(1, db.bookings.length) * 100) + '%'], ['Avg. stay', (nonCancelled.reduce((s, b) => s + (Number(b.nights) || 0), 0) / Math.max(1, nonCancelled.length)).toFixed(1) + ' nights']].map(([k, n], i) => ({ k, n, delay: i * 70 }));
}
