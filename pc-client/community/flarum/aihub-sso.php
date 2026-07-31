<?php

declare(strict_types=1);

use Maicol07\SSO\Flarum;

// The upstream SSO helper supports Flarum 2 but still emits PHP 8.4
// deprecation notices. Never let those notices corrupt redirect headers.
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED);

require dirname(__DIR__) . '/vendor/autoload.php';

header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');

$ticket = (string) ($_GET['ticket'] ?? '');
if (!preg_match('/^[A-Za-z0-9_-]{32,}$/', $ticket)) {
    http_response_code(401);
    exit('社区登录票据无效');
}

$curl = curl_init(rtrim((string) getenv('AIHUB_IDENTITY_INTERNAL_URL'), '/').'/v1/internal/community/handoffs/redeem');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-AIHub-Community-Secret: '.getenv('AIHUB_COMMUNITY_INTERNAL_SECRET')
    ],
    CURLOPT_POSTFIELDS => json_encode(['ticket' => $ticket], JSON_THROW_ON_ERROR)
]);
$body = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);

if ($status !== 200 || !is_string($body)) {
    http_response_code(401);
    exit('社区登录票据已失效，请返回 AI Hub 重新进入');
}

$payload = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
$identity = $payload['user'] ?? null;
if (!is_array($identity)) {
    http_response_code(502);
    exit('身份服务返回无效');
}

$username = (string) ($identity['username'] ?? '');
$email = (string) ($identity['email'] ?? '');
$passwordToken = (string) getenv('AIHUB_FORUM_PASSWORD_TOKEN');

$flarum = new Flarum([
    'url' => (string) getenv('AIHUB_FORUM_INTERNAL_ORIGIN'),
    'root_domain' => '127.0.0.1',
    'api_key' => (string) getenv('AIHUB_FORUM_API_KEY'),
    'password_token' => $passwordToken,
    'remember' => false,
    'verify_ssl' => false,
    'cookies_prefix' => 'flarum'
]);
$user = $flarum->user($username);
$user->attributes->password = hash('sha256', $username.$passwordToken);
$user->attributes->email = $email;
$user->attributes->isEmailConfirmed = true;
if (empty($user->id)) {
    $user->attributes->username = $username;
}

if (!$user->login()) {
    http_response_code(502);
    exit('无法建立社区会话');
}

header('Location: '.rtrim((string) getenv('AIHUB_FORUM_PUBLIC_ORIGIN'), '/').'/', true, 303);
exit;
