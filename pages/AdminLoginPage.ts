import { type Page, type Locator } from '@playwright/test';

export class AdminLoginPage {
  private readonly page: Page;

  // Locators
  private readonly usernameField: Locator;
  private readonly passwordField: Locator;
  private readonly loginButton: Locator;
  private readonly dashboardHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.usernameField = page.getByRole('textbox', { name: 'Username', exact: true });
    this.passwordField = page.getByRole('textbox', { name: 'Password', exact: true });
    this.loginButton = page.getByRole('button', { name: /Login/ });
    this.dashboardHeading = page.getByRole('heading', { name: 'Dashboard', exact: true });
  }

  /**
   * Opens the Admin portal relative to the configured storefront URL.
   * @returns Completion of navigation.
   */
  async open(): Promise<void> {
    const url = process.env.WEB_APP_URL;
    if (!url) throw new Error('WEB_APP_URL must be configured in .env');
    await this.page.goto(new URL('admin/index.php', url).href);
  }

  /**
   * Authenticates an administrator.
   * @param username Configured administrator username.
   * @param password Configured administrator password.
   * @returns Completion of the login action.
   */
  async login(username: string, password: string): Promise<void> {
    try {
      await this.usernameField.fill(username);
      await this.passwordField.fill(password);
      await this.loginButton.click();
    } catch (error) {
      console.log('AdminLoginPage.login failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /**
   * Checks whether the authenticated dashboard is displayed.
   * @returns Whether the dashboard heading is visible.
   */
  async isDashboardExists(): Promise<boolean> {
    return this.dashboardHeading.isVisible();
  }
}
