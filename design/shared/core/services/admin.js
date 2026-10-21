/* AURELIA STAY — admin configuration (admin only): setPrice, updateType, updateSettings. Catalogue/settings are "defaults + overrides" (contract §4):
 * the first edit creates roomTypes/{id} or settings/main with setDoc(..., { merge:true }); the mirror merges the override over catalog.js.
 * Every function validates against the mirror first (pure rules in settings-validate.js), then commits in a transaction that re-reads the
 * authoritative doc, so a concurrent edit cannot be silently overwritten with a stale "before" value.
 */
import { fail, guard } from '../errors.js';
import { db, type } from '../state.js';
import { mergeSettings, mergeTypes } from '../derive.js';
import { writeAudit } from '../audit.js';
import { ACTIVE } from '../availability.js';
import { rm, nowIso } from '../util.js';
import { adminOf } from './ctx.js';
import { runTx, getData, afterCommit, ref } from './tx.js';
import { validatePrice, validateTypePatch, validateSettingsPatch, diffSettings } from './settings-validate.js';

const typeFrom = (doc, id) => mergeTypes(doc ? { [String(id)]: doc } : {}).find(x => x.id === Number(id));

export function setPrice(typeId, price, actorId, reason) {
  return guard(async () => {
    const a = adminOf(actorId); const t0 = type(typeId); if (!t0) fail('ROOM_001', 'Room type not found.', 404);
    validatePrice(price, t0.price);
    const p = Number(price);
    const before = await runTx(async tx => {
      const tRef = ref('roomTypes', String(t0.id)); const cur = typeFrom(await getData(tx, tRef), t0.id);
      validatePrice(p, cur.price);
      tx.set(tRef, { price: p, updatedAt: nowIso() }, { merge: true });
      writeAudit(tx, a.id, 'UPDATE_ROOM_TYPE_PRICE', 'room_type', t0.name, { price: cur.price }, { price: p }, reason || null);
      return cur.price;
    });
    await afterCommit([['admins', 'PRICE_CHANGED', t0.name + ' price updated', rm(before) + ' → ' + rm(p) + ' per night']], () => { const x = type(t0.id); return !!x && x.price === p; });
  });
}

export function updateType(typeId, patch, actorId) {
  return guard(async () => {
    const a = adminOf(actorId); const t0 = type(typeId); if (!t0) fail('ROOM_001', 'Room type not found.', 404);
    const busy = db.bookings.some(b => b.typeId === t0.id && ACTIVE(b.status));
    validateTypePatch(patch, t0, busy);
    const after = await runTx(async tx => {
      const tRef = ref('roomTypes', String(t0.id)); const cur = typeFrom(await getData(tx, tRef), t0.id);
      const { before, after } = validateTypePatch(patch, cur, busy);
      tx.set(tRef, Object.assign({}, after, { updatedAt: nowIso() }), { merge: true });
      writeAudit(tx, a.id, 'UPDATE_ROOM_TYPE', 'room_type', t0.name, before, after);
      return after;
    });
    await afterCommit([], () => { const x = type(t0.id); return !!x && Object.keys(after).every(k => x[k] === after[k]); });
  });
}

export function updateSettings(patch, actorId) {
  return guard(async () => {
    const a = adminOf(actorId); const clean = validateSettingsPatch(patch);
    diffSettings(clean, db.settings);
    const after = await runTx(async tx => {
      const sRef = ref('settings', 'main'); const cur = mergeSettings(await getData(tx, sRef));
      const { before, after } = diffSettings(clean, cur);
      tx.set(sRef, Object.assign({}, after, { updatedAt: nowIso() }), { merge: true });
      writeAudit(tx, a.id, 'UPDATE_SETTINGS', 'system_settings', '1', before, after);
      return after;
    });
    await afterCommit([], () => Object.keys(after).every(k => db.settings[k] === after[k]));
  });
}
