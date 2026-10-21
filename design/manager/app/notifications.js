/* AURELIA STAY — Hotel Manager portal: Notifications feed (own + managers' broadcast) and the Profile page. */
export function notificationsVals(v, x) {
  const { S, me, notes, say } = x;
  const fail = r => { if (!r || !r.ok) say((r && r.error) || 'Could not update notifications.', true); };
  v.rows = notes.map(n => ({ title: n.title, message: n.message, ago: S.ago(n.at), dot: n.read ? '#CBCBCB' : '#4E1617', bg: n.read ? 'transparent' : '#FFFFFF', weight: n.read ? 500 : 700, onClick: async () => { fail(await S.markRead(n.id)); } }));
  v.empty = !notes.length;
  v.markAll = async () => { fail(await S.markAllRead(me)); };
}

export function profileVals(v, x) {
  const { S, say, once } = x;
  v.logout = once(async () => {
    window.dispatchEvent(new Event('aurelia-leaving'));        // stop the session watcher so it does not redirect before we do
    const r = await S.logout('hotel_manager');
    if (r && r.ok === false) return say(r.error || 'Could not sign out. Please try again.', true);
    location.href = 'Login.dc.html?out=1';
  });
}
