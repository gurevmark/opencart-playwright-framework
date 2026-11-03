import { type Page, type Locator } from '@playwright/test';
import { AccountEditPage } from './AccountEditPage';
import { ChangePasswordPage } from './ChangePasswordPage';

/**
 * Authenticated dashboard state used to distinguish login success from a guest page.
 */
export class MyAccountPage {
  private readonly page: Page;

  // Locators
  private readonly editAccountLocator: Locator;
  private readonly headingLocator: Locator;
  private readonly content: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.content = page.locator('#content');
    this.headingLocator = this.content.getByRole('heading', { name: 'My Account', exact: true });
    this.editAccountLocator = this.content.getByRole('link', { name: 'Edit your account information', exact: true });
  }

  /**
   * Checks whether the account dashboard is visible.
   * @returns Whether the element is visible.
   */
  async isMyAccountPageExists(): Promise<boolean> {
    return this.headingLocator.isVisible();
  }

  /**
   * Checks whether the authenticated account-edit link is visible.
   * @returns Whether the element is visible.
   */
  async isEditAccountAvailable(): Promise<boolean> {
    return this.editAccountLocator.isVisible();
  }

  /** @returns The account-edit page after following the account dashboard link. */
  async openAccountEdit(): Promise<AccountEditPage> {
    await this.editAccountLocator.click();
    return new AccountEditPage(this.page);
  }

  /** @returns The change-password page after following the account dashboard link. */
  async openChangePassword(): Promise<ChangePasswordPage> {
    await this.content.getByRole('link', { name: 'Change your password', exact: true }).click();
    return new ChangePasswordPage(this.page);
  }

  /** @returns The displayed success confirmation. */
  async getSuccessMessage(): Promise<string> {
    return (await this.page.locator('.alert-success').innerText()).trim();
  }
}
