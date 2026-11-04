import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import { seedDatabase } from './seed.mjs';

const baseURL = `http://127.0.0.1:${process.env.PORT || 6400}`;
let client;
let database;

before(async () => {
  const health = await fetch(`${baseURL}/health`).then(response => response.json());
  assert.equal(health.service, 'controlled-fakestore');
  client = new MongoClient(process.env.MONGODB_URI, {
    auth: { username: process.env.MONGODB_USER, password: process.env.MONGODB_PASSWORD },
    authSource: 'fakestore', serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  database = client.db('fakestore');
});

after(async () => { await client?.close(); });

async function request(path, method = 'GET', body) {
  return fetch(`${baseURL}${path}`, {
    method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('login issues a signed, expiring JWT for the configured fixture user', async () => {
  const response = await request('/auth/login', 'POST', {
    username: process.env.API_USERNAME, password: process.env.API_PASSWORD,
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  const claims = jwt.verify(body.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  assert.equal(claims.user === process.env.API_USERNAME, true);
  assert.equal(claims.exp - claims.iat, 900);
});

test('simulated CRUD leaves MongoDB fixtures unchanged and created users cannot log in', async () => {
  for (const collection of ['products', 'users', 'carts']) {
    const before = await database.collection(collection).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
    const payload = collection === 'products'
      ? { title: 'Write probe', price: 12, description: 'Synthetic', image: 'https://example.test/probe.png', category: 'electronics' }
      : collection === 'users'
        ? { email: 'write-probe@example.test', username: 'write-probe', password: 'deliberately-unpersisted', name: { firstname: 'Probe', lastname: 'User' }, address: {}, phone: '000' }
        : { userId: 1, date: '2020-01-01', products: [{ productId: 1, quantity: 1 }] };
    const created = await request(`/${collection}`, 'POST', payload);
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    const updated = await request(`/${collection}/1`, 'PUT', payload);
    assert.equal(updated.status, 200);
    const deleted = await request(`/${collection}/1`, 'DELETE');
    assert.equal(deleted.status, 200);
    const missing = await request(`/${collection}/${createdBody.id}`);
    assert.equal(collection === 'products' ? (await missing.text()) === '' : (await missing.json()) === null, true);
    const after = await database.collection(collection).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
    // Compare as a boolean so user/password fields never enter assertion diffs.
    assert.equal(JSON.stringify(before) === JSON.stringify(after), true, 'Simulated writes must preserve stored fixtures');
  }
  const login = await request('/auth/login', 'POST', { username: 'write-probe', password: 'deliberately-unpersisted' });
  assert.equal(login.status, 401);
});

test('the API database account cannot read the admin database', async () => {
  await assert.rejects(client.db('admin').collection('system.version').findOne(), error => error.code === 13);
});

test('fixture initialization is repeatable and rejects credential changes without rewriting data', async () => {
  const credentials = { username: process.env.API_USERNAME, password: process.env.API_PASSWORD };
  await seedDatabase(database, credentials);
  await assert.rejects(seedDatabase(database, { ...credentials, password: 'different-unusable-fixture-password' }));
  const user = await database.collection('users').findOne({ id: 1 });
  assert.equal(user.password === credentials.password, true);
});
