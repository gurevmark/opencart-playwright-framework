// OpenCart CI gets configuration from GitHub's env mapping, never from a .env file.
const required = [
  'APP_EMAIL', 'APP_PASSWORD', 'ADMIN_USERNAME', 'ADMIN_PASSWORD',
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'OPENCART_DB_ROOT_PASSWORD',
  'WEB_APP_URL', 'PRODUCT_NAME', 'PRODUCT_QUANTITY', 'TOTAL_PRICE',
];

const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing required CI configuration: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Required CI configuration is present.');
}
