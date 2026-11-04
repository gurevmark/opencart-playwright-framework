// CI gets configuration from GitHub's env mapping, never from a .env file.
const required = [
  'APP_EMAIL', 'APP_PASSWORD', 'ADMIN_USERNAME', 'ADMIN_PASSWORD',
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'OPENCART_DB_ROOT_PASSWORD',
  'WEB_APP_URL', 'PRODUCT_NAME', 'PRODUCT_QUANTITY', 'TOTAL_PRICE',
];

if (process.argv.includes('--with-api')) {
  required.push(
    'API_BASE_URL', 'USERNAME', 'PASSWORD', 'USER_ID', 'PRODUCT_ID', 'CART_ID',
    'LIMIT', 'START_DATE', 'END_DATE', 'FAKESTORE_JWT_SECRET',
    'FAKESTORE_MONGO_PASSWORD', 'FAKESTORE_MONGO_ROOT_PASSWORD',
  );
}

const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing required CI configuration: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Required CI configuration is present.');
}
