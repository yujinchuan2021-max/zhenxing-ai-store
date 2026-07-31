FROM composer:2.8 AS source

ARG FLARUM_VERSION=2.0.0-rc.5
RUN composer create-project \
    "flarum/flarum:${FLARUM_VERSION}" \
    /app \
    --no-interaction \
    --prefer-dist \
    && cd /app \
    && composer require \
      "maicol07/flarum-ext-sso:2.0" \
      --no-interaction \
      --prefer-dist

FROM php:8.4-apache-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      libcurl4-openssl-dev \
      libfreetype6-dev \
      libicu-dev \
      libjpeg62-turbo-dev \
      libonig-dev \
      libpng-dev \
      libzip-dev \
      unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
      curl \
      gd \
      intl \
      mbstring \
      pdo_mysql \
      zip \
    && a2enmod rewrite headers expires \
    && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

COPY --from=source --chown=www-data:www-data /app /var/www/html
COPY apache.conf /etc/apache2/conf-available/flarum.conf
COPY docker-entrypoint.sh /usr/local/bin/aihub-flarum-entrypoint
COPY --chown=www-data:www-data aihub-sso.php /var/www/html/public/aihub-sso.php
COPY --chown=www-data:www-data aihub-personal-center.php /var/www/html/public/aihub-personal-center.php

RUN sed -ri \
      's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
      /etc/apache2/sites-available/*.conf \
      /etc/apache2/apache2.conf \
      /etc/apache2/conf-available/*.conf \
    && a2enconf flarum \
    && chmod 0755 /usr/local/bin/aihub-flarum-entrypoint \
    && mkdir -p /var/lib/flarum \
    && chown -R www-data:www-data /var/lib/flarum \
    && sed -ri \
      's#(CustomLog .*access\.log combined)#\1 env=!aihub_no_access_log#' \
      /etc/apache2/sites-available/*.conf

WORKDIR /var/www/html
ENTRYPOINT ["aihub-flarum-entrypoint"]
CMD ["apache2-foreground"]
