import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

export const datasetVersion = 'fakestore-ci-v1';

/** Populate only a new fixture database; never replace unknown existing data. */
export async function seedDatabase(database, credentials) {
  const metadata = database.collection('_fixture_metadata');
  const marker = await metadata.findOne({ _id: 'dataset' });
  if (marker) {
    const user = await database.collection('users').findOne({ id: 1 });
    if (marker.version !== datasetVersion || user?.username !== credentials.username || user?.password !== credentials.password) {
      throw new Error('Existing fixture configuration differs; use a new isolated CI volume.');
    }
    return;
  }
  for (const name of ['products', 'users', 'carts']) {
    if (await database.collection(name).countDocuments()) {
      throw new Error('Refusing to seed an unrecognized non-empty database.');
    }
  }
  const fixtures = JSON.parse(await readFile(new URL('./seed.json', import.meta.url), 'utf8'));
  fixtures.users = fixtures.users.map(user => ({
    ...user,
    username: user.id === 1 ? credentials.username : user.username,
    password: user.id === 1 ? credentials.password : randomBytes(24).toString('hex'),
  }));
  fixtures.carts = fixtures.carts.map(cart => ({ ...cart, date: new Date(cart.date) }));
  for (const name of ['products', 'users', 'carts']) {
    await database.collection(name).createIndex({ id: 1 }, { unique: true });
    await database.collection(name).insertMany(fixtures[name]);
  }
  await metadata.insertOne({ _id: 'dataset', version: datasetVersion });
}
