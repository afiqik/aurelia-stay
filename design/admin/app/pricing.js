/* AURELIA STAY — Admin portal: Rooms & Pricing (room type price / description / visibility). setPrice and updateType are async and awaited.
 * Exports: pricing(x, v)
 */
import { busy } from './common.js';

export function pricing(x, v) {
  const { S, U, c, st, db, me, say } = x;
  const fail = (t, r) => c.setState(s => ({ rowErr: { ...s.rowErr, [t.id]: r.error } }));
  v.types = db.roomTypes.map((t, i) => {
    const count = db.rooms.filter(r => r.typeId === t.id).length; const active = db.bookings.filter(b => Number(b.typeId) === t.id && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN')).length;
    const pv = st.prices[t.id] !== undefined ? st.prices[t.id] : String(t.price); const dv = st.descs[t.id] !== undefined ? st.descs[t.id] : t.description;
    return {
      id: t.id, name: t.name, img: U.img(U.TYPE_IMG[t.id], 600), meta: count + ' rooms · up to ' + t.capacity + ' guests · ' + t.bed, activeLabel: t.active ? 'Visible online' : 'Hidden', activeBg: t.active ? '#DCE8E1' : '#EBD9D8', activeFg: t.active ? '#174C38' : '#8A1F21', toggleLabel: t.active ? 'Hide from website' : 'Show on website', activeBookings: active + ' active bookings', priceVal: pv, descVal: dv, err: st.rowErr[t.id] || '', delay: (i % 2) * 90,
      onPrice: e => { const val = e.target.value; c.setState(s => ({ prices: { ...s.prices, [t.id]: val }, rowErr: { ...s.rowErr, [t.id]: '' } })); },
      onDesc: e => { const val = e.target.value; c.setState(s => ({ descs: { ...s.descs, [t.id]: val }, rowErr: { ...s.rowErr, [t.id]: '' } })); },
      savePrice: () => busy(x, 'price' + t.id, async () => {
        const r = await S.setPrice(t.id, pv, me.id, st.priceReason); if (!r.ok) return fail(t, r);
        c.setState(s => { const p = { ...s.prices }; delete p[t.id]; return { prices: p }; }); S.touch('admin');
        say(t.name + ' price updated to ' + S.rm(Number(pv)) + '. Existing bookings keep their original price.');
      }),
      saveDesc: () => busy(x, 'desc' + t.id, async () => {
        const r = await S.updateType(t.id, { description: dv }, me.id); if (!r.ok) return fail(t, r);
        S.touch('admin'); say(t.name + ' description saved.');
      }),
      toggle: () => busy(x, 'toggle' + t.id, async () => {
        const r = await S.updateType(t.id, { active: !t.active }, me.id); if (!r.ok) return fail(t, r);
        S.touch('admin'); say(t.name + (t.active ? ' hidden from website.' : ' visible on website.'));
      })
    };
  });
  v.priceReason = st.priceReason; v.onPriceReason = e => c.setState({ priceReason: e.target.value });
  v.priceLog = db.audit.filter(a => a.action === 'UPDATE_ROOM_TYPE_PRICE').slice(0, 6).map(a => ({ when: x.stampOf(a.at).slice(0, 16), text: a.entityId + ': RM' + (a.before && a.before.price) + ' → RM' + (a.after && a.after.price), reason: a.reason || '' }));
  v.priceLogEmpty = !v.priceLog.length;
}
