<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'");

final class CommunityManagementFailure extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 502)
    {
        parent::__construct($message);
    }
}

function respond(int $status, array $value): never
{
    http_response_code($status);
    echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function unavailableSummary(): array
{
    return [
        'status' => 'unavailable',
        'health' => 'unavailable',
        'users' => ['status' => 'unavailable', 'total' => null],
        'posts' => ['status' => 'unavailable', 'total' => null],
        'pending' => ['status' => 'unavailable', 'total' => null],
        'reports' => ['status' => 'unavailable', 'total' => null],
        'targets' => ['discussions' => [], 'posts' => []],
        'capabilities' => [
            'setDiscussionHidden' => false,
            'setPostHidden' => false,
            'nativeAdmin' => false
        ]
    ];
}

function exactKeys(array $value, array $expected): bool
{
    $actual = array_keys($value);
    sort($actual);
    sort($expected);
    return $actual === $expected;
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
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
}

function scalarCount(PDO $pdo, string $sql): int
{
    $value = $pdo->query($sql)->fetchColumn();
    if (!is_numeric($value) || (int) $value < 0) {
        throw new RuntimeException('INVALID_COMMUNITY_COUNT');
    }
    return (int) $value;
}

function hasColumn(PDO $pdo, string $table, string $column): bool
{
    $statement = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
         LIMIT 1'
    );
    $statement->execute([$table, $column]);
    return $statement->fetchColumn() !== false;
}

function unavailableModerationMetric(): array
{
    return [
        'status' => 'unavailable',
        'total' => null,
        'reason' => 'moderation-extension-not-configured'
    ];
}

function pendingMetric(PDO $pdo): array
{
    if (!hasColumn($pdo, 'posts', 'is_approved')) {
        return unavailableModerationMetric();
    }
    return [
        'status' => 'ready',
        'total' => scalarCount($pdo, "SELECT COUNT(*) FROM posts WHERE type = 'comment' AND is_approved = 0")
    ];
}

function reportsMetric(PDO $pdo): array
{
    if (!hasColumn($pdo, 'post_flags', 'dismissed_at')) {
        return unavailableModerationMetric();
    }
    return [
        'status' => 'ready',
        'total' => scalarCount($pdo, 'SELECT COUNT(*) FROM post_flags WHERE dismissed_at IS NULL')
    ];
}

function plainText(mixed $value, int $limit): string
{
    $text = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/[[:cntrl:]]/u', ' ', $text) ?? '';
    $text = preg_replace('/\s+/u', ' ', $text) ?? '';
    return mb_substr(trim($text), 0, $limit, 'UTF-8');
}

function isForumApiConfigured(): bool
{
    $apiKey = (string) getenv('AIHUB_FORUM_API_KEY');
    return strlen($apiKey) >= 32 && strlen($apiKey) <= 512;
}

function targets(PDO $pdo): array
{
    $discussions = $pdo->query(
        'SELECT id, title, hidden_at IS NOT NULL AS hidden
         FROM discussions
         ORDER BY last_posted_at DESC, id DESC
         LIMIT 20'
    )->fetchAll();
    $posts = $pdo->query(
        "SELECT id, discussion_id, number, content, hidden_at IS NOT NULL AS hidden
         FROM posts
         WHERE type = 'comment'
         ORDER BY created_at DESC, id DESC
         LIMIT 20"
    )->fetchAll();

    return [
        'discussions' => array_map(
            static fn (array $row): array => [
                'id' => (string) $row['id'],
                'title' => plainText($row['title'], 160),
                'hidden' => (bool) $row['hidden']
            ],
            $discussions
        ),
        'posts' => array_map(
            static fn (array $row): array => [
                'id' => (string) $row['id'],
                'discussionId' => (string) $row['discussion_id'],
                'number' => (int) $row['number'],
                'preview' => plainText($row['content'], 240),
                'hidden' => (bool) $row['hidden']
            ],
            $posts
        )
    ];
}

function listSummary(): array
{
    try {
        $pdo = forumDatabase();
        $canManage = isForumApiConfigured();
        return [
            'status' => 'ready',
            'health' => 'ready',
            'users' => ['status' => 'ready', 'total' => scalarCount($pdo, 'SELECT COUNT(*) FROM users')],
            'posts' => ['status' => 'ready', 'total' => scalarCount($pdo, "SELECT COUNT(*) FROM posts WHERE type = 'comment'")],
            'pending' => pendingMetric($pdo),
            'reports' => reportsMetric($pdo),
            'targets' => targets($pdo),
            'capabilities' => [
                'setDiscussionHidden' => $canManage,
                'setPostHidden' => $canManage,
                'nativeAdmin' => false
            ]
        ];
    } catch (Throwable) {
        return unavailableSummary();
    }
}

function flarumRequest(string $method, string $path, array $body): void
{
    if (!preg_match('#^/api/(?:discussions|posts)/[1-9][0-9]{0,19}$#', $path)) {
        throw new CommunityManagementFailure('INVALID_TARGET', 400);
    }
    $apiKey = (string) getenv('AIHUB_FORUM_API_KEY');
    if (!isForumApiConfigured()) {
        throw new CommunityManagementFailure('COMMUNITY_MANAGEMENT_UNAVAILABLE', 503);
    }
    $curl = curl_init('http://127.0.0.1'.$path);
    if ($curl === false) {
        throw new CommunityManagementFailure('COMMUNITY_MANAGEMENT_UNAVAILABLE', 502);
    }
    $receivedBytes = 0;
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_POSTFIELDS => json_encode($body, JSON_THROW_ON_ERROR),
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP,
        CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$receivedBytes): int {
            if (strlen($chunk) > 1048576 - $receivedBytes) {
                return 0;
            }
            $receivedBytes += strlen($chunk);
            return strlen($chunk);
        },
        CURLOPT_HTTPHEADER => [
            'Accept: application/vnd.api+json',
            'Content-Type: application/vnd.api+json',
            'Authorization: Token '.$apiKey.'; userId=1'
        ]
    ]);
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    if ($response === false || $status < 200 || $status >= 300) {
        throw new CommunityManagementFailure(
            $status === 404 ? 'NOT_FOUND' : 'COMMUNITY_MANAGEMENT_UNAVAILABLE',
            $status === 404 ? 404 : ($status === 403 ? 403 : 502)
        );
    }
}

function targetExists(PDO $pdo, string $table, string $id): bool
{
    $statement = $pdo->prepare('SELECT 1 FROM '.$table.' WHERE id = ? LIMIT 1');
    $statement->execute([$id]);
    return $statement->fetchColumn() !== false;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'METHOD_NOT_ALLOWED']);
}
$expectedSecret = (string) getenv('AIHUB_COMMUNITY_MANAGEMENT_SECRET');
$receivedSecret = (string) ($_SERVER['HTTP_X_AIHUB_COMMUNITY_MANAGEMENT_SECRET'] ?? '');
if (
    strlen($expectedSecret) < 32 ||
    strlen($expectedSecret) > 512 ||
    !hash_equals($expectedSecret, $receivedSecret)
) {
    respond(403, ['error' => 'FORBIDDEN']);
}

$raw = file_get_contents('php://input', false, null, 0, 65537);
if (!is_string($raw) || strlen($raw) > 65536) {
    respond(413, ['error' => 'PAYLOAD_TOO_LARGE']);
}
try {
    $input = json_decode($raw ?: '{}', true, 8, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    respond(400, ['error' => 'INVALID_JSON']);
}
if (!is_array($input)) {
    respond(400, ['error' => 'INVALID_INPUT']);
}

if (($input['action'] ?? null) === 'list' && exactKeys($input, ['action'])) {
    respond(200, listSummary());
}

$action = (string) ($input['action'] ?? '');
$targets = [
    'set-discussion-hidden' => ['discussionId', 'discussions', 'discussion'],
    'set-post-hidden' => ['postId', 'posts', 'post']
];
if (!isset($targets[$action])) {
    respond(400, ['error' => 'INVALID_ACTION']);
}
[$idField, $resourceType, $targetType] = $targets[$action];
if (
    !exactKeys($input, ['action', $idField, 'hidden']) ||
    !preg_match('/^[1-9][0-9]{0,19}$/', (string) ($input[$idField] ?? '')) ||
    !is_bool($input['hidden'] ?? null)
) {
    respond(400, ['error' => 'INVALID_INPUT']);
}

try {
    $id = (string) $input[$idField];
    $pdo = forumDatabase();
    if (!targetExists($pdo, $resourceType, $id)) {
        respond(404, ['error' => 'NOT_FOUND']);
    }
    flarumRequest('PATCH', '/api/'.$resourceType.'/'.$id, [
        'data' => [
            'type' => $resourceType,
            'id' => $id,
            'attributes' => ['isHidden' => $input['hidden']]
        ]
    ]);
    respond(200, [
        'ok' => true,
        'action' => $action,
        'target' => ['type' => $targetType, 'id' => $id],
        'hidden' => $input['hidden']
    ]);
} catch (CommunityManagementFailure $error) {
    respond($error->status, ['error' => $error->getMessage()]);
} catch (Throwable) {
    respond(502, ['error' => 'COMMUNITY_MANAGEMENT_UNAVAILABLE']);
}
