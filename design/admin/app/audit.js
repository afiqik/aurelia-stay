/* AURELIA STAY — Admin portal: Audit Logs (search + action filter + expandable before/after). Actors are resolved null-safely (missing profile -> "Unknown user").
 * Exports: audit(x, v)
 */
import { fmtV } from './common.js';

export function audit(x, v) {
  const { c, st, db, actor, stampOf } = x;
  const qq = st.aq.trim().toLowerCase();
  const actions = Array.from(new Set(db.audit.map(a => a.action))).sort();
  const list = db.audit.filter(a => (!st.aAction || a.action === st.aAction) && (!qq || (a.entityId + ' ' + actor(a.actorId) + ' ' + a.action).toLowerCase().includes(qq))).slice(0, 100);
  v.aq = st.aq; v.aAction = st.aAction; v.onAq = e => c.setState({ aq: e.target.value }); v.onAAction = e => c.setState({ aAction: e.target.value });
  v.actionOptions = actions.map(a => ({ value: a, label: a }));
  v.rows = list.map(a => ({ id: a.id, at: stampOf(a.at), actor: actor(a.actorId), action: a.action, entity: a.entityType + ' · ' + a.entityId, isOpen: st.open === a.id, toggle: () => c.setState(s => ({ open: s.open === a.id ? null : a.id })), before: fmtV(a.before), after: fmtV(a.after), reason: a.reason || '—', ip: a.ip || '—', ua: a.userAgent || '—' }));
  v.empty = !list.length; v.countLabel = list.length + ' of ' + db.audit.length + ' entries';
}
