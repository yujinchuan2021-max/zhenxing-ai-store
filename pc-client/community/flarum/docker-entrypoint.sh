#!/bin/sh
set -eu

mkdir -p /var/lib/flarum /var/www/html/storage /var/www/html/public/assets
chown -R www-data:www-data \
  /var/lib/flarum \
  /var/www/html/storage \
  /var/www/html/public/assets

if [ ! -f /var/lib/flarum/config.php ]; then
  rm -f /var/www/html/config.php
  php -r '
    $config = [
      "debug" => false,
      "baseUrl" => getenv("AIHUB_FORUM_PUBLIC_ORIGIN"),
      "databaseConfiguration" => [
        "driver" => "mariadb",
        "host" => getenv("AIHUB_FORUM_DB_HOST"),
        "port" => (int) getenv("AIHUB_FORUM_DB_PORT"),
        "database" => getenv("AIHUB_FORUM_DB_NAME"),
        "username" => getenv("AIHUB_FORUM_DB_USER"),
        "password" => getenv("AIHUB_FORUM_DB_PASSWORD"),
        "prefix" => ""
      ],
      "adminUser" => [
        "username" => getenv("AIHUB_FORUM_ADMIN_USER"),
        "password" => getenv("AIHUB_FORUM_ADMIN_PASSWORD"),
        "email" => getenv("AIHUB_FORUM_ADMIN_EMAIL")
      ],
      "settings" => ["forum_title" => "AI Hub 社区"],
      "queue" => ["driver" => "sync"]
    ];
    file_put_contents("/tmp/aihub-flarum-install.json", json_encode($config));
  '
  chown www-data:www-data /tmp/aihub-flarum-install.json
  runuser -u www-data -- php flarum install \
    --file=/tmp/aihub-flarum-install.json
  rm -f /tmp/aihub-flarum-install.json
  cp /var/www/html/config.php /var/lib/flarum/config.php
  chown www-data:www-data /var/lib/flarum/config.php
fi

# Keep the durable copy in the volume, then materialize it in Flarum's project
# directory. Flarum 2's bootstrap does not consistently recognize a config
# symlink after Apache drops privileges.
rm -f /var/www/html/config.php
cp /var/lib/flarum/config.php /var/www/html/config.php
chown www-data:www-data /var/www/html/config.php

if ! php -r '
  $config = require "/var/lib/flarum/config.php";
  $database = $config["database"];
  $pdo = new PDO(
    "mysql:host=".$database["host"].
    ";port=".$database["port"].
    ";dbname=".$database["database"].";charset=utf8mb4",
    $database["username"],
    $database["password"],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );
  $enabled = $pdo->query(
    "SELECT value FROM settings WHERE `key` = \"extensions_enabled\""
  )->fetchColumn();
  exit(str_contains((string) $enabled, "\"maicol07-sso\"") ? 0 : 1);
'; then
  php flarum extension:enable maicol07-sso
fi

php flarum migrate
php flarum assets:publish
php flarum cache:clear

php -r '
  $pdo = new PDO(
    "mysql:host=".getenv("AIHUB_FORUM_DB_HOST").
    ";port=".getenv("AIHUB_FORUM_DB_PORT").
    ";dbname=".getenv("AIHUB_FORUM_DB_NAME").";charset=utf8mb4",
    getenv("AIHUB_FORUM_DB_USER"),
    getenv("AIHUB_FORUM_DB_PASSWORD"),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );
  $statement = $pdo->prepare(
    "INSERT IGNORE INTO api_keys (`key`, allowed_ips, user_id, created_at)
     VALUES (?, ?, 1, UTC_TIMESTAMP())"
  );
  $statement->execute([
    getenv("AIHUB_FORUM_API_KEY"),
    "127.0.0.1"
  ]);
'

exec docker-php-entrypoint "$@"
