import { type Page, type Locator } from '@playwright/test';
import { type Customer } from './RegisterPage';

export class AccountEditPage {
  private readonly page: Page;

  // Locators
  private readonly content: Locator;
  private readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.content = page.locator('#content');
    this.heading = this.content.getByRole('heading', { name: 'My Account Information', exact: true });
  }

  /** @returns Whether the account-edit heading is displayed. */
  async isAccountEditPageExists(): Promise<boolean> {
    return this.heading.isVisible();
  }

  /**
   * Saves the customer's account identity and contact fields.
   * @param customer Updated identity and contact data.
   * @returns Completion of submission; the test verifies its outcome.
   */
  async updateDetails(customer: Pick<Customer, 'firstName' | 'lastName' | 'email' | 'telephone'>): Promise<void> {
    try {
      await this.content.getByRole('textbox', { name: 'First Name' }).fill(customer.firstName);
      await this.content.getByRole('textbox', { name: 'Last Name' }).fill(customer.lastName);
      await this.content.getByRole('textbox', { name: 'E-Mail' }).fill(customer.email);
      await this.content.getByRole('textbox', { name: 'Telephone' }).fill(customer.telephone);
      await this.content.getByRole('button', { name: 'Continue', exact: true }).click();
    } catch (error) {
      console.log('AccountEditPage.updateDetails failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }
}
