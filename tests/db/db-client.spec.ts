/**
 * Test case: A rejected SQL statement must not leak a MySQL connection or break later queries.
 *
 * Flow: cause a controlled SQL error containing its connection ID -> verify that exact ID
 * disappears from the process list -> run a successful parameterized query afterward.
 * This is a DB-only test: it uses no browser and creates no customer or other business data.
 */
import dotenv from 'dotenv';
import { test, expect } from '@playwright/test';
import { type RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '../../utils/dbClient';

dotenv.config({ quiet: true });

test('Rejected SQL releases its exact connection and later queries succeed @master @regression @db', async () => {
  let failedConnectionId: number | undefined;
  await test.step('1) Execute a rejected statement that identifies its MySQL connection', async () => {
    // GTID_SUBSET only checks its input here; malformed input causes an error without changing data.
    // MySQL includes the malformed GTID value in its error. It embeds the real session ID,
    // so the check needs neither process-count assumptions nor elevated diagnostic privileges.
    const error = await executeQuery("SELECT GTID_SUBSET(CONCAT('pw-db-connection-', CONNECTION_ID()), '')")
      .then(() => undefined, (reason: unknown) => reason);
    // Capture the expected rejection as a value so we can inspect its code and connection marker.
    expect(error, 'The deliberately malformed statement must reject').toBeInstanceOf(Error);
    const sqlError = error as Error & { code?: string };
    expect(sqlError.code).toBe('ER_MALFORMED_GTID_SET_SPECIFICATION');
    const marker = sqlError.message.match(/pw-db-connection-(\d+)/);
    expect(marker, 'The MySQL error must identify the connection under test').not.toBeNull();
    failedConnectionId = Number(marker![1]);
  });
  await test.step('2) Verify the rejected query left no open connection', async () => {
    // Counting this specific ID avoids interference from other tests opening their own connections.
    await expect.poll(async () => {
      const rows = await executeQuery('SELECT ID FROM information_schema.PROCESSLIST WHERE ID = ?', [failedConnectionId]) as RowDataPacket[];
      return rows.length;
    }, { message: 'The exact failed connection must be closed' }).toBe(0);
  });
  await test.step('3) Verify a subsequent parameterized query still works', async () => {
    // A fresh successful query proves the shared helper remains usable after handling the error.
    const rows = await executeQuery('SELECT ? AS value', [42]) as RowDataPacket[];
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(42);
  });
  console.log('✅ Rejected SQL released its connection; subsequent queries succeeded.');
});
