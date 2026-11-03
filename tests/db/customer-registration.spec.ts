import dotenv from 'dotenv';
import { test, expect } from '../../fixtures/pageFixtures';
import { RandomDataUtil } from '../../utils/dataGenerator';
import { executeQuery } from '../../utils/dbClient';
import { Helper } from '../../utils/helper';
import { cleanupCustomer, getCustomersByEmail } from '../../utils/customerDb';

dotenv.config({ quiet: true });

/**
 * Test case: A new customer must be consistent across the storefront, Admin and MySQL.
 *
 * Flow: check DB access -> register through the UI -> find the customer in Admin
 * -> compare the saved DB fields -> remove this test's customer and related rows.
 *
 * One generated email links all three layers. The UI creates the customer; SQL reads
 * verify what OpenCart actually saved rather than inserting the expected data directly.
 * The finally block performs cleanup even if a UI action or assertion fails.
 */
test('Customer registration across frontend, Admin and MySQL @master @regression @end-to-end @web @db', async ({
  homePage, registerPage, adminLoginPage, adminCustomersPage, page,
}) => {
  // Reuse configured Admin credentials, but generate fresh customer details for this run.
  const { username, password } = Helper.getAdminLoginDetails();
  const customer = RandomDataUtil.generateCustomerPayload();

  await test.step('0) Verify MySQL connectivity before creating customer data', async () => {
    // Fail early if MySQL is unavailable, before registration could leave a new account.
    await executeQuery('SELECT 1');
  });

  try {
    await test.step('1) Register a unique customer through the frontend', async () => {
      // The page object fills both password fields and accepts the Privacy Policy by default.
      await homePage.openRegistration();
      await expect(page, 'Frontend must display the registration page').toHaveURL(/route=account\/register/);
      await expect.poll(() => registerPage.isRegisterPageExists(), 'Registration heading must be displayed').toBe(true);
      await registerPage.completeRegistration(customer);
      await expect(page, 'Frontend registration must navigate to account success').toHaveURL(/route=account\/success/);
      await expect.poll(() => registerPage.isAccountCreated(), 'Frontend must confirm Your Account Has Been Created!').toBe(true);
    });

    await test.step('2) Find and validate the same customer in the Admin portal', async () => {
      // Search by the generated email so existing customers cannot satisfy these checks.
      await adminLoginPage.open();
      await adminLoginPage.login(username, password);
      await expect.poll(() => adminLoginPage.isDashboardExists(), 'Admin authentication must open the dashboard').toBe(true);
      await adminCustomersPage.open();
      await adminCustomersPage.searchByEmail(customer.email);
      await expect.poll(() => adminCustomersPage.getCustomerCount(customer.email), 'Admin must show exactly one customer with the registered email').toBe(1);
      await adminCustomersPage.openCustomer(customer.email);
      const savedCustomer = await adminCustomersPage.getCustomerDetails();
      expect(savedCustomer.firstName, 'Admin first name must match the registered first name').toBe(customer.firstName);
      expect(savedCustomer.lastName, 'Admin last name must match the registered last name').toBe(customer.lastName);
      expect(savedCustomer.email, 'Admin email must match the registered email').toBe(customer.email);
      expect(savedCustomer.status, 'Admin must display the newly registered customer as Enabled').toBe('Enabled');
    });

    await test.step('3) Validate the registered customer record in MySQL', async () => {
      // Require exactly one row before comparing fields; a match alone would miss duplicates.
      // date_added is present in the verified oc_customer schema.
      const rows = await getCustomersByEmail(customer.email);
      expect(rows, 'MySQL must contain exactly one record for the registered email').toHaveLength(1);
      const savedCustomer = rows[0];
      expect(savedCustomer.firstname, 'MySQL firstname must match the registered first name').toBe(customer.firstName);
      expect(savedCustomer.lastname, 'MySQL lastname must match the registered last name').toBe(customer.lastName);
      expect(savedCustomer.email, 'MySQL email must match the registered email').toBe(customer.email);
      // The verified environment enables new registrations immediately; MySQL stores that as 1.
      expect(savedCustomer.status, 'MySQL status must be 1 for the enabled registration').toBe(1);
      expect(savedCustomer.date_added, 'MySQL date_added must exist and be a valid date').toBeInstanceOf(Date);
      expect(savedCustomer.date_added.getTime(), 'MySQL date_added must contain a valid timestamp').toBeGreaterThan(0);
    });
  } finally {
    await test.step('4) Remove only this test customer, including after assertion failures', async () => {
      // The shared cleanup helper also removes this customer's related lifecycle records.
      await cleanupCustomer(customer.email);
      const remaining = await getCustomersByEmail(customer.email);
      expect(remaining, 'Cleanup must remove the generated customer').toHaveLength(0);
    });
  }

  console.log('✅ Customer registration matched across frontend, Admin and MySQL; test data removed.');
});
