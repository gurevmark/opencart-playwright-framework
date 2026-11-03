import { type RowDataPacket } from 'mysql2/promise';
import { executeQuery } from './dbClient';

export interface CustomerRecord extends RowDataPacket {
  customer_id: number;
  firstname: string;
  lastname: string;
  email: string;
  telephone: string;
  status: number;
  date_added: Date;
}

/** Retrieves all exact email matches so specs can detect missing or duplicate rows. */
export async function getCustomersByEmail(email: string): Promise<CustomerRecord[]> {
  return await executeQuery(
    'SELECT customer_id, firstname, lastname, email, telephone, status, date_added FROM oc_customer WHERE email = ?',
    [email],
  ) as CustomerRecord[];
}

/**
 * Removes only a generated customer's rows, even after email changes or Admin deletion.
 * The captured ID lets teardown remove child rows after the parent has disappeared.
 */
export async function cleanupCustomer(email: string, customerId?: number): Promise<void> {
  const rows = customerId === undefined
    ? await getCustomersByEmail(email)
    : await executeQuery('SELECT customer_id, email FROM oc_customer WHERE customer_id = ?', [customerId]) as CustomerRecord[];
  const ids = new Set(rows.map(row => row.customer_id));
  if (customerId !== undefined) ids.add(customerId);
  const emails = new Set([email, ...rows.map(row => row.email)].filter(Boolean));

  // These tables are verified against the installed OpenCart customer lifecycle.
  for (const id of ids) {
    for (const table of [
      'oc_customer_activity', 'oc_customer_ip', 'oc_customer_online', 'oc_customer_approval',
      'oc_customer_history', 'oc_customer_reward', 'oc_customer_transaction', 'oc_customer_affiliate', 'oc_address',
    ]) {
      await executeQuery(`DELETE FROM ${table} WHERE customer_id = ?`, [id]);
    }
    await executeQuery('DELETE FROM oc_customer WHERE customer_id = ?', [id]);
  }
  for (const ownedEmail of emails) {
    await executeQuery('DELETE FROM oc_customer_login WHERE email = ?', [ownedEmail]);
  }
}
