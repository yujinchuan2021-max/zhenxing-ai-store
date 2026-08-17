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
      "settings" => ["forum_title" => "枕星AI助手 社区"],
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
  exit(str_contains((string) $enabled, "\"flarum-lang-chinese-simplified\"") ? 0 : 1);
'; then
  php flarum extension:enable flarum-lang-chinese-simplified
fi

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
  exit(str_contains((string) $enabled, "\"flarum-nicknames\"") ? 0 : 1);
'; then
  php flarum extension:enable flarum-nicknames
fi

php flarum migrate
php flarum assets:publish
php flarum cache:clear
mkdir -p /var/www/html/storage/formatter
chown www-data:www-data /var/www/html/storage/formatter

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
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS aihub_identity_links (
       identity_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
       forum_user_id INT UNSIGNED NOT NULL,
       community_username VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
       created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (identity_user_id),
       UNIQUE KEY aihub_identity_links_forum_user (forum_user_id),
       UNIQUE KEY aihub_identity_links_username (community_username),
       CONSTRAINT aihub_identity_links_user_fk
         FOREIGN KEY (forum_user_id) REFERENCES users(id) ON DELETE CASCADE
     ) ENGINE=InnoDB"
  );
  $statement = $pdo->prepare(
    "INSERT INTO settings (`key`, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)"
  );
  $statement->execute(["forum_title", "枕星AI助手 社区"]);
  foreach ([
    "display_name_driver" => "nickname",
    "flarum-nicknames.min" => "2",
    "flarum-nicknames.max" => "32",
    "allow_sign_up" => "0"
  ] as $key => $value) {
    $statement->execute([$key, $value]);
  }
  $pdo->exec(
    "DELETE FROM group_permission WHERE permission = \"user.editOwnNickname\""
  );
'

exit 0
