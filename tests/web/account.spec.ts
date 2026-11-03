/**
 * Customer account scenarios from prompts/opencart_web_test_prompts.md (1–4).
 *
 * Each test receives its own browser context through the custom fixtures.
 * The homePage fixture opens WEB_APP_URL before the first test step executes.
 * Page objects perform UI actions; assertions here define the expected behavior.
 * expect.poll() retries boolean/value reads without exposing page-object locators.
 */
import { test, expect } from '../../fixtures/pageFixtures';
import { RandomDataUtil } from '../../utils/dataGenerator';
import { Helper } from '../../utils/helper';

const loginWarning = 'Warning: No match for E-Mail Address and/or Password.';

/**
 * Scenario 1: Register a unique customer, verify the success page, then open My Account.
 * The generated email avoids collisions with accounts from earlier executions.
 * Registration persists a customer in OpenCart; closing the browser does not delete it.
 */
test('Customer registration @master @sanity @regression @web', async ({ homePage, registerPage, myAccountPage, page }) => {
  const customer = RandomDataUtil.generateCustomerPayload();
  await test.step('1) Open registration', async () => {
    await homePage.openRegistration();
    await expect.poll(() => registerPage.isRegisterPageExists()).toBe(true);
    await expect(page).toHaveURL(/route=account\/register/);
  });
  await test.step('2) Register a unique customer and accept the privacy policy', async () => {
    await registerPage.completeRegistration(customer);
    await expect.poll(() => registerPage.isAccountCreated()).toBe(true);
    await expect(page).toHaveURL(/route=account\/success/);
  });
  await test.step('3) Access the newly created account through account navigation', async () => {
    // A confirmation heading alone does not prove the new account is accessible.
    await homePage.openAccount();
    await expect(page).toHaveURL(/route=account\/account/);
    await expect.poll(() => myAccountPage.isMyAccountPageExists()).toBe(true);
    await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(true);
  });
  console.log('✅ Customer registration completed successfully.');
});

/**
 * Scenario 2: Authenticate an existing customer and verify the account dashboard.
 * Prerequisite: APP_EMAIL/APP_PASSWORD identify an enabled, unlocked customer.
 * This test intentionally does not create or repair that configured account.
 */
test('Valid customer login @master @sanity @regression @web', async ({ homePage, loginPage, myAccountPage, page }) => {
  const { email, password } = Helper.getLoginDetails();
  await test.step('1) Open login through My Account', async () => {
    await homePage.openLogin();
    await expect.poll(() => loginPage.isLoginPageExists()).toBe(true);
    await expect(page).toHaveURL(/route=account\/login/);
  });
  await test.step('2) Authenticate with configured credentials', async () => {
    await loginPage.login(email, password);
    await expect(page).toHaveURL(/route=account\/account/);
    await expect.poll(() => myAccountPage.isMyAccountPageExists()).toBe(true);
    await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(true);
  });
  console.log('✅ Valid login completed successfully.');
});

/**
 * Scenario 3: Reject an unregistered email with the exact no-match warning.
 * A unique email keeps this scenario independent of previous failed-login counters.
 * Guest navigation and the absence of account-edit access confirm authentication failed.
 */
test('Invalid customer login @master @regression @web', async ({ homePage, loginPage, myAccountPage, page }) => {
  const customer = RandomDataUtil.generateCustomerPayload();
  await test.step('1) Open login and submit unregistered credentials', async () => {
    await homePage.openLogin();
    await loginPage.login(customer.email, customer.password);
  });
  await test.step('2) Verify rejection and unauthenticated navigation', async () => {
    await expect.poll(() => loginPage.getWarning()).toEqual(loginWarning);
    await expect(page).toHaveURL(/route=account\/login/);
    await expect.poll(() => loginPage.isLoginPageExists()).toBe(true);
    await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(false);
    // Open the dropdown before checking which account actions the user can access.
    await homePage.clickMyAccount();
    await expect.poll(() => homePage.isAccountOptionAvailable('Login')).toBe(true);
    await expect.poll(() => homePage.isAccountOptionAvailable('Logout')).toBe(false);
  });
  console.log('✅ Invalid credentials were rejected.');
});

/**
 * Scenario 4: Authenticate, log out, confirm the logout page, then return home.
 * Requires the same existing customer as the valid-login test.
 * Failure in step 1 is an authentication prerequisite failure, not a logout defect.
 */
test('Customer logout @master @sanity @regression @web', async ({ homePage, loginPage, myAccountPage, logoutPage, page }) => {
  const { email, password } = Helper.getLoginDetails();
  await test.step('1) Authenticate', async () => {
    await homePage.openLogin();
    await loginPage.login(email, password);
    await expect.poll(() => myAccountPage.isMyAccountPageExists()).toBe(true);
    await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(true);
  });
  await test.step('2) Log out and verify confirmation', async () => {
    await homePage.logout();
    await expect.poll(() => logoutPage.isLogoutPageExists()).toBe(true);
    await expect.poll(() => logoutPage.isLogoutConfirmed()).toBe(true);
    await expect(page).toHaveURL(/route=account\/logout/);
  });
  await test.step('3) Continue home and verify authenticated options are unavailable', async () => {
    await logoutPage.clickContinue();
    await expect(page).toHaveURL(/route=common\/home/);
    await expect.poll(() => homePage.isHomePageExists()).toBe(true);
    // Open the dropdown before checking which account actions the user can access.
    await homePage.clickMyAccount();
    await expect.poll(() => homePage.isAccountOptionAvailable('Login')).toBe(true);
    await expect.poll(() => homePage.isAccountOptionAvailable('Register')).toBe(true);
    await expect.poll(() => homePage.isAccountOptionAvailable('Logout')).toBe(false);
    await expect.poll(() => homePage.isAccountOptionAvailable('Transactions')).toBe(false);
  });
  console.log('✅ Customer logout completed successfully.');
});
