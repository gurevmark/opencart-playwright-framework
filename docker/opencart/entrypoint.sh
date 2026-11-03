#!/bin/sh
set -eu

# Validate before copying files, installing, or creating the test customer.
: "${DB_USER:?DB_USER must be configured}"
: "${DB_PASSWORD:?DB_PASSWORD must be configured}"
: "${OPENCART_ADMIN_USER:?OPENCART_ADMIN_USER must be configured}"
: "${OPENCART_ADMIN_PASSWORD:?OPENCART_ADMIN_PASSWORD must be configured}"
: "${OPENCART_TEST_EMAIL:?OPENCART_TEST_EMAIL must be configured}"
: "${OPENCART_TEST_PASSWORD:?OPENCART_TEST_PASSWORD must be configured}"

source_directory=/opt/opencart
web_directory=/var/www/html/opencart
upload_directory="$web_directory/upload"

if [ ! -f "$upload_directory/index.php" ] || \
    [ ! -f "$upload_directory/system/storage/vendor/react/promise/src/functions_include.php" ]; then
    echo "Copying OpenCart files into the persistent volume..."
    cp -a "$source_directory/." "$web_directory/"
fi

database_status=0
php /usr/local/lib/opencart/database-state.php || database_status=$?

if [ "$database_status" -eq 10 ]; then
    echo "Installing OpenCart into the empty database..."

    if [ ! -f "$upload_directory/install/cli_install.php" ]; then
        cp -a "$source_directory/upload/install" "$upload_directory/install"
    fi

    php "$upload_directory/install/cli_install.php" install \
        --db_hostname "${DB_HOST:-database}" \
        --db_username "${DB_USER}" \
        --db_password "${DB_PASSWORD}" \
        --db_database "${DB_NAME:-openshop}" \
        --db_driver mysqli \
        --db_prefix "${DB_PREFIX:-oc_}" \
        --db_port "${DB_PORT:-3306}" \
        --username "${OPENCART_ADMIN_USER}" \
        --password "${OPENCART_ADMIN_PASSWORD}" \
        --email "${OPENCART_ADMIN_EMAIL:-admin@example.test}" \
        --http_server "${OPENCART_HTTP_SERVER:-http://localhost/opencart/upload/}"
elif [ "$database_status" -ne 0 ]; then
    exit "$database_status"
fi

# Recreate the configuration on every start so .env changes are applied.
php /usr/local/lib/opencart/configure.php
php /usr/local/lib/opencart/seed-customer.php

# OpenCart requires the installer to be removed after setup.
rm -rf "$upload_directory/install"
chown -R www-data:www-data "$web_directory"

exec docker-php-entrypoint "$@"
