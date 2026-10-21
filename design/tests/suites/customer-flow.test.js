/* Customer auth, profile update, booking creation, double-booking lock, and cancellation tests. */
import { describe, test, assert, assertEqual } from '../runner.js';

export function registerCustomerFlowTests(S) {
  let customerUser = null;
  let createdBookingRef = null;
  let bookedRoomNumber = null;
  const runId = Date.now().toString(36);
  const custEmail = `cust.${runId}@aureliastay.local`;
  const testStayCi = S.addDays(S.today(), 15);
  const testStayCo = S.addDays(testStayCi, 2);

  describe('Customer Flow (Auth, Booking, Double-Booking Guard, Cancel)', () => {
    test('customer signs in using test Google credential', async () => {
      const res = await S.__test.signIn(custEmail, 'Browser Customer', 'customer');
      assert(res.ok, `Customer sign-in failed: ${res.error}`);
      assert(res.user, 'Result should include user object');
      assertEqual(res.user.role, 'customer', 'Role should be customer');
      customerUser = res.user;

      const currentMe = S.me();
      assert(currentMe, 'S.me() should return current profile');
      assertEqual(currentMe.email, custEmail, 'me().email matches');

      const session = S.sessionUser('customer');
      assert(session, 'S.sessionUser("customer") should be truthy');
    });

    test('customer updates phone number in profile', async () => {
      assert(customerUser, 'Customer must be signed in');
      const newPhone = '018-7654321';
      const res = await S.updatePhone(customerUser.id, newPhone);
      assert(res.ok, `Phone update failed: ${res.error}`);
      assertEqual(S.me().phone, newPhone, 'S.me().phone has updated phone');
    });

    test('customer creates online booking with automatic room assignment', async () => {
      assert(customerUser, 'Customer must be signed in');
      const bRes = await S.createBooking({
        source: 'ONLINE',
        customerId: customerUser.id,
        typeId: 2, // Standard Double, base RM85
        checkIn: testStayCi,
        checkOut: testStayCo,
        guests: 2,
        payment: 'Pay at Hotel'
      });

      assert(bRes.ok, `Booking creation failed: ${bRes.error}`);
      assert(bRes.booking, 'Returned booking object should exist');
      assertEqual(bRes.booking.status, 'CONFIRMED', 'Status should be CONFIRMED');
      assertEqual(bRes.booking.source, 'ONLINE', 'Source should be ONLINE');
      assertEqual(bRes.booking.nights, 2, 'Nights should be 2');
      assert(bRes.booking.ref.startsWith('AUR-2026-'), `Ref format: ${bRes.booking.ref}`);

      createdBookingRef = bRes.booking.ref;
      bookedRoomNumber = bRes.booking.roomId;

      // Verify calculation: Standard Double price * 2 nights + fee
      const expectedTotal = (bRes.booking.roomPrice * 2) + bRes.booking.serviceFee;
      assertEqual(bRes.booking.total, expectedTotal, 'Total must equal (roomPrice * nights) + serviceFee');

      // Verify in-memory mirror
      const found = S.booking(createdBookingRef);
      assert(found, 'Booking should be searchable by ref');
      assertEqual(found.ref, createdBookingRef);
    });

    test('double-booking protection: room cannot be booked again for overlapping nights', async () => {
      // Find all rooms of type 2 (Standard Double has 8 rooms: 201-208)
      const cand = S.candidates(2, testStayCi, testStayCo);
      // The booked room should NOT be in candidates anymore
      const stillThere = cand.find(r => r.id === bookedRoomNumber);
      assert(!stillThere, `Booked room ${bookedRoomNumber} must not be in candidate rooms`);

      // If we attempt to create bookings until type 4 capacity is exhausted:
      // Room 401 & 402 are the only 2 Family rooms (type 4)
      const fakeCi = S.addDays(S.today(), 100);
      const fakeCo = S.addDays(fakeCi, 2);
      const b1 = await S.createBooking({ source: 'ONLINE', customerId: customerUser.id, typeId: 4, checkIn: fakeCi, checkOut: fakeCo, guests: 4 });
      assert(b1.ok, `First Family booking should succeed: ${b1.error}`);

      const b2 = await S.createBooking({ source: 'ONLINE', customerId: customerUser.id, typeId: 4, checkIn: fakeCi, checkOut: fakeCo, guests: 4 });
      assert(b2.ok, `Second Family booking should succeed: ${b2.error}`);

      // Now all 2 Family rooms are taken for fakeCi->fakeCo! A 3rd booking must fail!
      const b3 = await S.createBooking({ source: 'ONLINE', customerId: customerUser.id, typeId: 4, checkIn: fakeCi, checkOut: fakeCo, guests: 4 });
      assert(!b3.ok, 'Third Family room booking for same dates must fail (no rooms available)');
      assertEqual(b3.code, 'BOOKING_003', 'Should return BOOKING_003');

      // Clean up the 2 test family bookings
      await S.cancelBooking(b1.booking.ref, customerUser.id, 'Test cleanup');
      await S.cancelBooking(b2.booking.ref, customerUser.id, 'Test cleanup');
    });

    test('customer cancels their own booking', async () => {
      assert(createdBookingRef, 'createdBookingRef must exist');
      const cRes = await S.cancelBooking(createdBookingRef, customerUser.id, 'Change of schedule');
      assert(cRes.ok, `Cancel booking failed: ${cRes.error}`);
      assertEqual(S.booking(createdBookingRef).status, 'CANCELLED', 'Status should become CANCELLED');

      // Wait briefly for roomNights listener snapshot to propagate lock deletion
      for (let i = 0; i < 15; i++) {
        if (S.candidates(2, testStayCi, testStayCo).some(r => r.id === bookedRoomNumber)) break;
        await new Promise(r => setTimeout(r, 100));
      }

      // After cancellation, the room should be candidate again
      const candAfter = S.candidates(2, testStayCi, testStayCo);
      const freed = candAfter.find(r => r.id === bookedRoomNumber);
      assert(freed, `Room ${bookedRoomNumber} should be freed after cancellation`);
    });

    test('customer logs out successfully', async () => {
      const lRes = await S.logout('customer');
      assert(lRes.ok, 'Logout should succeed');
      const sess = S.sessionUser('customer');
      assertEqual(sess, null, 'Session should be null after logout');
    });
  });
}
