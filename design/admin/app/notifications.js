/* AURELIA STAY — Admin portal: Notifications (RTDB feed) + Profile. markRead / markAllRead / logout are async and awaited.
 * Exports: notifications(x, v), profile(x, v)
 */
export function notifications(x, v) {
  const { S, me, notes, say } = x;
  const check = r => { if (!r.ok) say(r.error, true); };
  v.rows = notes.map(n => ({ title: n.title, message: n.message, ago: S.ago(n.at), dot: n.read ? '#CBCBCB' : '#4E1617', bg: n.read ? 'transparent' : '#FFFFFF', weight: n.read ? 500 : 700, onClick: async () => { check(await S.markRead(n.id)); } }));
  v.empty = !notes.length; v.markAll = async () => { check(await S.markAllRead(me)); };
}

export function profile(x, v) {
  v.logout = async () => { await x.S.logout('admin'); location.href = 'Login.dc.html?out=1'; };
}
