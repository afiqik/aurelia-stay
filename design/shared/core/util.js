/* AURELIA STAY — pure helpers (dates, formatting, ids, validation). No Firebase, no DOM state; safe to unit-test in Node.
 *
 * Exports:
 *   pad(n) isoOf(date) parse(iso) today() addDays(iso, n) nightsBetween(a, b)
 *   fmtDate(iso, opts?) fmtShort(iso) fmtTime(isoTs) fmtStamp(isoTs) rm(n) ago(isoTs)
 *   refOf(n)                 booking reference 'AUR-2026-00001'
 *   emailKey(email)          RTDB key: lowercased, trimmed, '.' -> ','
 *   isEmail(s) isPhone(s)    isPhone = Malaysian number (digits only, leading 0, 9-11 digits) as the legacy updatePhone check
 *   nowIso()                 current time as full ISO string
 *   seqOf(id)                numeric part of an id ('b12' -> 12, 'HK-0031' -> 31)
 *   stripUndefined(v)        deep copy without undefined (Firestore rejects undefined)
 *   plain(v)                 deep copy turning Firestore Timestamps into ISO strings (page code never sees Timestamps)
 *   withTimeout(p, ms, fb?)  resolves with p's value, or with fb after ms (never rejects on timeout; rejects if p rejects)
 *   sleep(ms)
 */

export const pad = n => String(n).padStart(2, '0');
export const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parse = s => { const a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
export const today = () => isoOf(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoOf(d); };
export const nightsBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const fmtDate = (s, o) => s ? parse(s).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtShort = s => fmtDate(s, { day: 'numeric', month: 'short' });
export const fmtTime = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtStamp = iso => { const d = new Date(iso); return isoOf(d) + ' ' + d.toLocaleTimeString('en-GB'); };
export const rm = n => 'RM' + Number(n).toLocaleString('en-MY', { maximumFractionDigits: 2 });
export const ago = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 24) return h + (h > 1 ? ' hours' : ' hour') + ' ago';
  const d = Math.round(h / 24); return d + (d > 1 ? ' days' : ' day') + ' ago';
};
export const refOf = n => 'AUR-2026-' + String(n).padStart(5, '0');

export const emailKey = e => String(e || '').trim().toLowerCase().replace(/\./g, ',');
export const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
export const isPhone = s => /^0\d{8,10}$/.test(String(s || '').replace(/\D/g, ''));

export const nowIso = () => new Date().toISOString();
export const seqOf = id => Number(String(id).replace(/\D/g, '')) || 0;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.toDate !== 'function';
export function stripUndefined(v) {
  if (Array.isArray(v)) return v.map(stripUndefined);
  if (!isObj(v)) return v;
  const o = {}; Object.keys(v).forEach(k => { if (v[k] !== undefined) o[k] = stripUndefined(v[k]); }); return o;
}
export function plain(v) {
  if (v && typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch (e) { return null; } }
  if (Array.isArray(v)) return v.map(plain);
  if (!isObj(v)) return v;
  const o = {}; Object.keys(v).forEach(k => { o[k] = plain(v[k]); }); return o;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function withTimeout(p, ms, fallback) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(fallback), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
