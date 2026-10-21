/* AURELIA STAY — Admin portal: System Health. Truthful rows derived from the live mirror + sample-data tools (load / clear, admin only).
 * Exports: healthRows(S) -> [{ name, detail, label, fg, dot }] (also used by the dashboard card), health(x, v)
 */
import { busy } from './common.js';
import { FIREBASE_CONFIG, EMULATOR } from '../../shared/core/config.js';

const GREEN = '#174C38', AMBER = '#5E400C', GREY = '#6A4744';
const sampleCounts = db => ({ bookings: db.bookings.filter(b => b.sample).length, housekeeping: db.housekeeping.filter(h => h.sample).length, maintenance: db.maintenance.filter(m => m.sample).length });

export function healthRows(S) {
  const db = S.db; const emu = S.mode === 'emulator'; const project = emu ? EMULATOR.projectId : FIREBASE_CONFIG.projectId;
  const online = S.onlineUids().size;
  const rows = [
    ['Database', (emu ? 'Cloud Firestore (emulator) · project ' : 'Cloud Firestore · project ') + project + ' · ' + db.users.length + ' users · ' + db.bookings.length + ' bookings · ' + db.audit.length + ' audit entries loaded'],
    ['Realtime Database', 'Presence + notifications · ' + online + ' online now · ' + db.notifications.length + ' notifications'],
    ['Authentication', 'Firebase Auth · Google sign-in'],
    ['Booking Engine', db.bookings.length + ' bookings · overlap-safe room-night locking'],
    ['Audit Logging', db.settings.auditLogging ? 'Enabled · ' + db.audit.length + ' entries loaded' : 'Disabled in settings'],
    ['Mode', emu ? 'Emulator · no production data is touched' : 'Live · production project ' + project]
  ];
  return rows.map(([name, detail]) => {
    const off = name === 'Audit Logging' && !db.settings.auditLogging; const mode = name === 'Mode';
    const label = off ? 'Disabled' : mode ? (emu ? 'Emulator' : 'Live') : 'Operational'; const fg = off ? GREY : mode && emu ? AMBER : GREEN;
    return { name, detail, label, fg, dot: fg };
  });
}

const summary = c => c.bookings + ' bookings, ' + c.housekeeping + ' housekeeping tasks, ' + c.maintenance + ' maintenance requests';

export function health(x, v) {
  const { S, c, st, db, me, say } = x;
  v.health = healthRows(S);
  v.healthTime = new Date().toLocaleTimeString('en-GB');
  const n = sampleCounts(db);
  v.sampleLine = n.bookings + n.housekeeping + n.maintenance ? 'Sample data in the database: ' + summary(n) + '.' : 'No sample data in the database.';
  const working = !!st.busyId && st.busyId === 'sample';
  v.sampleIdle = !st.sampleAsk && !working; v.sampleAskLoad = st.sampleAsk === 'load' && !working; v.sampleAskClear = st.sampleAsk === 'clear' && !working; v.sampleBusy = working;
  v.askLoad = () => c.setState({ sampleAsk: 'load' }); v.askClear = () => c.setState({ sampleAsk: 'clear' }); v.cancelAsk = () => c.setState({ sampleAsk: '' });
  v.doLoad = () => busy(x, 'sample', async () => {
    c.setState({ sampleAsk: '' });
    const r = await S.loadSampleData(me.id);
    if (!r.ok) return say(r.error, true);
    S.touch('admin');
    if (r.already) return say('Sample data is already loaded. Clear it first to load it again.', true);
    say('Sample data loaded · ' + summary(r.counts) + (r.skipped && r.skipped.length ? ' · ' + r.skipped.length + ' skipped to avoid clashing with real bookings.' : '.'));
  });
  v.doClear = () => busy(x, 'sample', async () => {
    c.setState({ sampleAsk: '' });
    const r = await S.clearSampleData(me.id);
    if (!r.ok) return say(r.error, true);
    S.touch('admin');
    say(r.cleared ? 'Sample data cleared · ' + summary(r.counts) + ' removed.' : 'There was no sample data to clear.');
  });
}
