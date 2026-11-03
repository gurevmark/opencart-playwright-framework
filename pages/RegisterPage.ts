import { type Page, type Locator } from '@playwright/test';

export type Customer = { firstName: string; lastName: string; email: string; telephone: string; password: string };

/**
 * Registration form and account-created confirmation.
 * Filling fields and accepting the privacy policy are grouped into one reusable action.
 */
export class RegisterPage {
  private readonly page: Page;

  // Locators
  private readonly confirmationLocator: Locator;
  private readonly headingLocator: Locator;
  private readonly content: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.content = page.locator('#content');
    this.headingLocator = this.content.getByRole('heading', { name: 'Register Account', exact: true });
    this.confirmationLocator = this.content.getByRole('heading', { name: 'Your Account Has Been Created!', exact: true });
  }

  /**
   * Checks whether the registration page is visible.
   * @returns Whether the element is visible.
   */
  async isRegisterPageExists(): Promise<boolean> {
    return this.headingLocator.isVisible();
  }

  /**
   * Checks the account-created confirmation heading.
   * @returns Whether the element is visible.
   */
  async isAccountCreated(): Promise<boolean> {
    return this.confirmationLocator.isVisible();
  }

  /**
   * Completes registration.
   * @param customer Newly generated customer data.
   * @param options Optional confirmation and privacy choices for validation tests.
   * @returns Completion of the action.
   */
  async completeRegistration(customer: Customer, options: { passwordConfirmation?: string; acceptPrivacyPolicy?: boolean } = {}): Promise<void> {
    try {
      await this.content.getByRole('textbox', { name: 'First Name' }).fill(customer.firstName);
      await this.content.getByRole('textbox', { name: 'Last Name' }).fill(customer.lastName);
      await this.content.getByRole('textbox', { name: 'E-Mail' }).fill(customer.email);
      await this.content.getByRole('textbox', { name: 'Telephone' }).fill(customer.telephone);
      await this.content.getByRole('textbox', { name: '* Password', exact: true }).fill(customer.password);
      await this.content.getByRole('textbox', { name: 'Password Confirm' }).fill(options.passwordConfirmation ?? customer.password);
      await this.content.getByRole('checkbox').setChecked(options.acceptPrivacyPolicy ?? true);
      await this.content.getByRole('button', { name: 'Continue', exact: true }).click();
    } catch (error) {
      console.log('RegisterPage.completeRegistration failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /** @returns The displayed registration errors without surrounding whitespace. */
  async getValidationErrors(): Promise<string[]> {
    // OpenCart renders page-level duplicate/privacy warnings outside #content.
    return (await this.page.locator('.text-danger, .alert-danger').allTextContents()).map(text => text.trim());
  }
}
