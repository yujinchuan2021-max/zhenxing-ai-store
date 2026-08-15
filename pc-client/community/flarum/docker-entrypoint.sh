#!/bin/sh
set -eu

if [ ! -f /var/lib/flarum/config.php ]; then
  echo "Flarum config.php must be created by the explicit migration job" >&2
  exit 1
fi

# The durable config lives outside the image. Flarum's bootstrap cannot
# consistently use a config symlink after Apache drops privileges.
rm -f /var/www/html/config.php
cp /var/lib/flarum/config.php /var/www/html/config.php
chown www-data:www-data /var/www/html/config.php

install -d -m 0750 -o www-data -g www-data /var/www/html/storage/sessions

exec docker-php-entrypoint "$@"
