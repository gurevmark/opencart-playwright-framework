import { type Page, type Locator } from '@playwright/test';

export class ChangePasswordPage {
  private readonly page: Page;

  // Locators
  private readonly content: Locator;
  private readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.content = page.locator('#content');
    this.heading = this.content.getByRole('heading', { name: 'Change Password', exact: true });
  }

  /** @returns Whether the change-password page is displayed. */
  async isChangePasswordPageExists(): Promise<boolean> {
    return this.heading.isVisible();
  }

  /**
   * Submits the same generated password in both password fields.
   * @param password New generated customer password.
   * @returns Completion of submission; the test verifies its outcome.
   */
  async changePassword(password: string): Promise<void> {
    try {
      await this.content.getByRole('textbox', { name: '* Password', exact: true }).fill(password);
      await this.content.getByRole('textbox', { name: 'Password Confirm' }).fill(password);
      await this.content.getByRole('button', { name: 'Continue', exact: true }).click();
    } catch (error) {
      console.log('ChangePasswordPage.changePassword failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }
}
