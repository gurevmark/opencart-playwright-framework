import { type Page, type Locator } from '@playwright/test';

/**
 * Cart rows, quantities, and prices.
 * Dynamic row locators stay private so specs express business checks rather than table structure.
 */
export class CartPage {
  private readonly page: Page;

  // Locators
  private readonly totalLocator: Locator;
  private readonly headingLocator: Locator;
  private readonly content: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.content = page.locator('#content');
    this.headingLocator = this.content.getByRole('heading', { level: 1 });
    // Exact "Total:" excludes "Sub-Total:" from the order summary.
    this.totalLocator = this.content.getByRole('row').filter({ has: this.page.getByRole('cell', { name: 'Total:', exact: true }) }).getByRole('cell').last();
  }

  /**
   * Reads the heading state.
   * @returns The displayed value, with surrounding whitespace removed.
   */
  async getHeading(): Promise<string> {
    return (await this.headingLocator.innerText()).trim();
  }

  /** Returns the selected product row. @param name Exact product name. */
  private productRow(name: string): Locator { return this.content.getByRole('row').filter({ has: this.page.getByRole('link', { name, exact: true }) }); }
  /**
   * Returns the selected product quantity.
   * @param name Exact product name.
   * @returns The requested value.
   */
  async getQuantity(name: string): Promise<string> {
    return (await this.productRow(name).getByRole('textbox').inputValue()).trim();
  }

  /**
   * Returns the unit price in the verified six-column cart table.
   * @param name Exact product name.
   * @returns The requested value.
   */
  async getUnitPrice(name: string): Promise<string> {
    // Verified table order: Image, Product Name, Model, Quantity, Unit Price, Total.
    return (await this.productRow(name).getByRole('cell').nth(4).innerText()).trim();
  }

  /**
   * Returns the line total.
   * @param name Exact product name.
   * @returns The requested value.
   */
  async getLineTotal(name: string): Promise<string> {
    return (await this.productRow(name).getByRole('cell').nth(5).innerText()).trim();
  }

  /**
   * Counts the matching cart rows.
   * @param name Exact product name.
   * @returns Number of matching rows.
   */
  async getProductCount(name: string): Promise<number> {
    return this.productRow(name).count();
  }

  /**
   * Checks the selected cart product.
   * @param name Exact product name.
   * @returns Whether the row is visible.
   */
  async isProductExists(name: string): Promise<boolean> {
    return this.productRow(name).isVisible();
  }

  /**
   * Reads the total state.
   * @returns The displayed value, with surrounding whitespace removed.
   */
  async getTotal(): Promise<string> {
    return (await this.totalLocator.innerText()).trim();
  }
}
