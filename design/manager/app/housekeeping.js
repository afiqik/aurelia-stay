/* AURELIA STAY — Hotel Manager portal: Housekeeping task list. */
const HC = { DIRTY: ['Dirty', '#EBD9D8', '#4E1617'], CLEANING: ['Cleaning', '#F3E6C8', '#5E400C'], COMPLETED: ['Clean', '#DCE8E1', '#174C38'] };

export function housekeepingVals(v, x) {
  const { S, db, T, me, once, fin, rnOf, dayOf } = x;
  const rows = db.housekeeping.slice().sort((a, b) => (a.status === 'COMPLETED') - (b.status === 'COMPLETED') || (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 30);
  v.rows = rows.map(t => {
    const b = db.bookings.find(o => o.id === t.bookingId); const rn = rnOf(t.roomId);
    return { id: t.id, room: 'Room ' + rn, ref: b ? b.ref : '—', when: t.createdAt ? S.fmtShort(dayOf(t.createdAt)) + ' ' + S.fmtTime(t.createdAt) : '—', chip: { label: HC[t.status][0], bg: HC[t.status][1], fg: HC[t.status][2] }, cta: t.status === 'DIRTY' ? 'Start Cleaning' : t.status === 'CLEANING' ? 'Mark Clean' : '', onClick: once(async () => { fin(await S.advanceHousekeeping(t.id, me.id), 'Room ' + rn + (t.status === 'DIRTY' ? ' — cleaning started.' : ' marked clean → Available.')); }) };
  });
  v.empty = !rows.length;
  v.hkStats = [['Dirty', db.housekeeping.filter(t => t.status === 'DIRTY').length], ['Cleaning', db.housekeeping.filter(t => t.status === 'CLEANING').length], ['Clean today', db.housekeeping.filter(t => t.completedAt && dayOf(t.completedAt) === T).length]].map(([k, n]) => ({ k, n }));
}
