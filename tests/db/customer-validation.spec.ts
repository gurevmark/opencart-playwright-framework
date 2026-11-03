/**
 * Registration rejection tests: the UI must explain the problem without saving bad data.
 *
 * The loops below create independent Playwright tests, each with its own generated data.
 * customerData supplies fresh details without registering an account. registeredCustomer
 * additionally registers that customer and captures its original DB fields before the test.
 * Both fixtures clean up their test-owned data after the test, including on failure.
 */
import dotenv from 'dotenv';
import { test, expect } from '../../fixtures/dbFixtures';
import { RandomDataUtil } from '../../utils/dataGenerator';
import { cleanupCustomer, getCustomersByEmail } from '../../utils/customerDb';
import { executeQuery } from '../../utils/dbClient';

dotenv.config({ quiet: true });

/**
 * Test case: An existing email cannot be used to create or overwrite another account.
 * Flow: start with a registered customer -> log out -> submit different customer details
 * with the same email -> expect rejection -> verify the original DB row is unchanged.
 * Run both the original spelling and uppercase spelling to cover email case handling.
 */
for (const variant of ['same email', 'uppercase email'] as const) {
  test(`Duplicate registration rejects ${variant} without overwriting the customer @master @regression @datadriven @end-to-end @web @db`, async ({
    customerData, registeredCustomer, homePage, registerPage, logoutPage, page,
  }) => {
    await test.step('1) Log out and open a second registration', async () => {
      // Setup already logged this customer in; log out so we can reach registration again.
      await homePage.logout();
      await logoutPage.clickContinue();
      await homePage.openRegistration();
      await expect.poll(() => registerPage.isRegisterPageExists()).toBe(true);
    });
    await test.step('2) Submit different details with the already registered email', async () => {
      // Different names and contact details make an accidental overwrite detectable.
      const duplicate = RandomDataUtil.generateCustomerPayload();
      duplicate.email = variant === 'uppercase email' ? customerData.email.toUpperCase() : customerData.email;
      await registerPage.completeRegistration(duplicate);
      await expect.poll(() => registerPage.getValidationErrors()).toContain('Warning: E-Mail Address is already registered!');
      await expect(page).toHaveURL(/route=account\/register/);
    });
    await test.step('3) Verify MySQL still contains one unchanged customer', async () => {
      // Compare against the fixture's pre-attempt snapshot, not against the duplicate payload.
      const rows = await getCustomersByEmail(customerData.email);
      expect(rows, 'Duplicate registration must not insert another row').toHaveLength(1);
      expect(rows[0], 'Duplicate registration must preserve the original saved fields').toEqual(registeredCustomer);
    });
    console.log('✅ Duplicate registration rejected; original database record preserved.');
  });
}

/**
 * Test cases: Missing required fields, mismatched passwords and missing privacy consent.
 * Each row below names one invalid condition and the installed application's expected error.
 * Flow: confirm the email is unused -> submit one invalid condition -> check its UI error
 * -> verify no customer was inserted. All other inputs remain valid to isolate the cause.
 */
const invalidCases = [
  { name: 'missing first name', field: 'firstName', error: 'First Name must be between 1 and 32 characters!' },
  { name: 'missing last name', field: 'lastName', error: 'Last Name must be between 1 and 32 characters!' },
  { name: 'missing email', field: 'email', error: 'E-Mail Address does not appear to be valid!' },
  { name: 'missing telephone', field: 'telephone', error: 'Telephone must be between 3 and 32 characters!' },
  { name: 'missing password', field: 'password', error: 'Password must be between 4 and 20 characters!' },
  { name: 'password mismatch', error: 'Password confirmation does not match password!' },
  { name: 'unchecked Privacy Policy', error: 'Warning: You must agree to the Privacy Policy!' },
] as const;

for (const invalid of invalidCases) {
  test(`Invalid registration with ${invalid.name} creates no customer @master @regression @datadriven @end-to-end @web @db`, async ({
    customerData, homePage, registerPage, page,
  }) => {
    // Edit a copy so the fixture retains the original details needed for scoped cleanup.
    const payload = { ...customerData };
    if ('field' in invalid) payload[invalid.field] = '';
    const missingEmail = invalid.name === 'missing email';
    // A blank email cannot identify this attempt safely. Use its unique generated name
    // marker and contact fields instead; never query or delete all blank-email customers.
    if (missingEmail) payload.firstName = customerData.email.slice(0, 32);
    // Share this lookup between the DB assertion and the blank-email cleanup fallback.
    const findAttemptRows = async () => missingEmail
      ? await executeQuery(
        'SELECT customer_id FROM oc_customer WHERE firstname = ? AND lastname = ? AND telephone = ?',
        [payload.firstName, payload.lastName, payload.telephone],
      ) as { customer_id: number }[]
      : await getCustomersByEmail(customerData.email);

    try {
      await test.step('1) Open registration with a unique unregistered email', async () => {
        expect(await getCustomersByEmail(customerData.email)).toHaveLength(0);
        await homePage.openRegistration();
        await expect.poll(() => registerPage.isRegisterPageExists()).toBe(true);
      });
      await test.step('2) Submit the invalid form and verify its specific rejection', async () => {
        // Override confirmation or privacy consent only for the corresponding negative case.
        await registerPage.completeRegistration(payload, {
          passwordConfirmation: invalid.name === 'password mismatch' ? `${payload.password}different` : payload.password,
          acceptPrivacyPolicy: invalid.name !== 'unchecked Privacy Policy',
        });
        await expect.poll(() => registerPage.getValidationErrors()).toContain(invalid.error);
        await expect(page).toHaveURL(/route=account\/register/);
        expect(await registerPage.isAccountCreated(), 'Invalid input must not show account-created confirmation').toBe(false);
      });
      await test.step('3) Verify no customer was persisted in MySQL', async () => {
        expect(await findAttemptRows(), 'Rejected registration must leave no customer row').toHaveLength(0);
      });
      console.log('✅ Invalid registration rejected without creating a customer.');
    } finally {
      if (missingEmail) {
        // If a bug persisted an empty-email customer, clean only rows found by our unique marker.
        // The ordinary fixture cleanup handles all cases that submitted the generated email.
        for (const row of await findAttemptRows()) await cleanupCustomer(customerData.email, row.customer_id);
      }
    }
  });
}
