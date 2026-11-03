import { type Page, type Locator } from '@playwright/test';
import { ProductPage } from './ProductPage';

/**
 * Search-result access with exact product-name matching to avoid selecting similar products.
 */
export class SearchPage {
  private readonly page: Page;

  // Locators
  private readonly headingLocator: Locator;
  private readonly content: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.content = page.locator('#content');
    this.headingLocator = this.content.getByRole('heading', { level: 1 });
  }

  /**
   * Reads the heading state.
   * @returns The displayed value, with surrounding whitespace removed.
   */
  async getHeading(): Promise<string> {
    return (await this.headingLocator.innerText()).trim();
  }

  /** Returns an exact product result. @param name Product name. */
  private product(name: string): Locator { return this.content.getByRole('heading', { name, exact: true, level: 4 }).getByRole('link'); }
  /**
   * Reads the matching product name.
   * @param name Exact product name.
   * @returns The displayed result name.
   */
  async getProductName(name: string): Promise<string> {
    return (await this.product(name).innerText()).trim();
  }

  /**
   * Checks that the requested product is visible.
   * @param name Exact product name.
   * @returns Whether the result is visible.
   */
  async isProductExists(name: string): Promise<boolean> {
    return this.product(name).isVisible();
  }

  /**
   * Opens a product result.
   * @param name Product name.
   * @returns The ProductPage for the destination.
   */
  async openProduct(name: string): Promise<ProductPage> {
    try {
      await this.product(name).click();
      return new ProductPage(this.page);
    } catch (error) {
      console.log('SearchPage.openProduct failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }
}
