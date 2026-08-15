<?php

declare(strict_types=1);

use Maicol07\SSO\Flarum;

function fail(int $status, string $message): never
{
    http_response_code($status);
    exit($message);
}

function forumDatabase(): PDO
{
    $config = require dirname(__DIR__).'/config.php';
    $database = $config['database'];

    return new PDO(
        'mysql:host='.$database['host'].
        ';port='.$database['port'].
        ';dbname='.$database['database'].';charset=utf8mb4',
        $database['username'],
        $database['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
}

function claimForumIdentity(
    PDO $pdo,
    string $identityId,
    string $username,
    string $email
): ?int
{
    $pdo->beginTransaction();
    try {
        $linked = $pdo->prepare(
            'SELECT forum_user_id FROM aihub_identity_links
             WHERE identity_user_id = ? FOR UPDATE'
        );
        $linked->execute([$identityId]);
        $linkedForumUserId = $linked->fetchColumn();
        if ($linkedForumUserId !== false) {
            $forumUser = $pdo->prepare(
                'SELECT id, username, email FROM users WHERE id = ? FOR UPDATE'
            );
            $forumUser->execute([(int) $linkedForumUserId]);
            $row = $forumUser->fetch();
            if (!is_array($row)) {
                throw new RuntimeException('COMMUNITY_IDENTITY_LINK_BROKEN');
            }
            $collision = $pdo->prepare(
                'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1 FOR UPDATE'
            );
            $collision->execute([$username, (int) $row['id']]);
            if ($collision->fetchColumn() !== false) {
                throw new RuntimeException('COMMUNITY_USERNAME_COLLISION');
            }
            if ((string) $row['username'] !== $username) {
                $rename = $pdo->prepare('UPDATE users SET username = ? WHERE id = ?');
                $rename->execute([$username, (int) $row['id']]);
            }
            $pdo->commit();
            return (int) $row['id'];
        }

        $statement = $pdo->prepare(
            'SELECT id, username, email FROM users
             WHERE username = ? OR email = ? FOR UPDATE'
        );
        $statement->execute([$username, $email]);
        $emailUser = null;
        $usernameUser = null;
        foreach ($statement->fetchAll() as $row) {
            if (strcasecmp((string) $row['email'], $email) === 0) {
                $emailUser = $row;
            }
            if ((string) $row['username'] === $username) {
                $usernameUser = $row;
            }
        }

        if (
            $usernameUser !== null &&
            ($emailUser === null || $usernameUser['id'] !== $emailUser['id'])
        ) {
            throw new RuntimeException('COMMUNITY_USERNAME_COLLISION');
        }
        if ($emailUser !== null && (string) $emailUser['username'] !== $username) {
            $rename = $pdo->prepare('UPDATE users SET username = ? WHERE id = ?');
            $rename->execute([$username, $emailUser['id']]);
        }
        $pdo->commit();
        return $emailUser === null ? null : (int) $emailUser['id'];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function linkForumIdentity(
    PDO $pdo,
    string $identityId,
    int $forumUserId,
    string $username
): void
{
    if ($forumUserId < 1) {
        throw new RuntimeException('COMMUNITY_IDENTITY_LINK_BROKEN');
    }

    $pdo->beginTransaction();
    try {
        $linked = $pdo->prepare(
            'SELECT forum_user_id FROM aihub_identity_links
             WHERE identity_user_id = ? FOR UPDATE'
        );
        $linked->execute([$identityId]);
        $existingForumUserId = $linked->fetchColumn();
        if ($existingForumUserId !== false) {
            if ((int) $existingForumUserId !== $forumUserId) {
                throw new RuntimeException('COMMUNITY_IDENTITY_LINK_BROKEN');
            }
            $update = $pdo->prepare(
                'UPDATE aihub_identity_links
                 SET community_username = ?, updated_at = UTC_TIMESTAMP()
                 WHERE identity_user_id = ?'
            );
            $update->execute([$username, $identityId]);
        } else {
            $collision = $pdo->prepare(
                'SELECT identity_user_id FROM aihub_identity_links
                 WHERE forum_user_id = ? OR community_username = ? FOR UPDATE'
            );
            $collision->execute([$forumUserId, $username]);
            if ($collision->fetchColumn() !== false) {
                throw new RuntimeException('COMMUNITY_USERNAME_COLLISION');
            }
            $insert = $pdo->prepare(
                'INSERT INTO aihub_identity_links
                  (identity_user_id, forum_user_id, community_username)
                 VALUES (?, ?, ?)'
            );
            $insert->execute([$identityId, $forumUserId, $username]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

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
    fail(401, '社区登录票据无效');
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
    fail(401, '社区登录票据已失效，请返回枕星 AI 重新进入');
}

$payload = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
$identity = $payload['user'] ?? null;
if (!is_array($identity)) {
    fail(502, '身份服务返回无效');
}

$identityId = (string) ($identity['id'] ?? '');
if (!preg_match('/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i', $identityId)) {
    fail(502, '身份服务返回无效用户标识');
}
$username = (string) ($payload['communityUsername'] ?? '');
if (!preg_match('/^[a-z0-9_-]{3,30}$/i', $username)) {
    fail(502, '身份服务返回无效社区用户名');
}
$email = (string) ($identity['email'] ?? '');
$profile = $identity['profile'] ?? null;
$nickname = is_array($profile) ? trim((string) ($profile['nickname'] ?? '')) : '';
$avatarUrl = is_array($profile) ? trim((string) ($profile['avatarUrl'] ?? '')) : '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $nickname === '' || mb_strlen($nickname) > 32) {
    fail(502, '身份服务返回无效社区资料');
}
if (
    $avatarUrl !== '' &&
    (
        strlen($avatarUrl) > 100 ||
        filter_var($avatarUrl, FILTER_VALIDATE_URL) === false ||
        !in_array((string) parse_url($avatarUrl, PHP_URL_SCHEME), ['http', 'https'], true)
    )
) {
    fail(502, '身份服务返回无效头像地址');
}

$pdo = forumDatabase();
try {
    claimForumIdentity($pdo, $identityId, $username, $email);
} catch (RuntimeException $error) {
    if ($error->getMessage() === 'COMMUNITY_USERNAME_COLLISION') {
        fail(409, '社区身份映射冲突，请联系管理员处理');
    }
    throw $error;
}

$passwordToken = (string) getenv('AIHUB_FORUM_PASSWORD_TOKEN');
$forumPublicScheme = parse_url(
    (string) getenv('AIHUB_FORUM_PUBLIC_ORIGIN'),
    PHP_URL_SCHEME
);
$forumPublicHost = parse_url(
    (string) getenv('AIHUB_FORUM_PUBLIC_ORIGIN'),
    PHP_URL_HOST
);
if (
    !in_array($forumPublicScheme, ['http', 'https'], true) ||
    !is_string($forumPublicHost) ||
    !preg_match('/^[A-Za-z0-9.-]+$/', $forumPublicHost)
) {
    fail(500, '社区地址配置无效');
}
$forumCookieSecure = $forumPublicScheme === 'https';

$flarum = new Flarum([
    'url' => (string) getenv('AIHUB_FORUM_INTERNAL_ORIGIN'),
    'root_domain' => $forumPublicHost,
    'api_key' => (string) getenv('AIHUB_FORUM_API_KEY'),
    'password_token' => $passwordToken,
    'remember' => false,
    // The helper also uses verify_ssl as the session cookie Secure flag.
    'verify_ssl' => $forumCookieSecure,
    'cookies_prefix' => 'flarum'
]);
$user = $flarum->user($username);
$user->attributes->password = hash('sha256', $username.$passwordToken);
$user->attributes->email = $email;
$user->attributes->isEmailConfirmed = true;
$user->attributes->nickname = $nickname;
if (empty($user->id)) {
    $user->attributes->username = $username;
} elseif (!$user->update()) {
    fail(502, '无法同步社区资料');
}

if (!$user->login()) {
    fail(502, '无法建立社区会话');
}

if (empty($user->id) && !$user->fetch()) {
    fail(502, '无法确认社区用户');
}

try {
    linkForumIdentity($pdo, $identityId, (int) $user->id, $username);
} catch (RuntimeException $error) {
    if ($error->getMessage() === 'COMMUNITY_USERNAME_COLLISION') {
        fail(409, '社区身份映射冲突，请联系管理员处理');
    }
    throw $error;
}

$avatar = $pdo->prepare('UPDATE users SET avatar_url = NULLIF(?, ?) WHERE username = ?');
$avatar->execute([$avatarUrl, '', $username]);

header('Location: '.rtrim((string) getenv('AIHUB_FORUM_PUBLIC_ORIGIN'), '/').'/', true, 303);
exit;
