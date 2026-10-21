/* AURELIA STAY — Admin portal: System Settings. updateSettings is async and awaited; session timeouts stay configurable (adminTimeout / managerTimeout).
 * Exports: settings(x, v)
 */
import { busy } from './common.js';

const TOGGLES = [['allowOnline', 'Online booking', 'Customers can book on the website'], ['allowWalkIn', 'Walk-in booking', 'Managers can create walk-in bookings'], ['allowCancel', 'Online cancellation', 'Customers can cancel before check-in date'], ['auditLogging', 'Audit logging', 'Record all sensitive actions']];
const FIELDS = ['hotelName', 'address', 'phone', 'email', 'checkInTime', 'checkOutTime', 'serviceFee', 'adminTimeout', 'managerTimeout'];

export function settings(x, v) {
  const { S, c, st, db, me, say } = x;
  const s = st.st || db.settings; v.s = s; v.stErr = st.stErr;
  const setS = k => e => { const val = e.target.value; c.setState(y => ({ st: { ...y.st, [k]: val }, stErr: '' })); };
  v.onS = {}; FIELDS.forEach(k => v.onS[k] = setS(k));
  v.toggles = TOGGLES.map(([k, label, note]) => ({ label, note, on: !!s[k], trackBg: s[k] ? '#174C38' : '#CBCBCB', knobX: s[k] ? '25px' : '3px', aria: s[k] ? 'true' : 'false', onClick: () => c.setState(y => ({ st: { ...y.st, [k]: !y.st[k] } })) }));
  const dirty = Object.keys(s).filter(k => String(s[k]) !== String(db.settings[k]));
  v.dirtyLabel = dirty.length ? dirty.length + ' unsaved change' + (dirty.length > 1 ? 's' : '') : 'All changes saved';
  v.resetForm = () => c.setState({ st: { ...db.settings }, stErr: '' });
  v.saveSettings = e => {
    e.preventDefault(); const patch = {}; dirty.forEach(k => patch[k] = s[k]);
    if (!dirty.length) return c.setState({ stErr: 'No changes to save.' });
    return busy(x, 'settings', async () => {
      const r = await S.updateSettings(patch, me.id); if (!r.ok) return c.setState({ stErr: r.error });
      c.setState({ st: { ...S.db.settings } }); S.touch('admin'); say('Settings saved · ' + dirty.length + ' change' + (dirty.length > 1 ? 's' : '') + ' logged to audit trail.');
    });
  };
}
