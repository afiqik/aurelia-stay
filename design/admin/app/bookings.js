/* AURELIA STAY — Admin portal: Bookings list + Booking Details (administrative cancellation). Works with an empty database; actors are resolved null-safely.
 * Exports: bVM(x, b) (also used by users.js), bookings(x, v), booking(x, v)
 */
import { F, busy } from './common.js';

export const bVM = (x, b) => ({ ...x.U.bookingVM(b), href: F.booking + '?ref=' + b.ref, customer: (b.customerId ? 'Online · ' : 'Walk-in · ') + (b.guestName || 'Guest') });

// who did it: a customer's profile may be unreadable/missing -> fall back to the guest name on the booking
const who = (x, b, id) => x.actor(id, id && id === b.customerId ? (b.guestName || 'Customer') + ' (Customer)' : undefined);

export function bookings(x, v) {
  const { S, c, st, db, revenueOf } = x;
  const FL = { All: () => true, Confirmed: b => b.status === 'CONFIRMED', 'Checked-in': b => b.status === 'CHECKED_IN', Completed: b => b.status === 'COMPLETED', Cancelled: b => b.status === 'CANCELLED', 'Walk-in': b => b.source === 'WALK_IN' };
  const qq = st.bq.trim().toLowerCase(); const cur = FL[st.bF] ? st.bF : 'All';
  const list = db.bookings.filter(FL[cur]).filter(b => !qq || String(b.ref).toLowerCase().includes(qq) || String(b.guestName || '').toLowerCase().includes(qq)).sort((a, b) => String(a.createdAt) < String(b.createdAt) ? 1 : -1);
  v.bq = st.bq; v.onBq = e => c.setState({ bq: e.target.value });
  v.filters = Object.keys(FL).map(k => ({ label: k, active: cur === k, bg: cur === k ? '#4E1617' : 'transparent', fg: cur === k ? '#F1D7A5' : '#4E1617', onClick: () => c.setState({ bF: k }) }));
  v.rows = list.map(b => bVM(x, b)); v.empty = !list.length; v.totalLabel = list.length + ' bookings · ' + S.rm(revenueOf(list)) + ' realised revenue';
}

export function booking(x, v) {
  const { S, U, c, st, q, me, say } = x;
  const b = S.booking(q.ref || '');
  if (!b) { v.missing = 'Booking not found.'; v.bd = { chip: {}, timeline: [] }; return; }
  const vm = bVM(x, b);
  v.found = true;
  v.bd = { ...vm, img: U.img(U.TYPE_IMG[b.typeId], 1000), canOverride: b.status === 'CONFIRMED', created: x.stampOf(b.createdAt), createdBy: who(x, b, b.createdBy || b.customerId), timeline: [['Created', b.createdAt], ['Checked in', b.checkedInAt], ['Checked out', b.checkedOutAt], ['Cancelled', b.cancelledAt]].filter(t => t[1]).map(([k, at]) => ({ k, at: x.stampOf(at) })), cancelNote: b.status === 'CANCELLED' ? 'Reason: ' + (b.cancellationReason || '—') + ' · by ' + who(x, b, b.cancelledBy) : '' };
  v.confirmCancel = st.confirmCancel; v.cancelClosed = !st.confirmCancel; v.cancelReason = st.cancelReason; v.cancelErr = st.cancelErr;
  v.onReason = e => c.setState({ cancelReason: e.target.value, cancelErr: '' });
  v.askCancel = () => c.setState({ confirmCancel: true, cancelErr: '' }); v.keep = () => c.setState({ confirmCancel: false });
  v.doCancel = () => busy(x, 'cancel', async () => {
    const r = await S.cancelBooking(b.ref, me.id, st.cancelReason);
    if (!r.ok) return c.setState({ cancelErr: r.error });
    c.setState({ confirmCancel: false, cancelReason: '' }); S.touch('admin'); say(b.ref + ' cancelled. Customer and managers have been notified.');
  });
}
