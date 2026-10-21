/* AURELIA STAY — Hotel Manager portal: the shared confirm dialog (check-in / check-out / cancel reservation) bound on every page. */
export function confirmVals(v, x) {
  const { S, c, st, me, say, once, rnOf } = x;
  const cb = st.confirm && S.booking(st.confirm.ref);
  if (cb) {
    const k = st.confirm.kind; const rn = rnOf(cb.roomId);
    v.confirm = { title: k === 'checkin' ? 'Confirm Check-in?' : k === 'checkout' ? 'Confirm Check-out?' : 'Cancel Reservation?', cta: k === 'checkin' ? 'Confirm Check-in' : k === 'checkout' ? 'Confirm Check-out' : 'Cancel Reservation', needsReason: k === 'cancel', rows: [{ k: 'Guest', v: cb.guestName }, { k: 'Room', v: rn }, { k: 'Booking', v: cb.ref }, { k: 'Dates', v: S.fmtShort(cb.checkIn) + ' → ' + S.fmtShort(cb.checkOut) }] };
    v.confirmErr = st.confirmErr; v.confirmReason = st.confirmReason; v.onConfirmReason = e => c.setState({ confirmReason: e.target.value });
    v.doConfirm = once(async () => {
      const r = k === 'checkin' ? await S.checkIn(cb.ref, me.id) : k === 'checkout' ? await S.checkOut(cb.ref, me.id) : await S.cancelBooking(cb.ref, me.id, st.confirmReason);
      if (!r.ok) return c.setState({ confirmErr: r.error });
      S.touch('hotel_manager'); c.setState({ confirm: null });
      say(k === 'checkin' ? cb.ref + ' checked in · Room ' + rn + ' occupied.' : k === 'checkout' ? cb.ref + ' checked out · Room ' + rn + ' needs cleaning.' : cb.ref + ' cancelled.');
    });
  }
  v.closeConfirm = () => c.setState({ confirm: null });
}
