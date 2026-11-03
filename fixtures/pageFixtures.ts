/**
 * Shared web-test fixtures: one page-object instance per requested fixture and test.
 * All objects wrap Playwright's same test-scoped page; none creates its own browser.
 * Only homePage navigates automatically. Other fixtures merely expose page actions.
 * Import test/expect from this module in web specs to use these fixtures.
 */
import { test as base } from '@playwright/test';
import dotenv from 'dotenv';
import { HomePage } from '../pages/HomePage';
import { RegisterPage } from '../pages/RegisterPage';
import { LoginPage } from '../pages/LoginPage';
import { MyAccountPage } from '../pages/MyAccountPage';
import { LogoutPage } from '../pages/LogoutPage';
import { SearchPage } from '../pages/SearchPage';
import { ProductPage } from '../pages/ProductPage';
import { CartPage } from '../pages/CartPage';
import { AdminLoginPage } from '../pages/AdminLoginPage';
import { AdminCustomersPage } from '../pages/AdminCustomersPage';
import { AccountEditPage } from '../pages/AccountEditPage';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';

dotenv.config({ quiet: true });

/** Fixture names available for destructuring in a web-test callback. */
type PageFixtures = {
  homePage: HomePage;
  registerPage: RegisterPage;
  loginPage: LoginPage;
  myAccountPage: MyAccountPage;
  logoutPage: LogoutPage;
  searchPage: SearchPage;
  productPage: ProductPage;
  cartPage: CartPage;
  adminLoginPage: AdminLoginPage;
  adminCustomersPage: AdminCustomersPage;
  accountEditPage: AccountEditPage;
  changePasswordPage: ChangePasswordPage;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    const url = process.env.WEB_APP_URL;
    if (!url) throw new Error('WEB_APP_URL must be configured in .env');
    await page.goto(url);
    // use() hands the ready object to the test and resolves after the test finishes.
    await use(new HomePage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  myAccountPage: async ({ page }, use) => {
    await use(new MyAccountPage(page));
  },
  logoutPage: async ({ page }, use) => {
    await use(new LogoutPage(page));
  },
  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  adminLoginPage: async ({ page }, use) => {
    await use(new AdminLoginPage(page));
  },
  adminCustomersPage: async ({ page }, use) => {
    await use(new AdminCustomersPage(page));
  },
  accountEditPage: async ({ page }, use) => {
    await use(new AccountEditPage(page));
  },
  changePasswordPage: async ({ page }, use) => {
    await use(new ChangePasswordPage(page));
  },
});

// Explicit cleanup follows the supplied framework context; browser state never carries to another test.
test.afterEach(async ({ page, context }) => {
  if (!page.isClosed()) await page.close();
  await context.close();
});

export { expect } from '@playwright/test';
