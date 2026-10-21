/* Tests for Catalogue integrity, lookups, date and formatting helpers. */
import { describe, test, assert, assertEqual } from '../runner.js';

export function registerCatalogTests(S) {
  describe('Static Catalogue & Lookups', () => {
    test('db contains exactly 20 rooms across 4 floors', () => {
      assert(Array.isArray(S.db.rooms), 'db.rooms should be an array');
      assertEqual(S.db.rooms.length, 20, 'Should have 20 rooms');
      const expectedRooms = [
        101, 102, 103, 104, 105, 106,
        201, 202, 203, 204, 205, 206, 207, 208,
        301, 302, 303, 304,
        401, 402
      ];
      for (const no of expectedRooms) {
        const found = S.roomByNo(no);
        assert(found, `Room ${no} should exist`);
        assertEqual(found.number, String(no), `Room number should match ${no}`);
      }
    });

    test('4 room types exist with proper static default prices and capacities', () => {
      assert(Array.isArray(S.db.roomTypes), 'db.roomTypes should be an array');
      assertEqual(S.db.roomTypes.length, 4, 'Should have 4 room types');

      const expectedTypes = {
        1: { name: 'Standard Single', price: 80, capacity: 1 },
        2: { name: 'Standard Double', price: 85, capacity: 2 },
        3: { name: 'Deluxe Double', price: 90, capacity: 2 },
        4: { name: 'Family Room', price: 95, capacity: 4 }
      };

      for (const [id, exp] of Object.entries(expectedTypes)) {
        const t = S.type(id);
        assert(t, `Room type ${id} should exist`);
        assertEqual(t.name, exp.name, `Type ${id} name`);
        assertEqual(t.capacity, exp.capacity, `Type ${id} capacity`);
        assert(t.price >= exp.price, `Type ${id} price should be at least ${exp.price}`);
      }
    });

    test('room lookup helpers: S.room() and S.roomByNo()', () => {
      const r1 = S.room(101);
      assert(r1, 'room(101) should return a room');
      assertEqual(r1.id, 101, 'id should match 101');

      const r2 = S.roomByNo('201');
      assert(r2, 'roomByNo("201") should return a room');
      assertEqual(r2.number, '201', 'number should match "201"');

      const nonexistent = S.roomByNo(999);
      assertEqual(nonexistent, null, 'Nonexistent room should return null');
    });

    test('default settings exist in in-memory mirror', () => {
      const set = S.db.settings;
      assert(set, 'db.settings should exist');
      assertEqual(set.hotelName, 'AURELIA STAY');
      assert(typeof set.serviceFee === 'number', 'serviceFee should be number');
      assert(set.allowOnline === true || set.allowOnline === false, 'allowOnline should be boolean');
    });
  });

  describe('Date & Format Helpers', () => {
    test('today() returns ISO date string (YYYY-MM-DD)', () => {
      const t = S.today();
      assert(/^\d{4}-\d{2}-\d{2}$/.test(t), `today() ${t} should match YYYY-MM-DD`);
    });

    test('addDays() adds days correctly', () => {
      const base = '2026-10-10';
      assertEqual(S.addDays(base, 1), '2026-10-11');
      assertEqual(S.addDays(base, 5), '2026-10-15');
      assertEqual(S.addDays(base, -1), '2026-10-09');
      assertEqual(S.addDays(base, 25), '2026-11-04');
    });

    test('nightsBetween() calculates stay duration', () => {
      assertEqual(S.nightsBetween('2026-10-10', '2026-10-12'), 2);
      assertEqual(S.nightsBetween('2026-10-10', '2026-10-17'), 7);
      assertEqual(S.nightsBetween('2026-10-10', '2026-10-10'), 0);
    });

    test('rm() formats currency strings', () => {
      assertEqual(S.rm(80), 'RM80');
      assertEqual(S.rm(265), 'RM265');
      assertEqual(S.rm(0), 'RM0');
    });

    test('fmtDate() formats human-readable dates', () => {
      const formatted = S.fmtDate('2026-10-25');
      assert(typeof formatted === 'string' && formatted.includes('2026'), 'fmtDate should include year');
    });
  });
}
