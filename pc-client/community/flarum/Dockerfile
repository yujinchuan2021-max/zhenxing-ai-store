FROM composer:2.8@sha256:5248900ab8b5f7f880c2d62180e40960cd87f60149ec9a1abfd62ac72a02577c AS source

COPY dependency-lock.json /tmp/aihub-community-dependency-lock.json
RUN set -eux; \
    FLARUM_VERSION="$(php -r '$m=json_decode(file_get_contents("/tmp/aihub-community-dependency-lock.json"), true, 16, JSON_THROW_ON_ERROR); echo $m["flarum"];')"; \
    SSO_VERSION="$(php -r '$m=json_decode(file_get_contents("/tmp/aihub-community-dependency-lock.json"), true, 16, JSON_THROW_ON_ERROR); echo $m["sso"];')"; \
    LANGUAGE_VERSION="$(php -r '$m=json_decode(file_get_contents("/tmp/aihub-community-dependency-lock.json"), true, 16, JSON_THROW_ON_ERROR); echo $m["chineseSimplified"];')"; \
    composer create-project \
      "flarum/flarum:${FLARUM_VERSION}" \
      /app \
      --no-interaction \
      --prefer-dist \
      --no-install; \
    cd /app; \
    composer require \
      "maicol07/flarum-ext-sso:${SSO_VERSION}" \
      "flarum-lang/chinese-simplified:${LANGUAGE_VERSION}" \
      --no-interaction \
      --prefer-dist \
      --with-all-dependencies \
      --no-install; \
    php -r '$m=json_decode(file_get_contents("/tmp/aihub-community-dependency-lock.json"), true, 16, JSON_THROW_ON_ERROR); $actual=hash_file("sha256", "/app/composer.lock"); if (!hash_equals($m["composerLockSha256"], $actual)) { fwrite(STDERR, "community Composer lock drift detected\n"); exit(1); }'; \
    composer install \
      --no-dev \
      --no-interaction \
      --prefer-dist \
      --optimize-autoloader

FROM php:8.4-apache-bookworm@sha256:721cfc216f3a029c635ae55b3a43fb5c22ac271871a5453f940d392ed223675d

ARG AIHUB_SOURCE_REVISION
ARG AIHUB_RELEASE_VERSION
LABEL com.aihub.source-revision=$AIHUB_SOURCE_REVISION \
      com.aihub.release-version=$AIHUB_RELEASE_VERSION \
      com.aihub.runtime-contract=community-v1

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
COPY dependency-lock.json /usr/local/share/aihub/community-dependency-lock.json

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
