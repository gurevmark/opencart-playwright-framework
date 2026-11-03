/**
 * Cart cases cover ownership, date filters, product quantities, schemas, and simulated CRUD responses.
 * Each test uses its own request fixture and can run independently.
 * The CRUD workflow keeps its dependent create, update, and delete steps inside one test.
 * Configuration comes from .env; reusable payloads and boundary values come from test data.
 */
import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { Routes } from '../../api/endpoints/routes';
import { apiConfig, apiData, expectSchema, expectGeneratedId } from '../../utils/fakestoreTestSupport';

dotenv.config({ quiet: true });
test.use({ baseURL: apiConfig.baseURL });

test.describe('FakeStore Carts API Tests', () => {
  // ---------------- GET ----------------
  /**
   * Check that the cart collection contains records in the expected format.
   * Flow: Fetch all carts -> require 200 and a non-empty array -> validate every item schema.
   */
  test('GET - All carts @master @sanity @api', async ({ request }) => {
    const response = await request.get(Routes.GET_ALL_CARTS);
    expect(response.status(), 'List status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Response must be an array').toBe(true);
    expect(body.length, 'List must not be empty').toBeGreaterThan(0);
    // The shared helper uses AJV to check required fields and their types.
    for (const item of body) expectSchema('cart', item);
  });

  /**
   * Check that a read returns the specific cart selected in .env.
   * Flow: Replace the route ID -> require 200 -> compare the returned ID and validate the cart schema.
   */
  test('GET - Cart by ID @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_CART_BY_ID.replace('{id}', String(apiConfig.cartId)));
    expect(response.status(), 'Read status').toBe(200);
    const body = await response.json();
    expect(body.id, 'Returned ID must match requested ID').toBe(apiConfig.cartId);
    expectSchema('cart', body);
  });

  /**
   * Check the normal result limit supplied in .env for carts.
   * Flow: Send the configured limit -> require 200 and the exact count -> validate every item schema.
   */
  test('GET - Carts with limit @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_CARTS_WITH_LIMIT.replace('{limit}', String(apiConfig.limit)));
    expect(response.status(), 'Limit status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Response must be an array').toBe(true);
    expect(body, 'Requested result count').toHaveLength(apiConfig.limit);
    for (const item of body) expectSchema('cart', item);
  });

  for (const order of apiData.sortOrders) {
    /**
     * Create separate ascending and descending cases for the full cart list.
     * Flow: Fetch sorted records -> validate schemas -> compare ID order with a numerically sorted copy.
     */
    test(`GET - Carts sorted ${order} @master @regression @api`, async ({ request }) => {
      const response = await request.get(Routes.GET_CARTS_SORTED.replace('{order}', order));
      expect(response.status(), 'Sort status').toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), 'Response must be an array').toBe(true);
      expect(body.length, 'Sorting requires multiple records').toBeGreaterThan(1);
      for (const item of body) expectSchema('cart', item);
      const ids: number[] = body.map((item: { id: number }) => item.id);
      // Sort a copy so the original response order remains available for comparison.
      const expected = [...ids].sort((a, b) => order === 'asc' ? a - b : b - a);
      expect(ids, `IDs must be sorted ${order}`).toEqual(expected);
    });

  }

  /**
   * Check filtering with the date range supplied in .env, which may have no matches.
   * Flow: Validate the configured dates -> fetch carts -> validate each schema and inclusive date bounds.
   */
  test('GET - Carts by date range @master @regression @api', async ({ request }) => {
    const startDate = Date.parse(apiConfig.startDate);
    const endDate = Date.parse(apiConfig.endDate);
    expect(Number.isFinite(startDate), 'START_DATE must be a valid date').toBe(true);
    expect(Number.isFinite(endDate), 'END_DATE must be a valid date').toBe(true);
    expect(startDate, 'START_DATE must not be after END_DATE').toBeLessThanOrEqual(endDate);
    const response = await request.get(Routes.GET_CARTS_BY_DATE_RANGE.replace('{startdate}', apiConfig.startDate).replace('{enddate}', apiConfig.endDate));
    expect(response.status(), 'Filter status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Carts must be an array').toBe(true);
    // A valid date range may contain no carts; the prompt allows an empty array.
    for (const cart of body) {
      expectSchema('cart', cart);
      const date = Date.parse(cart.date);
      expect(Number.isFinite(date), 'Cart date must be parseable').toBe(true);
      expect(date, 'Cart is on or after start date').toBeGreaterThanOrEqual(startDate);
      expect(date, 'Cart is on or before end date').toBeLessThanOrEqual(endDate);
    }
  });

  /**
   * Check that carts returned for the configured user belong to that user.
   * Flow: Request carts by USER_ID -> require a non-empty array -> validate schemas and ownership.
   */
  test('GET - User carts @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_USER_CART.replace('{userId}', String(apiConfig.userId)));
    expect(response.status(), 'Filter status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Carts must be an array').toBe(true);
    expect(body.length, 'Configured fixture must contain carts').toBeGreaterThan(0);
    for (const cart of body) {
      expectSchema('cart', cart);
      expect(cart.userId, 'Cart belongs to requested user').toBe(apiConfig.userId);
    }
  });

  // ---------------- POST / PUT / DELETE ----------------
  /**
   * Check the create-response contract using deterministic cart data.
   * Flow: Send the cart fixture -> require 201 and a generated ID -> compare submitted fields.
   */
  test('POST - Create cart @master @regression @api', async ({ request }) => {
    const payload = { userId: apiConfig.userId, date: apiConfig.startDate, products: [{ productId: apiConfig.productId, quantity: apiData.cart.quantity }] };
    const response = await request.post(Routes.CREATE_CART, { data: payload });
    expect(response.status(), 'Create status').toBe(201);
    const body = await response.json();
    expectGeneratedId(body.id);
    const createdId = body.id;
    expect(createdId, 'Captured generated ID').toBeGreaterThan(0);
    expect(body.userId, 'Cart owner').toBe(payload.userId);
    expect(body.products, 'Submitted products and quantities').toEqual(payload.products);
    // Compare timestamps because FakeStore may normalize the submitted date to an ISO string.
    expect(Date.parse(body.date), 'Submitted cart date').toBe(Date.parse(payload.date));
  });

  /**
   * Check an update to an existing configured cart, independently of the create test.
   * Flow: PUT fixture changes to the configured ID -> require 200 -> compare the ID and updated fields.
   */
  test('PUT - Update cart @master @regression @api', async ({ request }) => {
    const payload = { userId: apiConfig.userId, date: apiConfig.startDate, products: [{ productId: apiConfig.productId, quantity: apiData.cart.updatedQuantity }] };
    const response = await request.put(Routes.UPDATE_CART.replace('{id}', String(apiConfig.cartId)), { data: payload });
    expect(response.status(), 'Update status').toBe(200);
    const body = await response.json();
    expect(body.userId, 'Cart owner').toBe(payload.userId);
    expect(body.products, 'Submitted products and quantities').toEqual(payload.products);
    expect(Date.parse(body.date), 'Submitted cart date').toBe(Date.parse(payload.date));
    expect(body.id, 'Updated resource ID').toBe(apiConfig.cartId);
  });

  /**
   * Check the delete response for an existing configured cart, independently of other tests.
   * Flow: DELETE by ID -> require 200 -> validate the returned cart schema and ID.
   */
  test('DELETE - Cart @master @regression @api', async ({ request }) => {
    const response = await request.delete(Routes.DELETE_CART.replace('{id}', String(apiConfig.cartId)));
    expect(response.status(), 'Delete status').toBe(200);
    const body = await response.json();
    expectSchema('cart', body);
    expect(body.id, 'Deleted resource ID').toBe(apiConfig.cartId);
  });

  /**
   * Check the full cart response structure against the shared JSON schema.
   * Flow: Read the configured ID -> require 200 -> let AJV report missing fields or incorrect types.
   */
  test('GET - Cart response schema @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_CART_BY_ID.replace('{id}', String(apiConfig.cartId)));
    expect(response.status(), 'Schema read status').toBe(200);
    const body = await response.json();
    expectSchema('cart', body);
  });

  // ---------------- Sequential workflow within one isolated test ----------------
  /**
   * Exercise create -> update -> delete for one generated cart inside a single test.
   * Flow: Keep the returned ID local to this test and reuse it for both subsequent requests.
   */
  test('Cart CRUD workflow @master @regression @api @end-to-end', async ({ request }) => {
    const createPayload = { userId: apiConfig.userId, date: apiConfig.startDate, products: [{ productId: apiConfig.productId, quantity: apiData.cart.quantity }] };
    // Step 1: create a resource and retain its response for this workflow only.
    const created = await test.step('Create and capture generated ID', async () => {
      const response = await request.post(Routes.CREATE_CART, { data: createPayload });
      expect(response.status(), 'Workflow create status').toBe(201);
      const body = await response.json();
      expectGeneratedId(body.id);
      const payload = createPayload;
      expect(body.userId, 'Cart owner').toBe(payload.userId);
      expect(body.products, 'Submitted products and quantities').toEqual(payload.products);
      expect(Date.parse(body.date), 'Submitted cart date').toBe(Date.parse(payload.date));
      return body;
    });
    // Step 2: target the generated ID, rather than an unrelated configured resource.
    await test.step('Update the generated resource', async () => {
      const payload = {
        // Reuse the owner, date, and product IDs returned by create; change only quantities.
        userId: created.userId,
        date: created.date,
        products: created.products.map((product: { productId: number; quantity: number }) => ({
          ...product, quantity: apiData.cart.updatedQuantity,
        })),
      };
      expect(payload.products[0].quantity, 'Workflow must change the quantity').not.toBe(created.products[0].quantity);
      const response = await request.put(Routes.UPDATE_CART.replace('{id}', String(created.id)), { data: payload });
      expect(response.status(), 'Workflow update status').toBe(200);
      const body = await response.json();
      expect(body.userId, 'Cart owner').toBe(payload.userId);
      expect(body.products, 'Submitted products and quantities').toEqual(payload.products);
      expect(Date.parse(body.date), 'Submitted cart date').toBe(Date.parse(payload.date));
      expect(body.id, 'Workflow uses the created ID').toBe(created.id);
    });
    // Step 3: delete using that same ID; FakeStore simulates these writes without persistence.
    await test.step('Delete the same generated resource', async () => {
      const response = await request.delete(Routes.DELETE_CART.replace('{id}', String(created.id)));
      expect(response.status(), 'Workflow delete status').toBe(200);
      // FakeStore simulates writes; generated resources are not persisted.
      const deleted = await response.json();
      if (deleted !== null) expect(deleted.id, 'Deleted ID').toBe(created.id);
    });
  });

  // ---------------- Query boundaries and missing resources ----------------
  for (const boundary of apiData.additionalCoverage.limitCases) {
    /**
     * Exercise one-record, zero/unlimited, and oversized limits as separate cart cases.
     * Flow: Fetch full and limited lists independently -> compare expected IDs/counts -> validate item schemas.
     */
    test(`GET - Carts limit: ${boundary.name} @master @regression @api @datadriven`, async ({ request }) => {
      // Neither request depends on the other; the unfiltered list is the comparison baseline.
      const [allResponse, response] = await Promise.all([
        request.get(Routes.GET_ALL_CARTS),
        request.get(Routes.GET_CARTS_WITH_LIMIT.replace('{limit}', String(boundary.limit))),
      ]);
      expect(allResponse.status(), 'Unfiltered list status').toBe(200);
      expect(response.status(), 'Boundary limit status').toBe(200);
      expect(response.headers()['content-type'], 'List content type').toContain('application/json');
      const all = await allResponse.json();
      const body = await response.json();
      expect(Array.isArray(all), 'Unfiltered list must be an array').toBe(true);
      expect(all.length, 'Comparison list must contain records').toBeGreaterThan(0);
      expect(Array.isArray(body), 'Limited list must be an array').toBe(true);
      if (boundary.returnsAll && boundary.limit > 0) {
        expect(boundary.limit, 'Oversized limit must exceed the current catalogue size').toBeGreaterThan(all.length);
      }
      // FakeStore treats zero as unlimited; oversized limits also return the full collection.
      const expected = boundary.returnsAll ? all : all.slice(0, boundary.limit);
      const expectedIds = expected.map((item: { id: number }) => item.id);
      const actualIds = body.map((item: { id: number }) => item.id);
      expect(body, 'Boundary result count').toHaveLength(expected.length);
      expect(actualIds, 'Boundary must return the expected records').toEqual(expectedIds);
      for (const item of body) expectSchema('cart', item);
    });
  }

  for (const order of apiData.sortOrders) {
    /**
     * Check that a cart request honors a small limit and the requested sort direction together.
     * Flow: Send both query parameters -> validate count/schemas -> require ordered, distinct IDs.
     */
    test(`GET - Carts sort ${order} combined with limit @master @regression @api @datadriven`, async ({ request }) => {
      const response = await request.get(Routes.GET_CARTS_SORTED.replace('{order}', order), {
        params: { limit: apiData.additionalCoverage.combinedLimit },
      });
      expect(response.status(), 'Combined sort and limit status').toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), 'Sorted limited list must be an array').toBe(true);
      expect(body, 'Combined query result count').toHaveLength(apiData.additionalCoverage.combinedLimit);
      for (const item of body) expectSchema('cart', item);
      const ids: number[] = body.map((item: { id: number }) => item.id);
      const expected = [...ids].sort((a, b) => order === 'asc' ? a - b : b - a);
      expect(ids, `Limited IDs must be ordered ${order}`).toEqual(expected);
      expect(new Set(ids).size, 'Limited records must have distinct IDs').toBe(ids.length);
    });
  }

  /**
   * Check FakeStore's actual response for an unused cart ID.
   * Flow: Request the missing-ID fixture -> require 200 and JSON null.
   */
  test('GET - Missing cart @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_CART_BY_ID.replace('{id}', String(apiData.additionalCoverage.missingResourceId)));
    expect(response.status(), 'FakeStore missing-resource status').toBe(200);
    expect(await response.json(), 'Missing cart returns JSON null').toBeNull();
  });

  // ---------------- Additional cart filters and product lists ----------------
  /**
   * Check that an unused user ID produces no carts.
   * Flow: Request carts for the missing-ID fixture -> require 200 and exactly an empty array.
   */
  test('GET - Carts for missing user @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_USER_CART.replace('{userId}', String(apiData.additionalCoverage.missingResourceId)));
    expect(response.status(), 'Missing cart owner status').toBe(200);
    expect(await response.json(), 'Missing user must have no carts').toEqual([]);
  });

  for (const range of apiData.additionalCoverage.dateRanges) {
    /**
     * Exercise a populated single-day interval and an empty interval as separate cases.
     * Flow: Fetch the fixture range -> compare exact cart IDs -> check schemas and inclusive boundaries.
     */
    test(`GET - Cart date boundary: ${range.name} @master @regression @api @datadriven`, async ({ request }) => {
      const response = await request.get(Routes.GET_CARTS_BY_DATE_RANGE
        .replace('{startdate}', range.startDate)
        .replace('{enddate}', range.endDate));
      expect(response.status(), 'Date boundary status').toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), 'Date boundary response must be an array').toBe(true);
      // Exact fixture IDs ensure the populated boundary case cannot pass on an empty response.
      const ids: number[] = body.map((cart: { id: number }) => cart.id);
      expect(ids, 'Date interval must return exactly the fixture records').toEqual(range.expectedIds);
      expect(body, 'Date boundary result count').toHaveLength(range.expectedIds.length);
      for (const cart of body) {
        expectSchema('cart', cart);
        const date = Date.parse(cart.date);
        expect(Number.isFinite(date), 'Cart date must be parseable').toBe(true);
        expect(date, 'Inclusive start boundary').toBeGreaterThanOrEqual(Date.parse(range.startDate));
        expect(date, 'Inclusive end boundary').toBeLessThanOrEqual(Date.parse(range.endDate));
      }
    });
  }

  /**
   * Check that creating a cart preserves two different products and their quantities.
   * Flow: Build the two-product fixture -> POST -> require 201, a generated ID, owner, date, and both items.
   */
  test('POST - Cart with multiple products @master @regression @api', async ({ request }) => {
    const payload = {
      userId: apiConfig.userId,
      date: apiConfig.startDate,
      products: apiData.additionalCoverage.cartProducts,
    };
    const response = await request.post(Routes.CREATE_CART, { data: payload });
    expect(response.status(), 'Multi-product create status').toBe(201);
    const body = await response.json();
    expectGeneratedId(body.id);
    expect(body.userId, 'Cart owner').toBe(payload.userId);
    expect(body.products, 'Both products and quantities must be preserved').toEqual(payload.products);
    expect(Date.parse(body.date), 'Submitted date must be preserved').toBe(Date.parse(payload.date));
  });

  /**
   * Check that updating a cart preserves both products while changing both quantities.
   * Flow: Increase fixture quantities -> PUT to CART_ID -> verify 200, the ID, owner, date, and exact items.
   */
  test('PUT - Cart with multiple updated quantities @master @regression @api', async ({ request }) => {
    const payload = {
      userId: apiConfig.userId,
      date: apiConfig.startDate,
      products: apiData.additionalCoverage.cartProducts.map(product => ({
        ...product, quantity: product.quantity + apiData.cart.quantity,
      })),
    };
    const response = await request.put(Routes.UPDATE_CART.replace('{id}', String(apiConfig.cartId)), { data: payload });
    expect(response.status(), 'Multi-product update status').toBe(200);
    const body = await response.json();
    expectGeneratedId(body.id);
    expect(body.id, 'Updated cart ID').toBe(apiConfig.cartId);
    expect(body.userId, 'Updated cart owner').toBe(payload.userId);
    expect(body.products, 'Both updated quantities must be reflected').toEqual(payload.products);
    expect(Date.parse(body.date), 'Updated date must be preserved').toBe(Date.parse(payload.date));
  });

});
