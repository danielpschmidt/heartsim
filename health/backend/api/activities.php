<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/serialize.php';

$userId = require_health_consent();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

function ba_valid_date_str(string $s): bool
{
    $d = DateTime::createFromFormat('Y-m-d', $s);
    return $d && $d->format('Y-m-d') === $s;
}

if ($method === 'GET') {
    $date = isset($_GET['date']) ? (string) $_GET['date'] : date('Y-m-d');
    if (!ba_valid_date_str($date)) {
        json_error('validation_error', 'Ungültiges Datum.', 422);
    }

    $stmt = $pdo->prepare('SELECT * FROM activity_plans WHERE user_id = ? AND activity_date = ? ORDER BY id ASC');
    $stmt->execute([$userId, $date]);
    json_out(['activities' => array_map('public_activity', $stmt->fetchAll())]);
}

if ($method === 'POST') {
    require_csrf();
    rate_limit('activity_create', 60, 600);

    $body = json_body();
    $date = str_field($body, 'date', 10, false, date('Y-m-d'));
    if (!ba_valid_date_str($date)) {
        json_error('validation_error', 'Ungültiges Datum.', 422);
    }
    $title = str_field($body, 'title', 200, true);

    $difficulty = str_field($body, 'difficulty', 10, false, 'small');
    if (!in_array($difficulty, ['tiny', 'small', 'medium'], true)) {
        $difficulty = 'small';
    }

    $countStmt = $pdo->prepare('SELECT COUNT(*) c FROM activity_plans WHERE user_id = ? AND activity_date = ?');
    $countStmt->execute([$userId, $date]);
    if ((int) $countStmt->fetch()['c'] >= 10) {
        json_error('validation_error', 'Maximal 10 geplante Aktivitäten pro Tag.', 422);
    }

    $stmt = $pdo->prepare('INSERT INTO activity_plans (user_id, activity_date, title, difficulty) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $date, $title, $difficulty]);
    $id = (int) $pdo->lastInsertId();

    $stmt = $pdo->prepare('SELECT * FROM activity_plans WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    json_out(['activity' => public_activity($stmt->fetch())], 201);
}

if ($method === 'PUT') {
    require_csrf();

    $body = json_body();
    $id = isset($body['id']) ? (int) $body['id'] : 0;
    if ($id <= 0) {
        json_error('validation_error', 'Ungültige id.', 422);
    }

    $stmt = $pdo->prepare('SELECT * FROM activity_plans WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    if (!$stmt->fetch()) {
        json_error('not_found', 'Aktivität nicht gefunden.', 404);
    }

    $done = !empty($body['done']) ? 1 : 0;

    $masteryRating = null;
    $pleasureRating = null;
    if ($done) {
        if (isset($body['masteryRating']) && $body['masteryRating'] !== null) {
            $masteryRating = max(0, min(2, (int) $body['masteryRating']));
        }
        if (isset($body['pleasureRating']) && $body['pleasureRating'] !== null) {
            $pleasureRating = max(0, min(2, (int) $body['pleasureRating']));
        }
    }
    // Beim Zurücksetzen auf "nicht erledigt" werden die Bewertungen bewusst gelöscht,
    // damit sie nur zu tatsächlich abgeschlossenen Aktivitäten gehören.

    $upd = $pdo->prepare('UPDATE activity_plans SET done = ?, mastery_rating = ?, pleasure_rating = ? WHERE id = ? AND user_id = ?');
    $upd->execute([$done, $masteryRating, $pleasureRating, $id, $userId]);

    $stmt = $pdo->prepare('SELECT * FROM activity_plans WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    json_out(['activity' => public_activity($stmt->fetch())]);
}

if ($method === 'DELETE') {
    require_csrf();

    $body = json_body();
    $id = isset($body['id']) ? (int) $body['id'] : 0;
    if ($id <= 0) {
        json_error('validation_error', 'Ungültige id.', 422);
    }

    $stmt = $pdo->prepare('DELETE FROM activity_plans WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    json_out(['ok' => true]);
}

json_error('method_not_allowed', 'Nur GET/POST/PUT/DELETE erlaubt.', 405);
