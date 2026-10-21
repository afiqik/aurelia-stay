/* AURELIA STAY — Hotel Manager portal: Walk-in Booking form (live availability quote + create). */
import { F } from './constants.js';

export function walkinVals(v, x) {
  const { S, U, c, st, db, me, once, say, go, setIn, rnOf } = x;
  const wk = st.wk; v.wk = wk; v.wkErr = st.wkErr;
  v.onWk = {}; ['name', 'phone', 'email', 'type', 'ci', 'co', 'g', 'payment'].forEach(k => v.onWk[k] = setIn('wk', k));
  v.typeOptions = db.roomTypes.filter(t => t.active).map(t => ({ value: String(t.id), label: t.name + ' — ' + S.rm(t.price) + ' · up to ' + t.capacity }));
  const err = S.validateStay(wk.ci, wk.co, wk.g); const t = S.type(wk.type);
  if (err) v.wkQuote = err;
  else if (!t) v.wkQuote = 'Please choose a room type.';
  else {
    const a = S.availability(wk.ci, wk.co, Number(wk.g)).find(o => o.typeId === t.id) || { available: 0, total: 0 }; const n = S.nightsBetween(wk.ci, wk.co);
    v.wkQuote = a.available + ' of ' + a.total + ' ' + t.name + ' rooms free · ' + S.rm(t.price) + ' × ' + n + ' + ' + S.rm(db.settings.serviceFee) + ' fee = ' + S.rm(t.price * n + db.settings.serviceFee) + (a.available ? ' · will assign Room ' + S.previewRoom(t.id, wk.ci, wk.co) : '');
  }
  v.wkImg = U.img(U.TYPE_IMG[wk.type] || 'double', 700);
  v.submitWalk = once(async e => {
    e.preventDefault();
    const r = await S.createBooking({ source: 'WALK_IN', actorId: me.id, guest: { name: wk.name, phone: wk.phone, email: wk.email.trim() }, typeId: Number(wk.type), checkIn: wk.ci, checkOut: wk.co, guests: Number(wk.g), payment: wk.payment });
    if (!r.ok) return c.setState({ wkErr: r.error });
    U.flash('Walk-in booking ' + r.booking.ref + ' created · Room ' + rnOf(r.booking.roomId) + '.'); go('reservation', 'ref=' + r.booking.ref);
  });
}
