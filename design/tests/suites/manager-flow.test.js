/* Manager flow: invite claiming, walk-in bookings, check-in, check-out, housekeeping, and maintenance. */
import { describe, test, assert, assertEqual } from '../runner.js';
import { DEFAULT_ADMIN_EMAIL } from '../../shared/core/config.js';

export function registerManagerFlowTests(S) {
  let managerUser = null;
  const runId = Date.now().toString(36);
  const mgrEmail = `mgr.${runId}@aureliastay.local`;
  let walkInRef = null;
  let walkInRoomId = null;

  describe('Hotel Manager Flow (Walk-in, Check-in, Check-out, Housekeeping, Maintenance)', () => {
    test('admin provisions manager invitation first', async () => {
      // Sign in as default admin to create manager invite
      const admRes = await S.__test.signIn(DEFAULT_ADMIN_EMAIL, 'Super Admin', 'admin');
      assert(admRes.ok, `Admin sign-in failed: ${admRes.error}`);

      const invRes = await S.inviteManager({
        name: 'Browser Manager',
        email: mgrEmail,
        phone: '019-8765432'
      }, admRes.user.id);
      assert(invRes.ok, `Invite manager failed: ${invRes.error}`);

      await S.logout('admin');
    });

    test('invited hotel manager signs in and claims invitation', async () => {
      const mgrRes = await S.__test.signIn(mgrEmail, 'Browser Manager', 'hotel_manager');
      assert(mgrRes.ok, `Manager sign-in failed: ${mgrRes.error}`);
      assertEqual(mgrRes.user.role, 'hotel_manager', 'Role should be hotel_manager');
      managerUser = mgrRes.user;

      const sess = S.sessionUser('hotel_manager');
      assert(sess, 'Manager session should be active');
    });

    test('manager creates walk-in booking starting today', async () => {
      assert(managerUser, 'Manager must be signed in');
      const today = S.today();
      const tomorrow = S.addDays(today, 1);

      const bRes = await S.createBooking({
        source: 'WALK_IN',
        actorId: managerUser.id,
        typeId: 1, // Standard Single
        checkIn: today,
        checkOut: tomorrow,
        guests: 1,
        guest: {
          name: 'Walkin Guest',
          phone: '011-2223334'
        },
        payment: 'Cash'
      });

      assert(bRes.ok, `Walk-in booking failed: ${bRes.error}`);
      assertEqual(bRes.booking.source, 'WALK_IN', 'Source should be WALK_IN');
      assertEqual(bRes.booking.status, 'CONFIRMED', 'Status should be CONFIRMED');
      walkInRef = bRes.booking.ref;
      walkInRoomId = bRes.booking.roomId;
    });

    test('manager checks in the guest', async () => {
      assert(walkInRef, 'Walk-in booking must exist');
      const ciRes = await S.checkIn(walkInRef, managerUser.id);
      assert(ciRes.ok, `Check-in failed: ${ciRes.error}`);
      assertEqual(S.booking(walkInRef).status, 'CHECKED_IN', 'Booking status should be CHECKED_IN');

      const roomObj = S.room(walkInRoomId);
      assert(roomObj, 'Room must exist');
      assertEqual(roomObj.status, 'OCCUPIED', 'Room status should be OCCUPIED after check-in');
    });

    test('manager checks out the guest, room moves to CLEANING', async () => {
      assert(walkInRef, 'Walk-in booking must exist');
      const coRes = await S.checkOut(walkInRef, managerUser.id);
      assert(coRes.ok, `Check-out failed: ${coRes.error}`);
      assertEqual(S.booking(walkInRef).status, 'COMPLETED', 'Booking status should be COMPLETED');

      const roomObj = S.room(walkInRoomId);
      assertEqual(roomObj.status, 'CLEANING', 'Room status should be CLEANING after checkout');
    });

    test('manager advances housekeeping task and marks room clean', async () => {
      // Find housekeeping task for this room
      const hkTask = S.db.housekeeping.find(h => h.roomId === walkInRoomId && h.status !== 'COMPLETED');
      if (hkTask) {
        if (hkTask.status === 'DIRTY') {
          const adv1 = await S.advanceHousekeeping(hkTask.id, managerUser.id);
          assert(adv1.ok, `Advance housekeeping failed: ${adv1.error}`);
        }
        const adv2 = await S.advanceHousekeeping(hkTask.id, managerUser.id);
        assert(adv2.ok, `Complete housekeeping failed: ${adv2.error}`);
      } else {
        // Direct mark clean
        const clRes = await S.markClean(walkInRoomId, managerUser.id);
        assert(clRes.ok, `Mark clean failed: ${clRes.error}`);
      }

      const roomObj = S.room(walkInRoomId);
      assertEqual(roomObj.status, 'AVAILABLE', 'Room status must return to AVAILABLE');
    });

    test('manager reports and resolves a maintenance request', async () => {
      assert(managerUser, 'Manager must be signed in');
      const targetRoom = '104';
      const repRes = await S.reportMaintenance({
        roomNumber: targetRoom,
        issueType: 'Air Conditioning',
        description: 'Filter replacement',
        priority: 'MEDIUM'
      }, managerUser.id);

      assert(repRes.ok, `Report maintenance failed: ${repRes.error}`);
      assert(repRes.id, 'Request id should exist');

      const roomInMaint = S.roomByNo(targetRoom);
      assertEqual(roomInMaint.status, 'MAINTENANCE', 'Room status must be MAINTENANCE');

      // Advance to IN_PROGRESS
      const adv1 = await S.advanceMaintenance(repRes.id, managerUser.id);
      assert(adv1.ok, `Advance maintenance to in_progress failed: ${adv1.error}`);

      // Advance to RESOLVED
      const adv2 = await S.advanceMaintenance(repRes.id, managerUser.id);
      assert(adv2.ok, `Resolve maintenance failed: ${adv2.error}`);

      const roomAfter = S.roomByNo(targetRoom);
      assertEqual(roomAfter.status, 'AVAILABLE', 'Room status must return to AVAILABLE after resolution');
    });

    test('manager logs out successfully', async () => {
      const lRes = await S.logout('hotel_manager');
      assert(lRes.ok, 'Manager logout should succeed');
      assertEqual(S.sessionUser('hotel_manager'), null, 'Manager session should be null');
    });
  });
}
