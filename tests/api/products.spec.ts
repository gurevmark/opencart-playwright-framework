/**
 * Product cases cover catalogue reads, query filters, schemas, and simulated CRUD responses.
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

test.describe('FakeStore Products API Tests', () => {
  // ---------------- GET ----------------
  /**
   * Check that the product collection contains records in the expected format.
   * Flow: Fetch all products -> require 200 and a non-empty array -> validate every item schema.
   */
  test('GET - All products @master @sanity @api', async ({ request }) => {
    const response = await request.get(Routes.GET_ALL_PRODUCTS);
    expect(response.status(), 'List status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Response must be an array').toBe(true);
    expect(body.length, 'List must not be empty').toBeGreaterThan(0);
    // The shared helper uses AJV to check required fields and their types.
    for (const item of body) expectSchema('product', item);
  });

  /**
   * Check that a read returns the specific product selected in .env.
   * Flow: Replace the route ID -> require 200 -> compare the returned ID and validate the product schema.
   */
  test('GET - Product by ID @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_PRODUCT_BY_ID.replace('{id}', String(apiConfig.productId)));
    expect(response.status(), 'Read status').toBe(200);
    const body = await response.json();
    expect(body.id, 'Returned ID must match requested ID').toBe(apiConfig.productId);
    expectSchema('product', body);
  });

  /**
   * Check the normal result limit supplied in .env for products.
   * Flow: Send the configured limit -> require 200 and the exact count -> validate every item schema.
   */
  test('GET - Products with limit @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_PRODUCTS_WITH_LIMIT.replace('{limit}', String(apiConfig.limit)));
    expect(response.status(), 'Limit status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Response must be an array').toBe(true);
    expect(body, 'Requested result count').toHaveLength(apiConfig.limit);
    for (const item of body) expectSchema('product', item);
  });

  for (const order of apiData.sortOrders) {
    /**
     * Create separate ascending and descending cases for the full product list.
     * Flow: Fetch sorted records -> validate schemas -> compare ID order with a numerically sorted copy.
     */
    test(`GET - Products sorted ${order} @master @regression @api`, async ({ request }) => {
      const response = await request.get(Routes.GET_PRODUCTS_SORTED.replace('{order}', order));
      expect(response.status(), 'Sort status').toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), 'Response must be an array').toBe(true);
      expect(body.length, 'Sorting requires multiple records').toBeGreaterThan(1);
      for (const item of body) expectSchema('product', item);
      const ids: number[] = body.map((item: { id: number }) => item.id);
      // Sort a copy so the original response order remains available for comparison.
      const expected = [...ids].sort((a, b) => order === 'asc' ? a - b : b - a);
      expect(ids, `IDs must be sorted ${order}`).toEqual(expected);
    });

  }

  /**
   * Check that the catalogue exposes usable category names.
   * Flow: Fetch categories -> require 200 and a non-empty array -> reject blank/non-string names.
   */
  test('GET - All categories @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_ALL_CATEGORIES);
    expect(response.status(), 'Category list status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Categories must be an array').toBe(true);
    expect(body.length, 'Categories must not be empty').toBeGreaterThan(0);
    for (const category of body) {
      expect(typeof category, 'Category type').toBe('string');
      expect(category.trim().length, 'Category must not be blank').toBeGreaterThan(0);
    }
  });

  /**
   * Check that category filtering excludes products from other categories.
   * Flow: Encode the fixture category -> fetch products -> validate schemas and category membership.
   */
  test('GET - Products by category @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_PRODUCTS_BY_CATEGORY.replace('{category}', encodeURIComponent(apiData.category)));
    expect(response.status(), 'Category filter status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Products must be an array').toBe(true);
    expect(body.length, 'Known category must contain products').toBeGreaterThan(0);
    for (const product of body) {
      expectSchema('product', product);
      expect(product.category, 'Product category').toBe(apiData.category);
    }
  });

  // ---------------- POST / PUT / DELETE ----------------
  /**
   * Check the create-response contract using deterministic product data.
   * Flow: Send the product fixture -> require 201 and a generated ID -> compare submitted fields.
   */
  test('POST - Create product @master @regression @api', async ({ request }) => {
    const payload = apiData.product;
    const response = await request.post(Routes.CREATE_PRODUCT, { data: payload });
    expect(response.status(), 'Create status').toBe(201);
    const body = await response.json();
    expectGeneratedId(body.id);
    const createdId = body.id;
    expect(createdId, 'Captured generated ID').toBeGreaterThan(0);
    expect(body, 'Submitted product information').toMatchObject(payload);
  });

  /**
   * Check an update to an existing configured product, independently of the create test.
   * Flow: PUT fixture changes to the configured ID -> require 200 -> compare the ID and updated fields.
   */
  test('PUT - Update product @master @regression @api', async ({ request }) => {
    const payload = apiData.productUpdate;
    const response = await request.put(Routes.UPDATE_PRODUCT.replace('{id}', String(apiConfig.productId)), { data: payload });
    expect(response.status(), 'Update status').toBe(200);
    const body = await response.json();
    expect(body, 'Submitted product information').toMatchObject(payload);
    expect(body.id, 'Updated resource ID').toBe(apiConfig.productId);
  });

  /**
   * Check the delete response for an existing configured product, independently of other tests.
   * Flow: DELETE by ID -> require 200 -> validate the returned product schema and ID.
   */
  test('DELETE - Product @master @regression @api', async ({ request }) => {
    const response = await request.delete(Routes.DELETE_PRODUCT.replace('{id}', String(apiConfig.productId)));
    expect(response.status(), 'Delete status').toBe(200);
    const body = await response.json();
    expectSchema('product', body);
    expect(body.id, 'Deleted resource ID').toBe(apiConfig.productId);
  });

  /**
   * Check the full product response structure against the shared JSON schema.
   * Flow: Read the configured ID -> require 200 -> let AJV report missing fields or incorrect types.
   */
  test('GET - Product response schema @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_PRODUCT_BY_ID.replace('{id}', String(apiConfig.productId)));
    expect(response.status(), 'Schema read status').toBe(200);
    const body = await response.json();
    expectSchema('product', body);
  });

  // ---------------- Sequential workflow within one isolated test ----------------
  /**
   * Exercise create -> update -> delete for one generated product inside a single test.
   * Flow: Keep the returned ID local to this test and reuse it for both subsequent requests.
   */
  test('Product CRUD workflow @master @regression @api @end-to-end', async ({ request }) => {
    const createPayload = apiData.product;
    // Step 1: create a resource and retain its response for this workflow only.
    const created = await test.step('Create and capture generated ID', async () => {
      const response = await request.post(Routes.CREATE_PRODUCT, { data: createPayload });
      expect(response.status(), 'Workflow create status').toBe(201);
      const body = await response.json();
      expectGeneratedId(body.id);
      const payload = createPayload;
      expect(body, 'Submitted product information').toMatchObject(payload);
      return body;
    });
    // Step 2: target the generated ID, rather than an unrelated configured resource.
    await test.step('Update the generated resource', async () => {
      const payload = apiData.productUpdate;
      const response = await request.put(Routes.UPDATE_PRODUCT.replace('{id}', String(created.id)), { data: payload });
      expect(response.status(), 'Workflow update status').toBe(200);
      const body = await response.json();
      expect(body, 'Submitted product information').toMatchObject(payload);
      expect(body.id, 'Workflow uses the created ID').toBe(created.id);
    });
    // Step 3: delete using that same ID; FakeStore simulates these writes without persistence.
    await test.step('Delete the same generated resource', async () => {
      const response = await request.delete(Routes.DELETE_PRODUCT.replace('{id}', String(created.id)));
      expect(response.status(), 'Workflow delete status').toBe(200);
      // FakeStore simulates writes; generated resources are not persisted.
      const text = await response.text();
      // An empty simulated-delete body is valid; parse JSON only when a body is present.
      if (text.trim()) {
        const deleted = JSON.parse(text);
        if (deleted !== null) expect(deleted.id, 'Deleted ID').toBe(created.id);
      }
    });
  });

  // ---------------- Query boundaries and missing resources ----------------
  for (const boundary of apiData.additionalCoverage.limitCases) {
    /**
     * Exercise one-record, zero/unlimited, and oversized limits as separate product cases.
     * Flow: Fetch full and limited lists independently -> compare expected IDs/counts -> validate item schemas.
     */
    test(`GET - Products limit: ${boundary.name} @master @regression @api @datadriven`, async ({ request }) => {
      // Neither request depends on the other; the unfiltered list is the comparison baseline.
      const [allResponse, response] = await Promise.all([
        request.get(Routes.GET_ALL_PRODUCTS),
        request.get(Routes.GET_PRODUCTS_WITH_LIMIT.replace('{limit}', String(boundary.limit))),
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
      for (const item of body) expectSchema('product', item);
    });
  }

  for (const order of apiData.sortOrders) {
    /**
     * Check that a product request honors a small limit and the requested sort direction together.
     * Flow: Send both query parameters -> validate count/schemas -> require ordered, distinct IDs.
     */
    test(`GET - Products sort ${order} combined with limit @master @regression @api @datadriven`, async ({ request }) => {
      const response = await request.get(Routes.GET_PRODUCTS_SORTED.replace('{order}', order), {
        params: { limit: apiData.additionalCoverage.combinedLimit },
      });
      expect(response.status(), 'Combined sort and limit status').toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), 'Sorted limited list must be an array').toBe(true);
      expect(body, 'Combined query result count').toHaveLength(apiData.additionalCoverage.combinedLimit);
      for (const item of body) expectSchema('product', item);
      const ids: number[] = body.map((item: { id: number }) => item.id);
      const expected = [...ids].sort((a, b) => order === 'asc' ? a - b : b - a);
      // Validate ordering within the returned subset; product limiting precedes descending sorting.
      expect(ids, `Limited IDs must be ordered ${order}`).toEqual(expected);
      expect(new Set(ids).size, 'Limited records must have distinct IDs').toBe(ids.length);
    });
  }

  /**
   * Check FakeStore's actual response for an unused product ID.
   * Flow: Request the missing-ID fixture -> require 200 and an empty text body, which cannot be parsed as JSON.
   */
  test('GET - Missing product @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_PRODUCT_BY_ID.replace('{id}', String(apiData.additionalCoverage.missingResourceId)));
    expect(response.status(), 'FakeStore missing-resource status').toBe(200);
    expect(await response.text(), 'Missing product returns an empty body').toBe('');
  });

  // ---------------- Additional category filters ----------------
  for (const category of apiData.additionalCoverage.encodedCategories) {
    /**
     * Exercise each clothing category whose name contains an apostrophe and a space.
     * Flow: Encode the category in the path -> require matching products with valid schemas.
     */
    test(`GET - Category containing punctuation: ${category} @master @regression @api @datadriven`, async ({ request }) => {
      const response = await request.get(Routes.GET_PRODUCTS_BY_CATEGORY.replace('{category}', encodeURIComponent(category)));
      expect(response.status(), 'Encoded category status').toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), 'Category products must be an array').toBe(true);
      expect(body.length, 'Known clothing category must contain products').toBeGreaterThan(0);
      for (const product of body) {
        expectSchema('product', product);
        expect(product.category, 'Every product must match the requested category').toBe(category);
      }
    });
  }

  /**
   * Check the empty-result contract for a category that is absent from the demo catalogue.
   * Flow: Request the unknown-category fixture -> require 200 and exactly an empty array.
   */
  test('GET - Unknown category @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_PRODUCTS_BY_CATEGORY.replace('{category}', encodeURIComponent(apiData.additionalCoverage.unknownCategory)));
    expect(response.status(), 'Unknown category status').toBe(200);
    expect(await response.json(), 'Unknown category must return no products').toEqual([]);
  });

});
