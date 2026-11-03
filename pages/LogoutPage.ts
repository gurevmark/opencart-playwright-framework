import { type Page, type Locator } from '@playwright/test';
import { HomePage } from './HomePage';

/**
 * Logout confirmation and the Continue action that returns to the storefront.
 */
export class LogoutPage {
  private readonly page: Page;

  // Locators
  private readonly confirmationLocator: Locator;
  private readonly headingLocator: Locator;
  private readonly content: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.content = page.locator('#content');
    this.headingLocator = this.content.getByRole('heading', { name: 'Account Logout', exact: true });
    this.confirmationLocator = this.content.getByText('You have been logged off your account.', { exact: false });
  }

  /**
   * Checks whether the logout page is visible.
   * @returns Whether the element is visible.
   */
  async isLogoutPageExists(): Promise<boolean> {
    return this.headingLocator.isVisible();
  }

  /**
   * Checks the logged-off confirmation text.
   * @returns Whether the element is visible.
   */
  async isLogoutConfirmed(): Promise<boolean> {
    return this.confirmationLocator.isVisible();
  }

  /**
   * Continues to the homepage.
   * @returns The HomePage for the destination.
   */
  async clickContinue(): Promise<HomePage> {
    try {
      await this.content.getByRole('link', { name: 'Continue', exact: true }).click();
      return new HomePage(this.page);
    } catch (error) {
      console.log('LogoutPage.clickContinue failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }
}
