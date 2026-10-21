/* AURELIA STAY — Admin portal: Users list + User Details. Real profiles (Firestore users) plus pending staff invitations (staffInvites, admin only).
 * Exports: users(x, v), user(x, v). Every mutation is awaited through busy()/run().
 */
import { F, roleLabel, busy } from './common.js';
import { bVM } from './bookings.js';

const ustatus = u => u.status === 'active' ? { label: 'Active', bg: '#DCE8E1', fg: '#174C38' } : { label: 'Disabled', bg: '#EBD9D8', fg: '#8A1F21' };
const INVITED = { label: 'Invited', bg: '#F3E6C8', fg: '#5E400C' };
const initialOf = n => String(n || '?').charAt(0).toUpperCase();

const toggleUser = (x, u) => busy(x, u.id, async () => {
  const to = u.status === 'active' ? 'disabled' : 'active';
  await x.run(await x.S.setUserStatus(u.id, to, x.me.id), (u.name || u.email) + (to === 'active' ? ' enabled.' : ' disabled.'));
});
const revokeInvite = (x, i) => busy(x, 'invite:' + i.email, async () => {
  await x.run(await x.S.revokeInvite(i.email, x.me.id), 'Invitation for ' + (i.name || i.email) + ' revoked.');
});

const uVM = (x, u) => {
  const self = u.id === x.me.id; const canToggle = !self && !u.primary; const nm = u.name || u.email || 'User';
  return { id: u.id, name: nm, email: u.email || '', roleLabel: roleLabel(u.role), provider: 'GOOGLE', chip: ustatus(u), href: F.user + '?id=' + u.id, hasView: true, online: x.S.isOnline(u.id), toggleLabel: canToggle ? (u.status === 'active' ? 'Disable' : 'Enable') : '', toggleColor: u.status === 'active' ? '#8A1F21' : '#174C38', noteLabel: self ? 'You' : u.primary ? 'Primary' : '', onToggle: () => toggleUser(x, u), revokeLabel: '', onRevoke: () => { }, initial: initialOf(nm) };
};
// pending invitation: no account yet, so no view page and no enable/disable — only "Revoke invitation"
const iVM = (x, i) => ({ id: 'invite:' + i.email, name: i.name || i.email, email: i.email, roleLabel: roleLabel(i.role || 'hotel_manager'), provider: 'GOOGLE', chip: INVITED, href: '', hasView: false, online: false, toggleLabel: '', toggleColor: '', noteLabel: '', onToggle: () => { }, revokeLabel: 'Revoke invitation', onRevoke: () => revokeInvite(x, i), initial: initialOf(i.name || i.email) });

export function users(x, v) {
  const { S, c, st, db } = x;
  const qq = st.uq.trim().toLowerCase(); const hit = (n, e) => !qq || String(n || '').toLowerCase().includes(qq) || String(e || '').toLowerCase().includes(qq);
  const invites = S.staffInvites().filter(i => !i.claimedBy);
  const accounts = st.uStatus === 'invited' ? [] : db.users.filter(u => (!st.uRole || u.role === st.uRole) && (!st.uStatus || u.status === st.uStatus) && hit(u.name, u.email));
  const pending = st.uStatus && st.uStatus !== 'invited' ? [] : invites.filter(i => (!st.uRole || st.uRole === 'hotel_manager') && hit(i.name, i.email));
  v.uq = st.uq; v.uRole = st.uRole; v.uStatus = st.uStatus;
  v.onUq = e => c.setState({ uq: e.target.value }); v.onURole = e => c.setState({ uRole: e.target.value }); v.onUStatus = e => c.setState({ uStatus: e.target.value });
  v.rows = accounts.map(u => uVM(x, u)).concat(pending.map(i => iVM(x, i))); v.empty = !v.rows.length;
  v.countLabel = v.rows.length + ' of ' + (db.users.length + invites.length) + ' accounts';
}

export function user(x, v) {
  const { S, db, q, me } = x;
  const u = S.user(q.id || '');
  if (!u) { v.missing = 'User not found.'; v.ud = { fields: [], bookings: [] }; return; }
  const vm = uVM(x, u); const bs = db.bookings.filter(b => b.customerId === u.id).sort((a, b) => a.checkIn < b.checkIn ? 1 : -1);
  v.found = true;
  v.ud = { ...vm, selfNote: u.id === me.id ? 'This is your account — you cannot disable it.' : u.primary ? 'Primary admin account — cannot be disabled.' : '', fields: [['Email', u.email || '—'], ['Phone', u.phone || '—'], ['Role', roleLabel(u.role)], ['Sign-in', 'Google'], ['Created', u.createdAt ? S.fmtDate(S.isoOf(new Date(u.createdAt))) : '—'], ['Last login', u.lastLoginAt ? S.fmtStamp(u.lastLoginAt) : 'Never']].map(([k, val]) => ({ k, v: val })), hasBookings: bs.length > 0, bookings: bs.map(b => bVM(x, b)) };
}
