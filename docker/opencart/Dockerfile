FROM php:7.4-apache

ARG OPENCART_VERSION=3.0.3.8

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libonig-dev \
        libpng-dev \
        libzip-dev \
        unzip; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" gd mbstring mysqli pdo_mysql zip; \
    a2enmod rewrite; \
    rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    curl --fail --location --silent --show-error \
        "https://github.com/opencart/opencart/releases/download/${OPENCART_VERSION}/opencart-${OPENCART_VERSION}.zip" \
        --output /tmp/opencart.zip; \
    mkdir -p /opt/opencart; \
    unzip -q /tmp/opencart.zip -d /opt/opencart; \
    rm /tmp/opencart.zip; \
    mkdir -p /var/www/html/opencart

COPY apache.conf /etc/apache2/conf-available/opencart.conf
COPY environment.php configure.php database-state.php seed-customer.php /usr/local/lib/opencart/
COPY --chmod=755 entrypoint.sh /usr/local/bin/opencart-entrypoint

RUN a2enconf opencart

ENTRYPOINT ["opencart-entrypoint"]
CMD ["apache2-foreground"]
