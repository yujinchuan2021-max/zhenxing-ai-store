<?php

declare(strict_types=1);

$installed = json_decode(
    file_get_contents('/var/www/html/vendor/composer/installed.json'),
    true,
    64,
    JSON_THROW_ON_ERROR
);
$names = [
    'maicol07/flarum-ext-sso',
    'maicol07/flarum-sso-plugin',
    'maicol07/flarum-api-client'
];
$packages = [];
foreach ($installed['packages'] as $package) {
    if (in_array($package['name'], $names, true)) {
        $packages[$package['name']] = [
            'version' => $package['version'],
            'reference' => $package['dist']['reference'] ?? null
        ];
    }
}
ksort($packages);
echo json_encode([
    'packages' => $packages,
    'composerLockSha256' => hash_file('sha256', '/var/www/html/composer.lock'),
    'helperCookiesSha256' => hash_file('sha256', '/var/www/html/vendor/maicol07/flarum-sso-plugin/src/Traits/Cookies.php'),
    'helperAuthSha256' => hash_file('sha256', '/var/www/html/vendor/maicol07/flarum-sso-plugin/src/User/Traits/Auth.php'),
    'ssoPhpSha256' => hash_file('sha256', '/var/www/html/public/aihub-sso.php')
], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT), PHP_EOL;
