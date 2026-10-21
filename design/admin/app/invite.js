/* AURELIA STAY — Admin portal: Add Hotel Manager. The admin registers the manager's Google email (name, email, phone) and the manager
 * signs in at the Manager portal with that Google account. inviteManager is async and awaited.
 * Exports: addManager(x, v)
 */
import { F, busy } from './common.js';

export function addManager(x, v) {
  const { S, U, c, st, me } = x;
  v.cm = st.cm; v.cmErr = st.cmErr;
  v.onCm = {}; ['name', 'email', 'phone'].forEach(k => v.onCm[k] = e => { const val = e.target.value; c.setState(s => ({ cm: { ...s.cm, [k]: val }, cmErr: '' })); });
  v.submitCm = e => {
    e.preventDefault();
    return busy(x, 'invite', async () => {
      const r = await S.inviteManager({ name: st.cm.name, email: st.cm.email, phone: st.cm.phone }, me.id);
      if (!r.ok) return c.setState({ cmErr: r.error });
      U.flash('Hotel Manager invitation added for ' + r.invite.name + '. They can now sign in with Google at the Manager portal.'); location.href = F.users;
    });
  };
}
