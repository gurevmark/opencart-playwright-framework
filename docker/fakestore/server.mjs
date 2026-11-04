import { MongoClient } from 'mongodb';
import { createApp } from './app.mjs';
import { seedDatabase } from './seed.mjs';

function required(name) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} must be configured.`);
  return value;
}

let client;
try {
  const username = required('API_USERNAME');
  const password = required('API_PASSWORD');
  const signingKey = required('JWT_SECRET');
  if (Buffer.byteLength(signingKey) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes.');
  const port = Number(process.env.PORT || 6400);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be valid.');
  client = new MongoClient(required('MONGODB_URI'), {
    auth: { username: required('MONGODB_USER'), password: required('MONGODB_PASSWORD') },
    authSource: 'fakestore', serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  const database = client.db('fakestore');
  await seedDatabase(database, { username, password });
  const server = createApp(database, signingKey).listen(port, '0.0.0.0', () => {
    console.log('Controlled FakeStore fixture service ready.');
  });
  async function shutdown() {
    server.close();
    await client.close();
    process.exit(0);
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  // Validation messages contain names only; driver errors may contain addresses.
  console.error(error.message?.includes('must ') ? error.message : 'Controlled FakeStore startup failed.');
  await client?.close();
  process.exitCode = 1;
}
