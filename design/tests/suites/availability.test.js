/* Tests for Stay validation, availability query, candidates and room previews. */
import { describe, test, assert, assertEqual } from '../runner.js';

export function registerAvailabilityTests(S) {
  describe('Stay Validation & Availability Engine', () => {
    test('validateStay rejects missing dates with error message', () => {
      const v1 = S.validateStay('', '2026-10-28', 2);
      assert(typeof v1 === 'string' && v1.length > 0, 'Missing checkIn should return error string');

      const v2 = S.validateStay('2026-10-25', '', 2);
      assert(typeof v2 === 'string' && v2.length > 0, 'Missing checkOut should return error string');
    });

    test('validateStay rejects checkout on or before checkin', () => {
      const vSame = S.validateStay('2026-10-25', '2026-10-25', 2);
      assert(vSame.includes('must be after'), 'Same checkin and checkout should fail');

      const vReversed = S.validateStay('2026-10-28', '2026-10-25', 2);
      assert(vReversed.includes('must be after'), 'Checkout before checkin should fail');
    });

    test('validateStay rejects invalid guest count', () => {
      const today = S.today();
      const ci = S.addDays(today, 10);
      const co = S.addDays(ci, 2);

      const vZero = S.validateStay(ci, co, 0);
      assert(vZero.includes('at least 1 guest'), 'Zero guests should fail');

      const vTooMany = S.validateStay(ci, co, 5);
      assert(vTooMany.includes('No rooms available for 5 guests'), '5 guests exceeds max hotel room capacity of 4');
    });

    test('validateStay accepts valid stay within max nights', () => {
      const today = S.today();
      const ci = S.addDays(today, 10);
      const co = S.addDays(ci, 3);
      const v = S.validateStay(ci, co, 2);
      assertEqual(v, '', 'Valid 3-night stay for 2 guests should return empty string (no error)');
    });

    test('availability() returns matching room types with availability count', () => {
      const today = S.today();
      const ci = S.addDays(today, 50);
      const co = S.addDays(ci, 2);

      const av = S.availability(ci, co, 2);
      assert(Array.isArray(av), 'availability should return an array');
      // For 2 guests, Standard Double (8 rooms) and Deluxe Double (4 rooms) and Family Room (2 rooms) match
      const doubleType = av.find(a => a.typeId === 2);
      assert(doubleType, 'Standard Double should be in results');
      assert(doubleType.available > 0, 'Standard Double should have available rooms');
      assertEqual(doubleType.fits, true, 'Should fit 2 guests');
    });

    test('candidates() returns list of rooms free for the entire date range', () => {
      const today = S.today();
      const ci = S.addDays(today, 60);
      const co = S.addDays(ci, 3);

      const cand = S.candidates(1, ci, co);
      assert(Array.isArray(cand), 'candidates should return an array');
      assert(cand.length > 0, 'Should have candidate rooms for Standard Single');
      for (const r of cand) {
        assertEqual(r.typeId, 1, 'Candidate room should have typeId 1');
      }
    });

    test('previewRoom() picks deterministic lowest room number', () => {
      const today = S.today();
      const ci = S.addDays(today, 70);
      const co = S.addDays(ci, 2);

      const roomNo = S.previewRoom(1, ci, co);
      assert(roomNo, 'previewRoom should find a room number');
      assertEqual(roomNo, '101', 'Lowest available room for type 1 should be "101"');
    });
  });
}
