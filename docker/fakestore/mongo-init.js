// Mongo's official entrypoint runs this only for a new CI database volume.
if (!process.env.FAKESTORE_MONGO_PASSWORD) throw new Error('FAKESTORE_MONGO_PASSWORD must be configured.');
db.getSiblingDB('fakestore').createUser({
  user: 'fakestore',
  pwd: process.env.FAKESTORE_MONGO_PASSWORD,
  roles: [{ role: 'readWrite', db: 'fakestore' }],
});
