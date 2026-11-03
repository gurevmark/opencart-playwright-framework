import { type Page, type Locator } from '@playwright/test';
import { CartPage } from './CartPage';

/**
 * Product details, quantity entry, and asynchronous add-to-cart confirmation.
 */
export class ProductPage {
  private readonly page: Page;

  // Locators
  private readonly confirmationLocator: Locator;
  private readonly priceLocator: Locator;
  private readonly headingLocator: Locator;
  private readonly content: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.content = page.locator('#content');
    this.headingLocator = this.content.getByRole('heading', { level: 1 });
    this.priceLocator = this.content.getByRole('heading', { level: 2 });
    this.confirmationLocator = this.page.locator('.alert-success');
  }

  /**
   * Reads the heading state.
   * @returns The displayed value, with surrounding whitespace removed.
   */
  async getProductName(): Promise<string> {
    return (await this.headingLocator.innerText()).trim();
  }

  /**
   * Reads the price state.
   * @returns The displayed value, with surrounding whitespace removed.
   */
  async getPrice(): Promise<string> {
    return (await this.priceLocator.innerText()).trim();
  }

  /**
   * Reads the confirmation state.
   * @returns The displayed value, with surrounding whitespace removed.
   */
  async getConfirmation(): Promise<string> {
    return (await this.confirmationLocator.innerText()).trim();
  }

  /**
   * Adds the requested quantity.
   * @param quantity Number of items as text.
   * @returns Completion of the action.
   */
  async addToCart(quantity: string): Promise<void> {
    try {
      await this.content.getByRole('textbox', { name: 'Qty', exact: true }).fill(quantity);
      await this.content.getByRole('button', { name: 'Add to Cart', exact: true }).click();
    } catch (error) {
      console.log('ProductPage.addToCart failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /**
   * Opens the cart from the success message after the asynchronous addition completes.
   * @returns The CartPage for the destination.
   */
  async openCart(): Promise<CartPage> {
    try {
      // This link appears after the add-to-cart response; clicking it auto-waits for readiness.
      await this.confirmationLocator.getByRole('link', { name: 'shopping cart', exact: true }).click();
      return new CartPage(this.page);
    } catch (error) {
      console.log('ProductPage.openCart failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }
}
