/* Security negative tests and RBAC authorization guards. */
import { describe, test, assert, assertEqual } from '../runner.js';
import { DEFAULT_ADMIN_EMAIL } from '../../shared/core/config.js';

export function registerNegativeGuardsTests(S) {
  describe('RBAC & Security Negative Guards', () => {
    test('uninvited email attempting manager portal sign-in is rejected', async () => {
      const res = await S.__test.signIn('uninvited.person@gmail.com', 'Uninvited', 'hotel_manager');
      assert(!res.ok, 'Uninvited manager sign-in must fail');
      assertEqual(res.code, 'AUTH_006', 'Error code should be AUTH_006');
    });

    test('customer attempting admin actions is rejected', async () => {
      const custRes = await S.__test.signIn('guard.customer@aureliastay.local', 'Guard Customer', 'customer');
      assert(custRes.ok, 'Customer sign-in');
      const custId = custRes.user.id;

      // Try setting price
      const priceRes = await S.setPrice('1', 50, custId, 'Unauthorized discount');
      assert(!priceRes.ok, 'Customer cannot set price');
      assertEqual(priceRes.code, 'PERMISSION_001');

      // Try updating settings
      const setRes = await S.updateSettings({ allowOnline: false }, custId);
      assert(!setRes.ok, 'Customer cannot update settings');
      assertEqual(setRes.code, 'PERMISSION_001');

      // Try reporting maintenance
      const maintRes = await S.reportMaintenance({ roomId: 101, issueType: 'AC', description: 'Broken' }, custId);
      assert(!maintRes.ok, 'Customer cannot report maintenance');
      assertEqual(maintRes.code, 'PERMISSION_001');

      // Try checking in
      const ciRes = await S.checkIn('AUR-2026-00001', custId);
      assert(!ciRes.ok, 'Customer cannot execute check-in');
      assertEqual(ciRes.code, 'PERMISSION_001');

      // Try loading sample data
      const sampleRes = await S.loadSampleData(custId);
      assert(!sampleRes.ok, 'Customer cannot load sample data');
      assertEqual(sampleRes.code, 'PERMISSION_001');

      await S.logout('customer');
    });

    test('admin cannot disable or demote themselves', async () => {
      const admRes = await S.__test.signIn(DEFAULT_ADMIN_EMAIL, 'System Admin', 'admin');
      assert(admRes.ok, 'Admin sign-in');
      const admId = admRes.user.id;

      const selfDis = await S.setUserStatus(admId, 'disabled', admId);
      assert(!selfDis.ok, 'Admin cannot disable self');
      assertEqual(selfDis.code, 'USER_002');

      await S.logout('admin');
    });
  });
}
