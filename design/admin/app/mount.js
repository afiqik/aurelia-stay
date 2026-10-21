/* AURELIA STAY — Admin portal: page state + lifecycle. state() keeps every key the page templates/guards rely on (`cm` doubles as the "state is initialised" marker).
 * mount(c) waits for the store + UI helpers (pages load them async), guards the page (admin session) and keeps the page live:
 * re-render on every store change, redirect to Login when the session disappears (other tab, disabled, idle timeout).
 */
export const initialState = () => ({
  me: null, flash: null, uq: '', uRole: '', uStatus: '', bq: '', bF: 'All', aq: '', aAction: '', open: null,
  cancelReason: '', cancelErr: '', confirmCancel: false,
  cm: { name: '', email: '', phone: '' }, cmErr: '',
  prices: {}, descs: {}, priceReason: '', rowErr: {}, st: null, stErr: '',
  sampleAsk: '', busyId: ''
});

export function mount(c) {
  const w = () => {
    if (!(window.AureliaStore && window.AureliaUI)) return (c._t = setTimeout(w, 30));
    const S = window.AureliaStore, U = window.AureliaUI; const me = U.requireStaff('admin'); if (!me) return;
    c._un = S.subscribe(() => c.forceUpdate());
    c._ws = U.watchSession('admin');
    const f = U.takeFlash(); const q = U.q();
    c.setState({ me, flash: f ? { msg: f, bg: '#DCE8E1', fg: '#174C38' } : null, st: { ...S.db.settings }, uRole: q.role || '', bF: q.filter || 'All' });
  }; w();
}

export function unmount(c) { clearTimeout(c._t); c._un && c._un(); c._ws && c._ws(); }
