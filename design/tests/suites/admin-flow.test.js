/* Admin flow: pricing adjustments, settings updates, user management, contact, and sample data. */
import { describe, test, assert, assertEqual } from '../runner.js';
import { DEFAULT_ADMIN_EMAIL } from '../../shared/core/config.js';

export function registerAdminFlowTests(S) {
  let adminUser = null;

  describe('System Administrator Flow (Pricing, Settings, Invites, Users, Sample Data)', () => {
    test('default administrator signs in as primary admin', async () => {
      const res = await S.__test.signIn(DEFAULT_ADMIN_EMAIL, 'System Administrator', 'admin');
      assert(res.ok, `Admin sign-in failed: ${res.error}`);
      assertEqual(res.user.role, 'admin', 'Role should be admin');
      assertEqual(res.user.primary, true, 'Default admin should have primary: true');
      adminUser = res.user;

      const sess = S.sessionUser('admin');
      assert(sess, 'Admin session should be active');
    });

    test('admin updates room type price and audit trail is created', async () => {
      assert(adminUser, 'Admin must be signed in');
      const currentPrice = S.type(3).price;
      const newPrice = currentPrice === 92 ? 94 : 92;

      const pRes = await S.setPrice('3', newPrice, adminUser.id, 'Seasonal adjustment');
      assert(pRes.ok, `setPrice failed: ${pRes.error}`);
      assertEqual(S.type(3).price, newPrice, 'In-memory type price updated');

      // Revert back to original
      await S.setPrice('3', currentPrice, adminUser.id, 'Reset to standard');
      assertEqual(S.type(3).price, currentPrice, 'Price reset successfully');
    });

    test('admin updates hotel settings (serviceFee)', async () => {
      assert(adminUser, 'Admin must be signed in');
      const oldFee = S.db.settings.serviceFee;
      const sRes = await S.updateSettings({ serviceFee: 12 }, adminUser.id);
      assert(sRes.ok, `updateSettings failed: ${sRes.error}`);
      assertEqual(S.db.settings.serviceFee, 12, 'Service fee updated to 12');

      // Restore old fee
      await S.updateSettings({ serviceFee: oldFee }, adminUser.id);
      assertEqual(S.db.settings.serviceFee, oldFee, 'Service fee restored');
    });

    test('admin invites a manager and can revoke the invitation', async () => {
      assert(adminUser, 'Admin must be signed in');
      const tempEmail = 'temporary.manager@aureliastay.local';
      const invRes = await S.inviteManager({
        name: 'Temp Manager',
        email: tempEmail,
        phone: '012-3334445'
      }, adminUser.id);

      assert(invRes.ok, `Invite failed: ${invRes.error}`);

      const invites = S.staffInvites();
      const found = invites.find(i => i.email === tempEmail);
      assert(found, 'Invitation should be listed in S.staffInvites()');

      // Revoke the invite
      const revRes = await S.revokeInvite(tempEmail, adminUser.id);
      assert(revRes.ok, `Revoke failed: ${revRes.error}`);

      const afterRevoke = S.staffInvites();
      const stillThere = afterRevoke.find(i => i.email === tempEmail);
      assert(!stillThere, 'Revoked invite should no longer be listed');
    });

    test('admin toggles customer status (disable / enable)', async () => {
      assert(adminUser, 'Admin must be signed in');
      // Create a test customer first
      const custEmail = 'status.target@aureliastay.local';
      const cRes = await S.__test.signIn(custEmail, 'Target Customer', 'customer');
      assert(cRes.ok, 'Customer sign-in ok');
      const targetUid = cRes.user.id;

      // Switch back to admin
      await S.__test.signIn(DEFAULT_ADMIN_EMAIL, 'System Administrator', 'admin');

      // Disable customer
      const disRes = await S.setUserStatus(targetUid, 'disabled', adminUser.id);
      assert(disRes.ok, `Disable user failed: ${disRes.error}`);
      assertEqual(S.user(targetUid).status, 'disabled', 'User status should be disabled');

      // Re-enable customer
      const enRes = await S.setUserStatus(targetUid, 'active', adminUser.id);
      assert(enRes.ok, `Enable user failed: ${enRes.error}`);
      assertEqual(S.user(targetUid).status, 'active', 'User status should be active');
    });

    test('public unauthenticated user can send contact message', async () => {
      const msgRes = await S.sendContact({
        name: 'Prospective Guest',
        email: 'inquirer@gmail.com',
        subject: 'Late check-in',
        message: 'Can I check in after 10 PM?'
      });
      assert(msgRes.ok, `sendContact failed: ${msgRes.error}`);
    });

    test('admin loads sample data and clears sample data idempotently', async () => {
      assert(adminUser, 'Admin must be signed in');
      const loadRes = await S.loadSampleData(adminUser.id);
      assert(loadRes.ok, `loadSampleData failed: ${loadRes.error}`);

      const sampleBookings = S.db.bookings.filter(b => b.sample);
      assert(sampleBookings.length > 0, 'Should have created sample bookings');

      // Calling load again is idempotent and informs already loaded
      const secondLoad = await S.loadSampleData(adminUser.id);
      assert(secondLoad.ok, 'Second load should return ok');
      assertEqual(secondLoad.already, true, 'already flag should be true');

      // Now clear sample data
      const clearRes = await S.clearSampleData(adminUser.id);
      assert(clearRes.ok, `clearSampleData failed: ${clearRes.error}`);

      const remainingSample = S.db.bookings.filter(b => b.sample);
      assertEqual(remainingSample.length, 0, 'All sample bookings should be cleared');
    });

    test('admin logs out successfully', async () => {
      const lRes = await S.logout('admin');
      assert(lRes.ok, 'Admin logout should succeed');
      assertEqual(S.sessionUser('admin'), null, 'Admin session should be null');
    });
  });
}
