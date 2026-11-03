/**
 * Authentication cases cover successful login, rejected credentials, and missing input.
 * Each test uses its own request fixture and can run independently.
 * Configuration comes from .env; reusable payloads and boundary values come from test data.
 */
import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { Routes } from '../../api/endpoints/routes';
import { apiConfig, apiData, requiredEnv } from '../../utils/fakestoreTestSupport';

dotenv.config({ quiet: true });
test.use({ baseURL: apiConfig.baseURL });

test.describe('FakeStore Authentication API Tests', () => {
  /**
   * Check that an existing demo account can authenticate.
   * Flow: Read credentials from .env -> send login -> require 201 and a non-empty token.
   */
  test('POST - Successful login @master @sanity @api', async ({ request }) => {
    const response = await request.post(Routes.AUTH_LOGIN, {
      data: { username: requiredEnv('USERNAME'), password: requiredEnv('PASSWORD') },
    });
    expect(
      response.status(),
      'Login must return 201. USERNAME and PASSWORD in .env must match an existing FakeStore demo user; POST /users does not persist login accounts.',
    ).toBe(201);
    // Successful login returns JSON; failed logins below return plain text.
    const body = await response.json();
    expect(Object.hasOwn(body, 'token'), 'Token must exist').toBe(true);
    expect(typeof body.token, 'Token must be a string').toBe('string');
    expect(body.token.trim().length, 'Token must not be blank').toBeGreaterThan(0);
  });

  /**
   * Reject a login where both credentials come from the invalid test-data fixture.
   * Flow: Send invalid credentials -> require 401 -> compare the plain-text error message.
   */
  test('POST - Invalid login @master @regression @api', async ({ request }) => {
    const response = await request.post(Routes.AUTH_LOGIN, { data: apiData.invalidLogin });
    expect(response.status(), 'Invalid login status').toBe(401);
    expect(await response.text(), 'Authentication error message').toBe('username or password is incorrect');
  });

  // ---------------- Additional authentication failures ----------------
  /**
   * Isolate an incorrect password while keeping the configured username valid.
   * Flow: Combine the .env username with an invalid password -> require 401 and the login error.
   */
  test('POST - Known username with wrong password @master @regression @api', async ({ request }) => {
    const response = await request.post(Routes.AUTH_LOGIN, {
      data: { username: requiredEnv('USERNAME'), password: apiData.invalidLogin.password },
    });
    expect(response.status(), 'Incorrect password must be rejected').toBe(401);
    expect(await response.text(), 'Authentication error').toBe('username or password is incorrect');
  });

  /**
   * Isolate an unknown username while keeping the configured password unchanged.
   * Flow: Combine an invalid username with the .env password -> require 401 and the login error.
   */
  test('POST - Unknown username with configured password @master @regression @api', async ({ request }) => {
    const response = await request.post(Routes.AUTH_LOGIN, {
      data: { username: apiData.invalidLogin.username, password: requiredEnv('PASSWORD') },
    });
    expect(response.status(), 'Unknown username must be rejected').toBe(401);
    expect(await response.text(), 'Authentication error').toBe('username or password is incorrect');
  });

  for (const missingField of ['username', 'password'] as const) {
    /**
     * Create one independent case for each omitted credential.
     * Flow: Send only the other field -> require 400 and the missing-credentials error.
     */
    test(`POST - Missing ${missingField} @master @regression @api @datadriven`, async ({ request }) => {
      const payload = missingField === 'username'
        ? { password: requiredEnv('PASSWORD') }
        : { username: requiredEnv('USERNAME') };
      const response = await request.post(Routes.AUTH_LOGIN, { data: payload });
      expect(response.status(), `Missing ${missingField} must be rejected`).toBe(400);
      expect(await response.text(), 'Missing credential error').toBe('username and password are not provided in JSON format');
    });
  }

  /**
   * Distinguish present-but-empty credentials from incorrect non-empty credentials.
   * Flow: Send two empty strings -> require 400 and the input-validation error.
   */
  test('POST - Empty credentials @master @regression @api', async ({ request }) => {
    const response = await request.post(Routes.AUTH_LOGIN, { data: { username: '', password: '' } });
    expect(response.status(), 'Empty credentials must be rejected').toBe(400);
    expect(await response.text(), 'Empty credential error').toBe('username and password are not provided in JSON format');
  });

});
