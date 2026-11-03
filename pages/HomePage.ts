import { type Page, type Locator } from '@playwright/test';
import { SearchPage } from './SearchPage';
import { LogoutPage } from './LogoutPage';
import { MyAccountPage } from './MyAccountPage';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

/**
 * Shared storefront navigation available throughout the customer journey.
 * The top navigation is scoped separately from footer links with the same labels.
 */
export class HomePage {
  private readonly page: Page;

  // Locators
  private readonly featuredHeadingLocator: Locator;
  private readonly navigation: Locator;
  private readonly accountMenu: Locator;
  private readonly searchField: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.navigation = page.locator('nav').first();
    this.accountMenu = this.navigation.getByRole('link', { name: /My Account/ }).first();
    this.searchField = page.getByRole('textbox', { name: 'Search', exact: true });
    this.featuredHeadingLocator = this.page.getByRole('heading', { name: 'Featured', exact: true });
  }

  /**
   * Opens the storefront using the existing environment configuration.
   * @returns Completion of navigation.
   */
  async open(): Promise<void> {
    const url = process.env.WEB_APP_URL;
    if (!url) throw new Error('WEB_APP_URL must be configured in .env');
    await this.page.goto(url);
  }

  /**
   * Opens the account menu.
   * @returns Completion of the action.
   */
  async clickMyAccount(): Promise<void> {
    await this.accountMenu.click();
  }

  /**
   * Opens registration from the account menu.
   * @returns The RegisterPage for the destination.
   */
  async openRegistration(): Promise<RegisterPage> {
    try {
      await this.clickMyAccount();
      await this.navigation.getByRole('link', { name: 'Register', exact: true }).click();
      return new RegisterPage(this.page);
    } catch (error) {
      console.log('HomePage.openRegistration failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /**
   * Opens login from the account menu.
   * @returns The LoginPage for the destination.
   */
  async openLogin(): Promise<LoginPage> {
    try {
      await this.clickMyAccount();
      await this.navigation.getByRole('link', { name: 'Login', exact: true }).click();
      return new LoginPage(this.page);
    } catch (error) {
      console.log('HomePage.openLogin failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /**
   * Opens the authenticated account dashboard.
   * @returns The MyAccountPage for the destination.
   */
  async openAccount(): Promise<MyAccountPage> {
    try {
      await this.clickMyAccount();
      await this.navigation.getByRole('link', { name: 'My Account', exact: true }).click();
      return new MyAccountPage(this.page);
    } catch (error) {
      console.log('HomePage.openAccount failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /**
   * Logs out through the account menu.
   * @returns The LogoutPage for the destination.
   */
  async logout(): Promise<LogoutPage> {
    try {
      await this.clickMyAccount();
      await this.navigation.getByRole('link', { name: 'Logout', exact: true }).click();
      return new LogoutPage(this.page);
    } catch (error) {
      console.log('HomePage.logout failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /**
   * Searches the catalogue.
   * @param name Product name.
   * @returns The SearchPage for the destination.
   */
  async search(name: string): Promise<SearchPage> {
    try {
      await this.searchField.fill(name);
      await this.searchField.press('Enter');
      return new SearchPage(this.page);
    } catch (error) {
      console.log('HomePage.search failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /**
   * Checks an account menu option after the menu is opened.
   * @param name Exact menu label.
   * @returns Whether the option is visible.
   */
  async isAccountOptionAvailable(name: string): Promise<boolean> {
    return this.navigation.getByRole('link', { name, exact: true }).isVisible();
  }

  /**
   * Checks whether the homepage featured section is visible.
   * @returns Whether the element is visible.
   */
  async isHomePageExists(): Promise<boolean> {
    return this.featuredHeadingLocator.isVisible();
  }
}
