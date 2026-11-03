/**
 * Catalogue and shopping scenarios from the web prompt (5–7).
 *
 * Product name, quantity, and expected total come from Helper.getProductDetails().
 * Search and add-to-cart run as guests; the full journey creates its own customer.
 * No checkout or order submission is performed: the journey ends at cart validation.
 */
import { test, expect } from '../../fixtures/pageFixtures';
import { Helper } from '../../utils/helper';
import { RandomDataUtil } from '../../utils/dataGenerator';

/**
 * Scenario 5: Search for a known product and verify its exact result name.
 * Exact matching distinguishes MacBook from similarly named Air/Pro products.
 */
test('Product search @master @sanity @regression @web', async ({ homePage, searchPage, page }) => {
  const { productName } = Helper.getProductDetails();
  await test.step('1) Search for the configured product', async () => {
    await homePage.search(productName);
    await expect(page).toHaveURL(/route=product\/search/);
    await expect.poll(() => searchPage.getHeading()).toEqual(`Search - ${productName}`);
  });
  await test.step('2) Verify the exact product appears in results', async () => {
    await expect.poll(() => searchPage.isProductExists(productName)).toBe(true);
    await expect.poll(() => searchPage.getProductName(productName)).toBe(productName);
  });
  console.log('✅ Product search completed successfully.');
});

/**
 * Scenario 6: Open a product, set its quantity, add it, and inspect the cart row.
 * Both the success message and cart contents are checked: a message alone is insufficient.
 * The fresh guest context prevents quantities from accumulating across test runs.
 */
test('Add product to cart @master @sanity @regression @web', async ({ homePage, searchPage, productPage, cartPage }) => {
  const { productName, productQuantity } = Helper.getProductDetails();
  await test.step('1) Search and open the product details', async () => {
    await homePage.search(productName);
    await searchPage.openProduct(productName);
    await expect.poll(() => productPage.getProductName()).toEqual(productName);
  });
  await test.step('2) Add the requested quantity', async () => {
    await productPage.addToCart(productQuantity);
    await expect.poll(() => productPage.getConfirmation()).toContain(`Success: You have added ${productName} to your shopping cart!`);
  });
  await test.step('3) Verify the cart product and quantity', async () => {
    await productPage.openCart();
    await expect.poll(() => cartPage.getHeading()).toContain('Shopping Cart');
    await expect.poll(() => cartPage.getProductCount(productName)).toBe(1);
    await expect.poll(() => cartPage.isProductExists(productName)).toBe(true);
    await expect.poll(() => cartPage.getQuantity(productName)).toBe(productQuantity);
  });
  console.log('✅ Product added with the requested quantity.');
});

/**
 * Scenario 7: Register → log out → log in → search → add → validate cart prices.
 * The same generated credentials are reused inside this single continuous journey.
 * No other test's registration or login state is required.
 * Price checks compare the product display, cart unit price, quantity-based line total,
 * and the independently configured final total for this single-product cart.
 */
test('Complete customer shopping journey @master @regression @end-to-end @web', async ({ homePage, registerPage, myAccountPage, logoutPage, loginPage, searchPage, productPage, cartPage, page }) => {
  const customer = RandomDataUtil.generateCustomerPayload();
  const { productName, productQuantity, totalPrice } = Helper.getProductDetails();
  // Capture the product-page price before navigating away so the cart can be compared.
  let displayedUnitPrice = '';
  await test.step('1) Register a new customer and verify account access', async () => {
    await homePage.openRegistration();
    await expect.poll(() => registerPage.isRegisterPageExists()).toBe(true);
    await registerPage.completeRegistration(customer);
    await expect.poll(() => registerPage.isAccountCreated()).toBe(true);
    await homePage.openAccount();
    await expect.poll(() => myAccountPage.isMyAccountPageExists()).toBe(true);
  });
  await test.step('2) Log out and log back in with the new credentials', async () => {
    await homePage.logout();
    await expect.poll(() => logoutPage.isLogoutPageExists()).toBe(true);
    await logoutPage.clickContinue();
    await homePage.openLogin();
    await loginPage.login(customer.email, customer.password);
    await expect(page).toHaveURL(/route=account\/account/);
    await expect.poll(() => myAccountPage.isMyAccountPageExists()).toBe(true);
    await expect.poll(() => myAccountPage.isEditAccountAvailable()).toBe(true);
  });
  await test.step('3) Search for the product and inspect its price', async () => {
    await homePage.search(productName);
    await expect.poll(() => searchPage.getProductName(productName)).toBe(productName);
    await searchPage.openProduct(productName);
    await expect.poll(() => productPage.getProductName()).toEqual(productName);
    await expect.poll(() => productPage.getPrice()).toMatch(/\$[\d,.]+/);
    displayedUnitPrice = (await productPage.getPrice()).trim();
  });
  await test.step('4) Add the product and verify the confirmation', async () => {
    await productPage.addToCart(productQuantity);
    await expect.poll(() => productPage.getConfirmation()).toContain(`Success: You have added ${productName} to your shopping cart!`);
    await productPage.openCart();
  });
  await test.step('5) Verify product, quantity, unit price, line total, and final total', async () => {
    await expect.poll(() => cartPage.getHeading()).toContain('Shopping Cart');
    await expect.poll(() => cartPage.getProductCount(productName)).toBe(1);
    await expect.poll(() => cartPage.getQuantity(productName)).toBe(productQuantity);
    await expect.poll(() => cartPage.getUnitPrice(productName)).toBe(displayedUnitPrice);
    // Prices include the tax shown by this store; compare numeric totals to two decimals.
    const expectedLineTotal = Helper.convertPriceToNumber(displayedUnitPrice) * Number(productQuantity);
    expect(Helper.convertPriceToNumber(await cartPage.getLineTotal(productName))).toBeCloseTo(expectedLineTotal, 2);
    // This fixture expects one product and no coupons, shipping charges, or other adjustments.
    await expect.poll(() => cartPage.getTotal()).toEqual(totalPrice);
    expect(Helper.convertPriceToNumber(await cartPage.getTotal())).toBeCloseTo(expectedLineTotal, 2);
  });
  console.log('✅ Registration, re-login, search, and cart validation completed successfully.');
});
