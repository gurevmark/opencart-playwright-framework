/**
 * Customer lifecycle tests: UI changes must agree with saved data and later user behavior.
 *
 * Every test starts with a newly registered, logged-in customer from dbFixtures.
 * customerData contains the submitted details; registeredCustomer is the original DB snapshot.
 * Fixture teardown uses the captured customer ID to clean up even after the email changes
 * or Admin deletes the parent row. These tests never edit the shared configured customer.
 */
import dotenv from 'dotenv';
import { type RowDataPacket } from 'mysql2/promise';
import { test, expect } from '../../fixtures/dbFixtures';
import { RandomDataUtil } from '../../utils/dataGenerator';
import { Helper } from '../../utils/helper';
import { getCustomersByEmail } from '../../utils/customerDb';
import { executeQuery } from '../../utils/dbClient';

dotenv.config({ quiet: true });

/**
 * Test case: Editing a profile updates the existing account rather than creating a new one.
 * Flow: open account edit -> save new names, email and telephone -> read MySQL by the new
 * email -> verify the changed values while retaining the original ID, creation date and status.
 */
test('Customer profile updates persist on the same record @master @regression @end-to-end @web @db', async ({
  customerData, registeredCustomer, homePage, myAccountPage, accountEditPage, page,
}) => {
  // A new generated email makes it possible to check that the old email was replaced.
  const updated = RandomDataUtil.generateCustomerPayload();
  updated.firstName = `Updated${updated.firstName}`.slice(0, 32);
  updated.lastName = `Changed${updated.lastName}`.slice(0, 32);
  await test.step('1) Open the account-edit page', async () => {
    await homePage.openAccount();
    await myAccountPage.openAccountEdit();
    await expect.poll(() => accountEditPage.isAccountEditPageExists()).toBe(true);
  });
  await test.step('2) Save updated identity and contact fields', async () => {
    await accountEditPage.updateDetails(updated);
    await expect(page).toHaveURL(/route=account\/account/);
    await expect.poll(() => myAccountPage.getSuccessMessage()).toContain('Success: Your account has been successfully updated.');
  });
  await test.step('3) Verify changed fields, stable identity and original creation date in MySQL', async () => {
    // Keeping the same ID and date_added distinguishes an update from delete-and-recreate.
    expect(await getCustomersByEmail(customerData.email), 'The old email must no longer identify a customer').toHaveLength(0);
    const rows = await getCustomersByEmail(updated.email);
    expect(rows, 'Profile updates must preserve exactly one record').toHaveLength(1);
    expect(rows[0].customer_id, 'Profile updates must not create a new customer ID').toBe(registeredCustomer.customer_id);
    expect(rows[0].firstname).toBe(updated.firstName);
    expect(rows[0].lastname).toBe(updated.lastName);
    expect(rows[0].email).toBe(updated.email);
    expect(rows[0].telephone).toBe(updated.telephone);
    expect(rows[0].date_added, 'Profile updates must preserve the registration date').toEqual(registeredCustomer.date_added);
    expect(rows[0].status).toBe(registeredCustomer.status);
  });
  console.log('✅ Profile updates persisted against the original customer ID.');
});

/**
 * Test case: Admin status changes control whether the same customer can authenticate.
 * Flow: disable in Admin -> verify status=0 -> reject a fresh login -> enable in Admin
 * -> verify status=1 -> allow a fresh login using the customer's unchanged credentials.
 */
test('Admin disables and re-enables customer login @master @regression @end-to-end @web @db', async ({
  customerData, registeredCustomer, adminLoginPage, adminCustomersPage, homePage, loginPage, myAccountPage, page, context,
}) => {
  const credentials = Helper.getAdminLoginDetails();
  await test.step('1) Disable the generated customer through Admin', async () => {
    await adminLoginPage.open();
    await adminLoginPage.login(credentials.username, credentials.password);
    await expect.poll(() => adminLoginPage.isDashboardExists()).toBe(true);
    await adminCustomersPage.open();
    await adminCustomersPage.searchByEmail(customerData.email);
    await adminCustomersPage.openCustomer(customerData.email);
    await adminCustomersPage.setStatus('Disabled');
    await expect.poll(() => adminCustomersPage.getSuccessMessage()).toContain('Success: You have modified customers!');
    const rows = await getCustomersByEmail(customerData.email);
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_id).toBe(registeredCustomer.customer_id);
    expect(rows[0].status, 'Admin disable must persist status=0').toBe(0);
  });
  await test.step('2) Verify a fresh login is rejected while disabled', async () => {
    // Remove existing customer/Admin sessions so an already-authenticated page cannot pass.
    await context.clearCookies();
    await homePage.open();
    await homePage.openLogin();
    await loginPage.login(customerData.email, customerData.password);
    // This OpenCart version reports disabled accounts with its approval-required warning.
    await expect.poll(() => loginPage.getWarning()).toBe('Warning: Your account requires approval before you can login.');
    await expect(page).toHaveURL(/route=account\/login/);
    expect(await myAccountPage.isEditAccountAvailable()).toBe(false);
  });
  await test.step('3) Re-enable the same customer through Admin', async () => {
    // Clearing cookies also logged Admin out, so authenticate again before changing status.
    await adminLoginPage.open();
    await adminLoginPage.login(credentials.username, credentials.password);
    await expect.poll(() => adminLoginPage.isDashboardExists()).toBe(true);
    await adminCustomersPage.open();
    await adminCustomersPage.searchByEmail(customerData.email);
    await adminCustomersPage.openCustomer(customerData.email);
    await adminCustomersPage.setStatus('Enabled');
    await expect.poll(() => adminCustomersPage.getSuccessMessage()).toContain('Success: You have modified customers!');
    const rows = await getCustomersByEmail(customerData.email);
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_id).toBe(registeredCustomer.customer_id);
    expect(rows[0].status, 'Admin enable must persist status=1').toBe(1);
  });
  await test.step('4) Verify a fresh login succeeds after enabling', async () => {
    // Prove re-enabling restores authentication, not just the database's displayed status.
    await context.clearCookies();
    await homePage.open();
    await homePage.openLogin();
    await loginPage.login(customerData.email, customerData.password);
    await expect(page).toHaveURL(/route=account\/account/);
    await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(true);
  });
  console.log('✅ Admin status and frontend authentication agree with MySQL.');
});

/**
 * Test case: Changing a password replaces the stored credential and changes login behavior.
 * Flow: capture the original stored value -> change the password through the UI -> verify
 * changed, non-plaintext storage -> reject the old password -> accept the new password.
 * Passwords and stored hashes are compared without printing their contents in assertion diffs.
 */
test('Password changes persist and replace the old credentials @master @regression @end-to-end @web @db', async ({
  customerData, registeredCustomer, homePage, myAccountPage, changePasswordPage, loginPage, page, context,
}) => {
  const newPassword = `${RandomDataUtil.getPassword()}New`;
  // Read the stored value before the UI change; this test does not assume a hash algorithm.
  const before = await executeQuery('SELECT password FROM oc_customer WHERE customer_id = ?', [registeredCustomer.customer_id]) as RowDataPacket[];
  expect(before).toHaveLength(1);
  await test.step('1) Change the password through the customer UI', async () => {
    await homePage.openAccount();
    await myAccountPage.openChangePassword();
    await expect.poll(() => changePasswordPage.isChangePasswordPageExists()).toBe(true);
    await changePasswordPage.changePassword(newPassword);
    await expect(page).toHaveURL(/route=account\/account/);
    await expect.poll(() => myAccountPage.getSuccessMessage()).toContain('Success: Your password has been successfully updated.');
  });
  await test.step('2) Verify the stored password changed without exposing password material', async () => {
    const after = await executeQuery('SELECT password FROM oc_customer WHERE customer_id = ?', [registeredCustomer.customer_id]) as RowDataPacket[];
    expect(after).toHaveLength(1);
    // Boolean assertions prevent password/hash values from appearing in failure diffs.
    expect(after[0].password !== before[0].password, 'The stored password must change').toBe(true);
    expect(after[0].password !== newPassword, 'MySQL must not store the new password as plaintext').toBe(true);
  });
  await test.step('3) Reject the old password in a fresh customer session', async () => {
    // Discard the authenticated registration session before testing the old credential.
    await context.clearCookies();
    await homePage.open();
    await homePage.openLogin();
    await loginPage.login(customerData.email, customerData.password);
    await expect.poll(() => loginPage.getWarning()).toBe('Warning: No match for E-Mail Address and/or Password.');
    await expect(page).toHaveURL(/route=account\/login/);
    expect(await myAccountPage.isEditAccountAvailable()).toBe(false);
  });
  await test.step('4) Authenticate with the new password', async () => {
    await loginPage.login(customerData.email, newPassword);
    await expect(page).toHaveURL(/route=account\/account/);
    await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(true);
  });
  console.log('✅ Password storage changed; only the new credentials authenticate.');
});

/**
 * Test case: Admin deletion removes the intended customer and its defined related records.
 * Flow: confirm a real child IP row exists -> delete the exact customer in Admin -> verify
 * the customer and the related rows listed in the installed OpenCart delete implementation.
 * The fixture retains the ID so teardown can remove any test-owned records the app leaves.
 */
test('Admin deletion removes the customer and related lifecycle records @master @regression @end-to-end @web @db', async ({
  customerData, registeredCustomer, adminLoginPage, adminCustomersPage,
}) => {
  const id = registeredCustomer.customer_id;
  await test.step('1) Confirm the customer has a related IP record before deletion', async () => {
    // Without an existing child row, a zero-after-deletion check could pass without testing removal.
    const ipRows = await executeQuery('SELECT customer_id FROM oc_customer_ip WHERE customer_id = ?', [id]);
    expect(ipRows, 'The deletion test must exercise a real child record').not.toHaveLength(0);
  });
  await test.step('2) Delete only the generated customer through Admin', async () => {
    const credentials = Helper.getAdminLoginDetails();
    await adminLoginPage.open();
    await adminLoginPage.login(credentials.username, credentials.password);
    await expect.poll(() => adminLoginPage.isDashboardExists()).toBe(true);
    await adminCustomersPage.open();
    await adminCustomersPage.searchByEmail(customerData.email);
    await expect.poll(() => adminCustomersPage.getCustomerCount(customerData.email)).toBe(1);
    await adminCustomersPage.deleteCustomer(customerData.email);
    await expect.poll(() => adminCustomersPage.getSuccessMessage()).toContain('Success: You have modified customers!');
    await expect.poll(() => adminCustomersPage.getCustomerCount(customerData.email)).toBe(0);
  });
  await test.step('3) Verify all customer-ID deletions defined by the installed OpenCart model', async () => {
    // Query by the captured ID because the parent customer can no longer be found by email.
    for (const table of [
      'oc_customer', 'oc_customer_activity', 'oc_customer_affiliate', 'oc_customer_approval',
      'oc_customer_history', 'oc_customer_reward', 'oc_customer_transaction', 'oc_customer_ip', 'oc_address',
    ]) {
      const rows = await executeQuery(`SELECT customer_id FROM ${table} WHERE customer_id = ?`, [id]);
      expect(rows, `Admin deletion must remove this customer's records from ${table}`).toHaveLength(0);
    }
    // OpenCart does not delete customer_online here; fixture teardown removes that test-owned row.
  });
  console.log('✅ Admin deletion removed the customer and its defined related records.');
});
