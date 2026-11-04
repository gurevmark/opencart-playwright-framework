// Adapted from keikaavousi/fake-store-api, upstream commit d03d27d (MIT).
// See LICENSE and README.md for provenance and deliberate compatibility changes.
import express from 'express';
import jwt from 'jsonwebtoken';
import { datasetVersion } from './seed.mjs';

const projection = { _id: 0 };

export function createApp(database, signingKey) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_request, response) => {
    await database.command({ ping: 1 });
    response.json({ status: 'ok', service: 'controlled-fakestore', dataset: datasetVersion });
  });

  app.post('/auth/login', async (request, response) => {
    const { username, password } = request.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return response.status(400).send('username and password are not provided in JSON format');
    }
    const user = await database.collection('users').findOne({ username, password });
    if (!user) return response.status(401).send('username or password is incorrect');
    response.status(201).json({ token: jwt.sign({ user: username }, signingKey, { algorithm: 'HS256', expiresIn: '15m' }) });
  });

  app.get('/products/categories', async (_request, response) => {
    response.json(await database.collection('products').distinct('category'));
  });
  app.get('/products/category/:category', async (request, response) => {
    response.json(await products({ category: request.params.category }, request.query));
  });
  app.get('/products', async (request, response) => {
    response.json(await products({}, request.query));
  });

  app.get('/users', async (request, response) => {
    response.json(await list('users', {}, request.query));
  });
  app.get('/carts/user/:userId', async (request, response) => {
    response.json(await list('carts', { ...dates(request.query), userId: Number(request.params.userId) }, request.query));
  });
  app.get('/carts', async (request, response) => {
    response.json(await list('carts', dates(request.query), request.query));
  });

  for (const collection of ['products', 'users', 'carts']) {
    const read = async (request, response) => {
      const result = await database.collection(collection).findOne({ id: Number(request.params.id) }, { projection });
      if (collection === 'products' && !result) return response.status(200).end();
      response.json(result);
    };
    app.get(`/${collection}/:id`, read);
    // FakeStore simulates DELETE responses; fixtures intentionally remain stored.
    app.delete(`/${collection}/:id`, read);

    app.post(`/${collection}`, async (request, response) => {
      const last = await database.collection(collection).find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).next();
      const id = (last?.id || 0) + 1;
      const result = collection === 'users' ? { id } : { id, ...payload(collection, request.body) };
      response.status(201).json(result);
    });
    const edit = (request, response) => {
      const result = payload(collection, request.body);
      response.json(collection === 'users' ? result : { id: Number(request.params.id), ...result });
    };
    app.put(`/${collection}/:id`, edit);
    app.patch(`/${collection}/:id`, edit);
  }

  app.use((error, _request, response, _next) => {
    // Never print database connection settings, request bodies, credentials or JWTs.
    const status = error.status === 400 || error.status === 413 ? error.status : 503;
    response.status(status).json({ error: status === 503 ? 'Fixture service unavailable' : 'Invalid request' });
  });
  return app;

  async function products(filter, query) {
    // The deployed product API limits the ascending subset before reversing it.
    const result = await database.collection('products').find(filter, { projection }).sort({ id: 1 }).limit(limit(query)).toArray();
    return query.sort === 'desc' ? result.reverse() : result;
  }
  async function list(collection, filter, query) {
    return database.collection(collection).find(filter, { projection }).sort({ id: query.sort === 'desc' ? -1 : 1 }).limit(limit(query)).toArray();
  }
}

function limit(query) {
  const value = Number(query.limit || 0);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw Object.assign(new Error('Invalid limit'), { status: 400 });
  }
  return value;
}

function dates(query) {
  const filter = {};
  for (const [name, operator] of [['startdate', '$gte'], ['enddate', '$lte']]) {
    if (query[name] === undefined) continue;
    const value = new Date(query[name]);
    if (!Number.isFinite(value.getTime())) throw Object.assign(new Error('Invalid date'), { status: 400 });
    filter[operator] = value;
  }
  return Object.keys(filter).length ? { date: filter } : {};
}

function payload(collection, body = {}) {
  if (collection === 'products') {
    const { title, price, description, image, category } = body;
    return { title, price, description, image, category };
  }
  if (collection === 'users') {
    const { email, username, password, name, address, phone } = body;
    return { email, username, password, name, address, phone };
  }
  return { userId: body.userId, date: new Date(body.date).toISOString(), products: body.products };
}
