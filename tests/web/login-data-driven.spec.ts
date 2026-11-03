/**
 * External-data login scenario from the web prompt (8).
 *
 * The dataset is read during test discovery, producing one independent test per row.
 * A success row requires an existing enabled customer with matching credentials.
 * The success row references APP_EMAIL/APP_PASSWORD; failure rows remain literal data.
 * Whitespace-only inputs are submitted as empty strings by LoginPage.login().
 */
import path from 'node:path';
import { test, expect } from '../../fixtures/pageFixtures';
import { DataProvider } from '../../utils/DataReader';
import { Helper } from '../../utils/helper';

/** One external login case; both supported scenario-name spellings are accepted. */
type LoginRow = {
  testName?: string;
  TestName?: string;
  email: string;
  password: string;
  expected: 'success' | 'failure';
};

// Resolve from this spec so dataset loading does not depend on the shell working directory.
const rows: LoginRow[] = DataProvider.readJson(path.resolve(__dirname, '../../testdata/opencart_logindata.json'));

/** Register each data row as its own test so failures and retries remain independent. */
for (const [index, row] of rows.entries()) {
  // Row numbers keep titles unique when the supplied dataset repeats testName.
  test(`Login row ${index + 1}: ${row.testName ?? row.TestName} @master @regression @datadriven @web`, async ({ homePage, loginPage, myAccountPage, page }) => {
    // Resolve the success row from the same account that container startup creates.
    const credentials = row.expected === 'success' ? Helper.getLoginDetails() : row;
    await test.step('1) Open login and submit the external data row', async () => {
      await homePage.openLogin();
      await expect.poll(() => loginPage.isLoginPageExists()).toBe(true);
      await loginPage.login(credentials.email, credentials.password);
    });
    await test.step('2) Verify the expected authentication outcome', async () => {
      if (row.expected === 'success') {
        await expect(page).toHaveURL(/route=account\/account/);
        await expect.poll(() => myAccountPage.isMyAccountPageExists()).toBe(true);
        await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(true);
      } else {
        expect(row.expected).toBe('failure');
        // Repeated external rows trigger OpenCart's verified one-hour login-attempt limit.
        // Both server responses reject authentication; blanks remain genuinely empty.
        // Coverage limit: a throttled row proves rejection, not the underlying credential rule.
        // The standalone invalid-login test separately requires the exact no-match warning.
        await expect.poll(() => loginPage.getWarning()).toMatch(/^\s*Warning: (?:No match for E-Mail Address and\/or Password\.|Your account has exceeded allowed number of login attempts\. Please try again in 1 hour\.)\s*$/);
        await expect(page).toHaveURL(/route=account\/login/);
        await expect.poll(() => loginPage.isLoginPageExists()).toBe(true);
        await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(false);
        if (!row.email.trim()) await expect.poll(() => loginPage.getEmail()).toBe('');
        if (!row.password.trim()) await expect.poll(() => loginPage.getPassword()).toBe('');
        await homePage.clickMyAccount();
        await expect.poll(() => homePage.isAccountOptionAvailable('Login')).toBe(true);
        await expect.poll(() => homePage.isAccountOptionAvailable('Logout')).toBe(false);
      }
    });
    console.log(`✅ Login data row ${index + 1} matched its expected result.`);
  });
}
