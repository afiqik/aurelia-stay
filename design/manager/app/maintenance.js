/* AURELIA STAY — Hotel Manager portal: Maintenance requests + the "report an issue" form. */
import { rlabel } from './constants.js';

const MC = { OPEN: ['OPEN', '#EBD9D8', '#8A1F21'], IN_PROGRESS: ['IN PROGRESS', '#F3E6C8', '#5E400C'], RESOLVED: ['RESOLVED', '#DCE8E1', '#174C38'] };
const PC = { HIGH: ['#4E1617', '#F1D7A5'], MEDIUM: ['#F3E6C8', '#5E400C'], LOW: ['#E2E2E2', '#333333'] };

export function maintenanceVals(v, x) {
  const { S, U, c, st, db, me, once, fin, say, setIn, rnOf } = x;
  v.rows = db.maintenance.map(m => ({ id: m.id, room: rnOf(m.roomId), issueType: m.issueType, description: m.description, priority: m.priority, prio: { bg: (PC[m.priority] || PC.MEDIUM)[0], fg: (PC[m.priority] || PC.MEDIUM)[1] }, chip: { label: MC[m.status][0], bg: MC[m.status][1], fg: MC[m.status][2] }, meta: 'Reported ' + S.ago(m.createdAt) + ' by ' + ((S.user(m.reportedBy) || {}).name || '—'), cta: m.status === 'OPEN' ? 'Start Work' : m.status === 'IN_PROGRESS' ? 'Resolve' : '', onClick: once(async () => { fin(await S.advanceMaintenance(m.id, me.id), m.id + (m.status === 'OPEN' ? ' in progress.' : ' resolved — Room ' + rnOf(m.roomId) + ' available.')); }) }));
  v.mt = st.mt; v.mtErr = st.mtErr; v.repairImg = U.img('repair', 800);
  v.onMt = { room: setIn('mt', 'room'), issueType: setIn('mt', 'issueType'), description: setIn('mt', 'description') };
  v.roomOptions = db.rooms.map(r => ({ value: r.number, label: r.number + ' — ' + rlabel(r.status) }));
  v.prioOpts = ['LOW', 'MEDIUM', 'HIGH'].map(p => ({ label: p.charAt(0) + p.slice(1).toLowerCase(), active: st.mt.priority === p, bg: st.mt.priority === p ? '#4E1617' : 'transparent', fg: st.mt.priority === p ? '#F1D7A5' : '#4E1617', onClick: () => c.setState({ mt: { ...st.mt, priority: p } }) }));
  v.submitMt = once(async e => {
    e.preventDefault();
    if (!st.mt.room) return c.setState({ mtErr: 'Please select a room.' });
    const r = await S.reportMaintenance({ roomNumber: st.mt.room, issueType: st.mt.issueType, description: st.mt.description, priority: st.mt.priority }, me.id);
    if (!r.ok) return c.setState({ mtErr: r.error });
    c.setState({ mtErr: '', mt: { room: '', issueType: '', description: '', priority: 'MEDIUM' } });
    say(r.id + ' created. Room ' + st.mt.room + ' is now in maintenance.');
  });
}
