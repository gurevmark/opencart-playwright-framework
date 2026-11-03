/**
 * User cases cover demo-user reads, query options, schemas, and simulated CRUD responses.
 * Each test uses its own request fixture and can run independently.
 * The CRUD workflow keeps its dependent create, update, and delete steps inside one test.
 * Configuration comes from .env; reusable payloads and boundary values come from test data.
 */
import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { Routes } from '../../api/endpoints/routes';
import { apiConfig, apiData, expectSchema, expectGeneratedId, requiredEnv } from '../../utils/fakestoreTestSupport';

dotenv.config({ quiet: true });
test.use({ baseURL: apiConfig.baseURL });

test.describe('FakeStore Users API Tests', () => {
  // ---------------- GET ----------------
  /**
   * Check that the user collection contains records in the expected format.
   * Flow: Fetch all users -> require 200 and a non-empty array -> validate every item schema.
   */
  test('GET - All users @master @sanity @api', async ({ request }) => {
    const response = await request.get(Routes.GET_ALL_USERS);
    expect(response.status(), 'List status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Response must be an array').toBe(true);
    expect(body.length, 'List must not be empty').toBeGreaterThan(0);
    // The shared helper uses AJV to check required fields and their types.
    for (const item of body) expectSchema('user', item);
  });

  /**
   * Check that a read returns the specific user selected in .env.
   * Flow: Replace the route ID -> require 200 -> compare the returned ID and validate the user schema.
   */
  test('GET - User by ID @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_USER_BY_ID.replace('{id}', String(apiConfig.userId)));
    expect(response.status(), 'Read status').toBe(200);
    const body = await response.json();
    expect(body.id, 'Returned ID must match requested ID').toBe(apiConfig.userId);
    expectSchema('user', body);
  });

  /**
   * Check the normal result limit supplied in .env for users.
   * Flow: Send the configured limit -> require 200 and the exact count -> validate every item schema.
   */
  test('GET - Users with limit @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_USERS_WITH_LIMIT.replace('{limit}', String(apiConfig.limit)));
    expect(response.status(), 'Limit status').toBe(200);
    const body = await response.json();
    expect(Array.isArray(body), 'Response must be an array').toBe(true);
    expect(body, 'Requested result count').toHaveLength(apiConfig.limit);
    for (const item of body) expectSchema('user', item);
  });

  for (const order of apiData.sortOrders) {
    /**
     * Create separate ascending and descending cases for the full user list.
     * Flow: Fetch sorted records -> validate schemas -> compare ID order with a numerically sorted copy.
     */
    test(`GET - Users sorted ${order} @master @regression @api`, async ({ request }) => {
      const response = await request.get(Routes.GET_USERS_SORTED.replace('{order}', order));
      expect(response.status(), 'Sort status').toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), 'Response must be an array').toBe(true);
      expect(body.length, 'Sorting requires multiple records').toBeGreaterThan(1);
      for (const item of body) expectSchema('user', item);
      const ids: number[] = body.map((item: { id: number }) => item.id);
      // Sort a copy so the original response order remains available for comparison.
      const expected = [...ids].sort((a, b) => order === 'asc' ? a - b : b - a);
      expect(ids, `IDs must be sorted ${order}`).toEqual(expected);
    });

  }

  // ---------------- POST / PUT / DELETE ----------------
  /**
   * Check the create-response contract using deterministic user data.
   * Flow: Combine fixture fields with the .env password -> POST -> require 201 and a generated ID.
   */
  test('POST - Create user @master @regression @api', async ({ request }) => {
    const payload = { ...apiData.user, password: requiredEnv('PASSWORD') };
    const response = await request.post(Routes.CREATE_USER, { data: payload });
    expect(response.status(), 'Create status').toBe(201);
    const body = await response.json();
    expectGeneratedId(body.id);
    const createdId = body.id;
    expect(createdId, 'Captured generated ID').toBeGreaterThan(0);
    // FakeStore user creation returns only { id }; no user fields are promised.
    expect(Object.keys(body), 'User creation response contract').toEqual(['id']);
  });

  /**
   * Check an update to an existing configured user, independently of the create test.
   * Flow: PUT fixture changes to USER_ID -> require 200 -> compare public fields and the password separately.
   */
  test('PUT - Update user @master @regression @api', async ({ request }) => {
    const payload = { ...apiData.userUpdate, password: requiredEnv('PASSWORD') };
    const response = await request.put(Routes.UPDATE_USER.replace('{id}', String(apiConfig.userId)), { data: payload });
    expect(response.status(), 'Update status').toBe(200);
    const body = await response.json();
    // Compare the password as a boolean so a failed equality assertion does not print it.
    const { password: returnedPassword, ...publicBody } = body;
    const { password: submittedPassword, ...publicPayload } = payload;
    expect(publicBody, 'Updated user information').toMatchObject(publicPayload);
    expect(returnedPassword === submittedPassword, 'Updated password matches submitted password').toBe(true);
  });

  /**
   * Check the delete response for an existing configured user, independently of other tests.
   * Flow: DELETE by ID -> require 200 -> validate the returned user schema and ID.
   */
  test('DELETE - User @master @regression @api', async ({ request }) => {
    const response = await request.delete(Routes.DELETE_USER.replace('{id}', String(apiConfig.userId)));
    expect(response.status(), 'Delete status').toBe(200);
    const body = await response.json();
    expectSchema('user', body);
    expect(body.id, 'Deleted resource ID').toBe(apiConfig.userId);
  });

  /**
   * Check the full user response structure against the shared JSON schema.
   * Flow: Read the configured ID -> require 200 -> let AJV report missing fields or incorrect types.
   */
  test('GET - User response schema @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_USER_BY_ID.replace('{id}', String(apiConfig.userId)));
    expect(response.status(), 'Schema read status').toBe(200);
    const body = await response.json();
    expectSchema('user', body);
  });

  // ---------------- Sequential workflow within one isolated test ----------------
  /**
   * Exercise create -> update -> delete for one generated user inside a single test.
   * Flow: Keep the returned ID local to this test and reuse it for both subsequent requests.
   */
  test('User CRUD workflow @master @regression @api @end-to-end', async ({ request }) => {
    const createPayload = { ...apiData.user, password: requiredEnv('PASSWORD') };
    // Step 1: create a resource and retain its response for this workflow only.
    const created = await test.step('Create and capture generated ID', async () => {
      const response = await request.post(Routes.CREATE_USER, { data: createPayload });
      expect(response.status(), 'Workflow create status').toBe(201);
      const body = await response.json();
      expectGeneratedId(body.id);
      // FakeStore user creation returns only { id }; no user fields are promised.
      expect(Object.keys(body), 'User creation response contract').toEqual(['id']);
      return body;
    });
    // Step 2: target the generated ID, rather than an unrelated configured resource.
    await test.step('Update the generated resource', async () => {
      const payload = { ...apiData.userUpdate, password: requiredEnv('PASSWORD') };
      const response = await request.put(Routes.UPDATE_USER.replace('{id}', String(created.id)), { data: payload });
      expect(response.status(), 'Workflow update status').toBe(200);
      const body = await response.json();
      // Keep credential values out of assertion diffs while still checking the update.
      const { password: returnedPassword, ...publicBody } = body;
      const { password: submittedPassword, ...publicPayload } = payload;
      expect(publicBody, 'Updated user information').toMatchObject(publicPayload);
      expect(returnedPassword === submittedPassword, 'Updated password matches submitted password').toBe(true);
    });
    // Step 3: delete using that same ID; FakeStore simulates these writes without persistence.
    await test.step('Delete the same generated resource', async () => {
      const response = await request.delete(Routes.DELETE_USER.replace('{id}', String(created.id)));
      expect(response.status(), 'Workflow delete status').toBe(200);
      // FakeStore simulates writes; generated resources are not persisted.
      const deleted = await response.json();
      if (deleted !== null) expect(deleted.id, 'Deleted ID').toBe(created.id);
    });
  });

  // ---------------- Query boundaries and missing resources ----------------
  for (const boundary of apiData.additionalCoverage.limitCases) {
    /**
     * Exercise one-record, zero/unlimited, and oversized limits as separate user cases.
     * Flow: Fetch full and limited lists independently -> compare expected IDs/counts -> validate item schemas.
     */
    test(`GET - Users limit: ${boundary.name} @master @regression @api @datadriven`, async ({ request }) => {
      // Neither request depends on the other; the unfiltered list is the comparison baseline.
      const [allResponse, response] = await Promise.all([
        request.get(Routes.GET_ALL_USERS),
        request.get(Routes.GET_USERS_WITH_LIMIT.replace('{limit}', String(boundary.limit))),
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
      for (const item of body) expectSchema('user', item);
    });
  }

  for (const order of apiData.sortOrders) {
    /**
     * Check that a user request honors a small limit and the requested sort direction together.
     * Flow: Send both query parameters -> validate count/schemas -> require ordered, distinct IDs.
     */
    test(`GET - Users sort ${order} combined with limit @master @regression @api @datadriven`, async ({ request }) => {
      const response = await request.get(Routes.GET_USERS_SORTED.replace('{order}', order), {
        params: { limit: apiData.additionalCoverage.combinedLimit },
      });
      expect(response.status(), 'Combined sort and limit status').toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), 'Sorted limited list must be an array').toBe(true);
      expect(body, 'Combined query result count').toHaveLength(apiData.additionalCoverage.combinedLimit);
      for (const item of body) expectSchema('user', item);
      const ids: number[] = body.map((item: { id: number }) => item.id);
      const expected = [...ids].sort((a, b) => order === 'asc' ? a - b : b - a);
      expect(ids, `Limited IDs must be ordered ${order}`).toEqual(expected);
      expect(new Set(ids).size, 'Limited records must have distinct IDs').toBe(ids.length);
    });
  }

  /**
   * Check FakeStore's actual response for an unused user ID.
   * Flow: Request the missing-ID fixture -> require 200 and JSON null.
   */
  test('GET - Missing user @master @regression @api', async ({ request }) => {
    const response = await request.get(Routes.GET_USER_BY_ID.replace('{id}', String(apiData.additionalCoverage.missingResourceId)));
    expect(response.status(), 'FakeStore missing-resource status').toBe(200);
    expect(await response.json(), 'Missing user returns JSON null').toBeNull();
  });

});
