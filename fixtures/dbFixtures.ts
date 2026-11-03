import { test as base, expect } from './pageFixtures';
import { type Customer } from '../pages/RegisterPage';
import { RandomDataUtil } from '../utils/dataGenerator';
import { executeQuery } from '../utils/dbClient';
import { cleanupCustomer, getCustomersByEmail, type CustomerRecord } from '../utils/customerDb';

type DbFixtures = {
  customerData: Customer;
  registeredCustomer: CustomerRecord;
};

export const test = base.extend<DbFixtures>({
  customerData: async ({}, use) => {
    await executeQuery('SELECT 1');
    const customer = RandomDataUtil.generateCustomerPayload();
    try {
      await use(customer);
    } finally {
      await cleanupCustomer(customer.email);
      expect(await getCustomersByEmail(customer.email), 'Teardown must remove the generated email').toHaveLength(0);
    }
  },
  registeredCustomer: async ({ customerData, homePage, registerPage }, use) => {
    await test.step('Setup) Register an independent customer through the frontend', async () => {
      await homePage.openRegistration();
      await expect.poll(() => registerPage.isRegisterPageExists()).toBe(true);
      await registerPage.completeRegistration(customerData);
      await expect.poll(() => registerPage.isAccountCreated()).toBe(true);
    });
    const rows = await getCustomersByEmail(customerData.email);
    expect(rows, 'Setup must create exactly one customer').toHaveLength(1);
    const customer = rows[0];
    try {
      await use(customer);
    } finally {
      await cleanupCustomer(customerData.email, customer.customer_id);
      const remaining = await executeQuery('SELECT customer_id FROM oc_customer WHERE customer_id = ?', [customer.customer_id]);
      expect(remaining, 'Teardown must remove the captured customer ID').toHaveLength(0);
    }
  },
});

export { expect } from './pageFixtures';
