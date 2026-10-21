/* AURELIA STAY — Hotel Manager portal: operational activity feed (audit entries rendered as sentences) + the Activity page. */
const who = (S, a) => {
  const u = S.user(a.actorId);                       // null when the profile is not readable / was removed
  if (u) return u.role === 'hotel_manager' ? 'Manager ' + String(u.name || '').split(' ')[0] : u.role === 'admin' ? 'Admin' : 'Customer ' + String(u.name || '').split(' ')[0];
  return /^BOOKING_(CREATED|CANCELLED)$/.test(a.action) ? 'Customer' : 'System';
};

export const actText = (S, a) => {
  const M = { BOOKING_CHECKED_IN: 'checked in ' + a.entityId, BOOKING_CHECKED_OUT: 'checked out ' + a.entityId, ROOM_MARKED_AVAILABLE: 'marked Room ' + a.entityId + ' clean → Available', HOUSEKEEPING_STARTED: 'started cleaning Room ' + a.entityId, MAINTENANCE_REPORTED: 'reported maintenance ' + a.entityId, MAINTENANCE_IN_PROGRESS: 'started work on ' + a.entityId, MAINTENANCE_RESOLVED: 'resolved ' + a.entityId, BOOKING_CREATED: 'created booking ' + a.entityId, BOOKING_CANCELLED: 'cancelled ' + a.entityId, ADMIN_BOOKING_OVERRIDE: 'cancelled ' + a.entityId + ' (override)', BOOKING_ROOM_REASSIGNED: 'moved ' + a.entityId + ' to Room ' + (a.after && a.after.room), ROOM_STATUS_CHANGED: 'set Room ' + a.entityId + ' to ' + (a.after && a.after.status) };
  return M[a.action] ? who(S, a) + ' ' + M[a.action] : null;
};

// [{ a: auditEntry, text }] newest first, operational actions only
export const opsOf = S => S.db.audit.map(a => ({ a, text: actText(S, a) })).filter(x => x.text);

export function activityVals(v, x) {
  const { S, ops } = x;
  v.rows = ops.slice(0, 60).map(o => ({ stamp: S.fmtStamp(o.a.at).slice(0, 16), text: o.text }));
}
