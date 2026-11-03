import { expect } from '@playwright/test';
import Ajv from 'ajv';
import dotenv from 'dotenv';
import path from 'node:path';
import { Routes } from '../api/endpoints/routes';
import { DataProvider } from './DataReader';

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

/** Reads existing environment configuration without logging credentials. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured in .env`);
  return value;
}

export const apiConfig = {
  baseURL: process.env.API_BASE_URL || Routes.BASE_URL,
  productId: Number(requiredEnv('PRODUCT_ID')),
  userId: Number(requiredEnv('USER_ID')),
  cartId: Number(requiredEnv('CART_ID')),
  limit: Number(requiredEnv('LIMIT')),
  startDate: requiredEnv('START_DATE'),
  endDate: requiredEnv('END_DATE'),
};
export const apiData: typeof import('../testdata/fakestore_api_data.json') =
  DataProvider.readJson(path.resolve(__dirname, '../testdata/fakestore_api_data.json'));

const ajv = new Ajv({ allErrors: true });
const schemas = {
  product: ajv.compile(DataProvider.readJson(path.resolve(__dirname, '../api/schemas/product_api_schema.json'))),
  user: ajv.compile(DataProvider.readJson(path.resolve(__dirname, '../api/schemas/user_api_schema.json'))),
  cart: ajv.compile(DataProvider.readJson(path.resolve(__dirname, '../api/schemas/cart_api_schema.json'))),
};

/** Reports schema paths and validation errors without dumping response bodies. */
export function expectSchema(kind: keyof typeof schemas, body: unknown): void {
  const validate = schemas[kind];
  const valid = validate(body);
  expect(valid, `${kind} schema: ${ajv.errorsText(validate.errors, { separator: '; ' })}`).toBe(true);
}

/** Checks IDs returned by simulated create operations. */
export function expectGeneratedId(id: unknown): asserts id is number {
  expect(typeof id, 'Generated ID must be numeric').toBe('number');
  expect(Number.isInteger(id), 'Generated ID must be an integer').toBe(true);
  expect(id, 'Generated ID must be positive').toBeGreaterThan(0);
}
