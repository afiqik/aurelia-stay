/* AURELIA STAY — Hotel Manager portal: Guests list and Guest Profile. Built from bookings + users only, so it works with an empty database and
 * with customers whose profile is missing (falls back to the details stored on their bookings). */
import { F } from './constants.js';

// guest key -> bookings: signed-in customers by uid, walk-in / guest-only bookings by phone number
const groups = db => {
  const gm = {};
  db.bookings.forEach(b => { const key = b.customerId || ('w-' + String(b.guestPhone || '').replace(/\D/g, '')); (gm[key] = gm[key] || []).push(b); });
  db.users.filter(u => u.role === 'customer').forEach(u => { gm[u.id] = gm[u.id] || []; });
  return gm;
};

export function guestsVals(v, x, page) {
  const { S, c, st, db, q, rnOf, bVM } = x;
  const gm = groups(db);
  const info = key => {
    const u = S.user(key); const bs = gm[key] || []; const b0 = bs[0] || {}; const cur = bs.find(b => b.status === 'CHECKED_IN');
    const name = (u && (u.name || u.email)) || b0.guestName || '';
    return { key, name, initial: (name || '?').charAt(0), photo: (u && u.photoURL) || '', email: u ? (u.email || '—') : (b0.guestEmail || '—'), phone: u ? (u.phone || '—') : (b0.guestPhone || '—'), count: bs.length, current: cur ? 'In-house · Room ' + rnOf(cur.roomId) : 'Not in-house', kind: u || b0.customerId ? 'GOOGLE ACCOUNT' : 'WALK-IN GUEST', bs };
  };
  const withPhoto = g => ({ ...g, hasPhoto: !!g.photo, noPhoto: !g.photo });
  if (page === 'guests') {
    const qq = st.guestQ.trim().toLowerCase(); const qd = qq.replace(/\D/g, '');
    const rows = Object.keys(gm).map(info).filter(g => g.name && (!qq || g.name.toLowerCase().includes(qq) || g.email.toLowerCase().includes(qq) || (qd && String(g.phone).replace(/\D/g, '').includes(qd)))).sort((a, b) => a.name.localeCompare(b.name));
    v.guestQ = st.guestQ; v.onGuestQ = e => c.setState({ guestQ: e.target.value });
    v.rows = rows.map(g => ({ ...withPhoto(g), contact: g.email !== '—' ? g.email + ' · ' + g.phone : g.phone, href: F.guest + '?id=' + encodeURIComponent(g.key) })); v.empty = !rows.length;
  } else {
    const key = q.id || '';
    if (!gm[key]) { v.missing = 'Guest not found.'; v.gp = { bookings: [] }; return; }
    const g = info(key); v.found = true;
    v.gp = { ...withPhoto(g), bookings: g.bs.slice().sort((a, b) => a.checkIn < b.checkIn ? 1 : -1).map(bVM) };
  }
}
