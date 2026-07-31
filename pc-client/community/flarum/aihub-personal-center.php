<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $value): never
{
    http_response_code($status);
    echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'METHOD_NOT_ALLOWED']);
}

$expectedSecret = (string) getenv('AIHUB_COMMUNITY_INTERNAL_SECRET');
$receivedSecret = (string) ($_SERVER['HTTP_X_AIHUB_COMMUNITY_SECRET'] ?? '');
if (
    strlen($expectedSecret) < 32 ||
    !hash_equals($expectedSecret, $receivedSecret)
) {
    respond(403, ['error' => 'FORBIDDEN']);
}

$raw = file_get_contents('php://input', false, null, 0, 131073);
if (!is_string($raw) || strlen($raw) > 131072) {
    respond(413, ['error' => 'PAYLOAD_TOO_LARGE']);
}

try {
    $input = json_decode($raw ?: '{}', true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    respond(400, ['error' => 'INVALID_JSON']);
}
if (!is_array($input)) {
    respond(400, ['error' => 'INVALID_INPUT']);
}

$username = trim((string) ($input['username'] ?? ''));
if (!preg_match('/^[a-z0-9_-]{3,100}$/i', $username)) {
    respond(400, ['error' => 'INVALID_USERNAME']);
}

$config = require dirname(__DIR__).'/config.php';
$database = $config['database'];
$pdo = new PDO(
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

$userStatement = $pdo->prepare(
    'SELECT id FROM users WHERE username = ? LIMIT 1'
);
$userStatement->execute([$username]);
$userId = $userStatement->fetchColumn();
if (!$userId) {
    respond(200, [
        'notifications' => [],
        'interactions' => [],
        'unreadCount' => 0
    ]);
}

$action = (string) ($input['action'] ?? 'list');
if ($action === 'mark-read') {
    $notificationId = (string) ($input['notificationId'] ?? '');
    if (!preg_match('/^[1-9][0-9]{0,19}$/', $notificationId)) {
        respond(400, ['error' => 'INVALID_NOTIFICATION']);
    }
    $statement = $pdo->prepare(
        'UPDATE notifications
         SET read_at = COALESCE(read_at, UTC_TIMESTAMP())
         WHERE id = ? AND user_id = ? AND is_deleted = 0'
    );
    $statement->execute([$notificationId, $userId]);
    if ($statement->rowCount() < 1) {
        $exists = $pdo->prepare(
            'SELECT read_at FROM notifications
             WHERE id = ? AND user_id = ? AND is_deleted = 0'
        );
        $exists->execute([$notificationId, $userId]);
        if ($exists->fetchColumn() === false) {
            respond(404, ['error' => 'NOT_FOUND']);
        }
    }
    respond(200, ['ok' => true]);
}
if ($action !== 'list') {
    respond(400, ['error' => 'INVALID_ACTION']);
}

$limit = min(100, max(1, (int) ($input['limit'] ?? 50)));
$notifications = $pdo->prepare(
    'SELECT n.id, n.type, n.subject_id, n.read_at, n.created_at,
            actor.username AS actor_username,
            CASE WHEN n.type = "newDiscussionInTag"
              THEN direct_discussion.id ELSE post_discussion.id END AS discussion_id,
            CASE WHEN n.type = "newDiscussionInTag"
              THEN direct_discussion.title ELSE post_discussion.title END AS discussion_title,
            CASE WHEN n.type = "newDiscussionInTag"
              THEN direct_discussion.slug ELSE post_discussion.slug END AS discussion_slug,
            subject_post.number AS post_number
     FROM notifications n
     LEFT JOIN users actor ON actor.id = n.from_user_id
     LEFT JOIN posts subject_post ON subject_post.id = n.subject_id
     LEFT JOIN discussions post_discussion
       ON post_discussion.id = subject_post.discussion_id
     LEFT JOIN discussions direct_discussion
       ON direct_discussion.id = n.subject_id
     WHERE n.user_id = ? AND n.is_deleted = 0
     ORDER BY n.created_at DESC
     LIMIT ?'
);
$notifications->bindValue(1, (int) $userId, PDO::PARAM_INT);
$notifications->bindValue(2, $limit, PDO::PARAM_INT);
$notifications->execute();
$notificationRows = $notifications->fetchAll();

$followed = $pdo->prepare(
    'SELECT d.id, d.title, d.slug,
            COALESCE(du.last_read_at, d.last_posted_at, d.created_at) AS updated_at
     FROM discussion_user du
     JOIN discussions d ON d.id = du.discussion_id
     WHERE du.user_id = ? AND du.subscription = "follow"'
);
$followed->execute([$userId]);

$liked = $pdo->prepare(
    'SELECT d.id, d.title, d.slug, MAX(pl.created_at) AS updated_at
     FROM post_likes pl
     JOIN posts p ON p.id = pl.post_id
     JOIN discussions d ON d.id = p.discussion_id
     WHERE pl.user_id = ?
     GROUP BY d.id, d.title, d.slug'
);
$liked->execute([$userId]);

$interactions = [];
foreach ($followed->fetchAll() as $row) {
    $id = (string) $row['id'];
    $interactions[$id] = [
        'discussionId' => $id,
        'title' => (string) $row['title'],
        'slug' => (string) $row['slug'],
        'favorited' => true,
        'liked' => false,
        'updatedAt' => (string) $row['updated_at']
    ];
}
foreach ($liked->fetchAll() as $row) {
    $id = (string) $row['id'];
    $existing = $interactions[$id] ?? [
        'discussionId' => $id,
        'title' => (string) $row['title'],
        'slug' => (string) $row['slug'],
        'favorited' => false,
        'liked' => false,
        'updatedAt' => (string) $row['updated_at']
    ];
    $existing['liked'] = true;
    if ((string) $row['updated_at'] > (string) $existing['updatedAt']) {
        $existing['updatedAt'] = (string) $row['updated_at'];
    }
    $interactions[$id] = $existing;
}

respond(200, [
    'notifications' => array_map(
        static fn (array $row): array => [
            'id' => (string) $row['id'],
            'type' => (string) $row['type'],
            'actorUsername' => (string) ($row['actor_username'] ?? ''),
            'discussionId' => (string) ($row['discussion_id'] ?? ''),
            'discussionTitle' => (string) ($row['discussion_title'] ?? ''),
            'discussionSlug' => (string) ($row['discussion_slug'] ?? ''),
            'postNumber' => $row['post_number'] === null
                ? null
                : (int) $row['post_number'],
            'read' => $row['read_at'] !== null,
            'readAt' => $row['read_at'],
            'createdAt' => (string) $row['created_at']
        ],
        $notificationRows
    ),
    'interactions' => array_values($interactions),
    'unreadCount' => count(
        array_filter(
            $notificationRows,
            static fn (array $row): bool => $row['read_at'] === null
        )
    )
]);
