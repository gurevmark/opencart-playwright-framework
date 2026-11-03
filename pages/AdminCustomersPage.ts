import { type Page, type Locator } from '@playwright/test';
import { type Customer } from './RegisterPage';

export class AdminCustomersPage {
  private readonly page: Page;

  // Locators
  private readonly customersLink: Locator;
  private readonly emailFilter: Locator;
  private readonly filterButton: Locator;
  private readonly customerRows: Locator;
  private readonly customerForm: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators with CSS selectors and verified accessible roles.
    this.customersLink = page.locator('#menu-customer a[href*="route=customer/customer&"]');
    this.emailFilter = page.getByRole('textbox', { name: 'E-Mail', exact: true });
    this.filterButton = page.getByRole('button', { name: /Filter/ });
    this.customerRows = page.getByRole('row');
    this.customerForm = page.locator('#form-customer');
  }

  /**
   * Follows the Customers link with its current Admin session token.
   * @returns Completion of navigation.
   */
  async open(): Promise<void> {
    // Following the real link also avoids the dashboard's storage reminder overlay.
    const href = await this.customersLink.getAttribute('href');
    if (!href) throw new Error('Admin Customers navigation link is missing its URL');
    await this.page.goto(href);
  }

  /**
   * Filters customers by the unique registration email.
   * @param email Newly registered customer email.
   * @returns Completion of filtering.
   */
  async searchByEmail(email: string): Promise<void> {
    try {
      await this.emailFilter.fill(email);
      await this.filterButton.click();
      await this.page.waitForURL(url => url.searchParams.get('filter_email') === email);
    } catch (error) {
      console.log('AdminCustomersPage.searchByEmail failed:', error instanceof Error ? error.name : 'Unknown error');
      throw error;
    }
  }

  /**
   * Counts exact email matches in the filtered customer table.
   * @param email Newly registered customer email.
   * @returns Number of matching rows.
   */
  async getCustomerCount(email: string): Promise<number> {
    return this.customerRows.filter({ has: this.page.getByRole('cell', { name: email, exact: true }) }).count();
  }

  /**
   * Opens the exact customer's details using its verified edit link.
   * @param email Newly registered customer email.
   * @returns Completion of navigation.
   */
  async openCustomer(email: string): Promise<void> {
    const row = this.customerRows.filter({ has: this.page.getByRole('cell', { name: email, exact: true }) });
    // The edit icon has no accessible name after OpenCart initializes its tooltip.
    await row.locator('a[href*="route=customer/customer/edit&"]').click();
    await this.customerForm.waitFor({ state: 'visible' });
  }

  /**
   * Reads the saved identity fields and displayed registration status.
   * @returns Customer identity and selected status label.
   */
  async getCustomerDetails(): Promise<Pick<Customer, 'firstName' | 'lastName' | 'email'> & { status: string }> {
    return {
      firstName: await this.customerForm.getByRole('textbox', { name: 'First Name' }).inputValue(),
      lastName: await this.customerForm.getByRole('textbox', { name: 'Last Name' }).inputValue(),
      email: await this.customerForm.getByRole('textbox', { name: 'E-Mail' }).inputValue(),
      status: (await this.customerForm.getByRole('combobox', { name: 'Status', exact: true }).locator('option:checked').innerText()).trim(),
    };
  }

  /**
   * Saves a status change on the currently open customer-edit form.
   * @param status Displayed status option.
   * @returns Completion of submission.
   */
  async setStatus(status: 'Enabled' | 'Disabled'): Promise<void> {
    await this.customerForm.getByRole('combobox', { name: 'Status', exact: true }).selectOption({ label: status });
    await this.page.locator('button[form="form-customer"]').click();
  }

  /**
   * Deletes only the exact customer selected in the filtered list.
   * @param email Unique test customer email.
   * @returns Completion of the confirmed delete action.
   */
  async deleteCustomer(email: string): Promise<void> {
    const row = this.customerRows.filter({ has: this.page.getByRole('cell', { name: email, exact: true }) });
    await row.getByRole('checkbox').check();
    this.page.once('dialog', dialog => dialog.accept());
    // OpenCart's delete icon has no accessible name after tooltip initialization.
    await this.page.locator('button.btn-danger').click();
  }

  /** @returns The displayed Admin success confirmation. */
  async getSuccessMessage(): Promise<string> {
    return (await this.page.locator('.alert-success').innerText()).trim();
  }
}
