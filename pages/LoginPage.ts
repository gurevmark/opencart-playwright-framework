import { type Page, type Locator } from '@playwright/test';

/**
 * Login form actions and observed state.
 * Submitting credentials does not imply success; each spec asserts the expected outcome.
 */
export class LoginPage {
  private readonly page: Page;

  // Locators
  private readonly warningLocator: Locator;
  private readonly headingLocator: Locator;
  private readonly emailField: Locator;
  private readonly passwordField: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.emailField = page.getByRole('textbox', { name: 'E-Mail Address', exact: true });
    this.passwordField = page.getByRole('textbox', { name: 'Password', exact: true });
    this.headingLocator = this.page.getByRole('heading', { name: 'Returning Customer', exact: true });
    this.warningLocator = this.page.locator('.alert-danger');
  }

  /**
   * Checks whether the returning-customer login form is visible.
   * @returns Whether the element is visible.
   */
  async isLoginPageExists(): Promise<boolean> {
    return this.headingLocator.isVisible();
  }

  /**
   * Reads the warning state.
   * @returns The displayed value, with surrounding whitespace removed.
   */
  async getWarning(): Promise<string> {
    return (await this.warningLocator.innerText()).trim();
  }

  /**
   * Reads the email field without normalizing its value.
   * @returns The exact input value.
   */
  async getEmail(): Promise<string> {
    return this.emailField.inputValue();
  }

  /**
   * Reads the password field without normalizing its value.
   * @returns The exact input value.
   */
  async getPassword(): Promise<string> {
    return this.passwordField.inputValue();
  }

  /**
   * Submits credentials, keeping whitespace-only values empty.
   * Returns no destination because valid and invalid submissions navigate differently.
   * @param email Customer email.
   * @param password Customer password.
   * @returns Completion of the action.
   */
  async login(email: string, password: string): Promise<void> {
    try {
      // Normalize only whitespace-only inputs; preserve nonblank credentials exactly as supplied.
      await this.emailField.fill(email.trim() ? email : '');
      await this.passwordField.fill(password.trim() ? password : '');
      await this.page.getByRole('button', { name: 'Login', exact: true }).click();
    } catch (error) {
      console.log('LoginPage.login failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }
}
