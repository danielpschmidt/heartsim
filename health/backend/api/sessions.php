<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/serialize.php';
require_once __DIR__ . '/../lib/coach_engine.php';

$userId = require_health_consent();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

$allowedTendencies = ['mania', 'depression', 'mixed', 'balanced'];

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT * FROM coaching_sessions WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$userId]);
    $sessions = $stmt->fetchAll();

    $msgStmt = $pdo->prepare('SELECT * FROM coaching_messages WHERE session_id = ? ORDER BY id ASC');

    $out = [];
    foreach ($sessions as $s) {
        $msgStmt->execute([$s['id']]);
        $out[] = public_session($s, $msgStmt->fetchAll());
    }

    json_out(['sessions' => $out]);
}

if ($method === 'POST') {
    require_csrf();
    rate_limit('session_create', 30, 600);

    $body = json_body();
    $tendency = str_field($body, 'tendency', 20, true);
    $title = str_field($body, 'title', 150, true);
    $goal = str_field($body, 'goal', 255, true);

    if (!in_array($tendency, $allowedTendencies, true)) {
        json_error('validation_error', 'Ungültige Tendenz.', 422);
    }

    $userStmt = $pdo->prepare('SELECT name FROM users WHERE id = ?');
    $userStmt->execute([$userId]);
    $userRow = $userStmt->fetch();
    $firstName = $userRow ? explode(' ', trim($userRow['name']))[0] : '';

    $greeting = coach_initial_greeting($tendency, $goal, $firstName);

    $sessionId = uuid_v4();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO coaching_sessions (id, user_id, tendency, title, goal) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$sessionId, $userId, $tendency, $title, $goal]);

        $stmt = $pdo->prepare(
            'INSERT INTO coaching_messages (session_id, sender, body) VALUES (?, \'assistant\', ?)'
        );
        $stmt->execute([$sessionId, $greeting['text']]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('session create failed: ' . $e->getMessage());
        json_error('server_error', 'Sitzung konnte nicht erstellt werden.', 500);
    }

    $stmt = $pdo->prepare('SELECT * FROM coaching_sessions WHERE id = ?');
    $stmt->execute([$sessionId]);
    $sessionRow = $stmt->fetch();

    $stmt = $pdo->prepare('SELECT * FROM coaching_messages WHERE session_id = ? ORDER BY id ASC');
    $stmt->execute([$sessionId]);
    $messages = $stmt->fetchAll();

    json_out([
        'session' => public_session($sessionRow, $messages),
        'suggestions' => $greeting['suggestions'],
    ], 201);
}

if ($method === 'PUT') {
    // Coaching-Einstellung (Tendenz + Ziel) einer bestehenden Sitzung ändern.
    require_csrf();
    rate_limit('session_update', 30, 600);

    $body = json_body();
    $sessionId = str_field($body, 'id', 36, true);
    $tendency = str_field($body, 'tendency', 20, true);
    $title = str_field($body, 'title', 150, true);
    $goal = str_field($body, 'goal', 255, true);

    if (!in_array($tendency, $allowedTendencies, true)) {
        json_error('validation_error', 'Ungültige Tendenz.', 422);
    }

    $stmt = $pdo->prepare('UPDATE coaching_sessions SET tendency = ?, title = ?, goal = ? WHERE id = ? AND user_id = ?');
    $stmt->execute([$tendency, $title, $goal, $sessionId, $userId]);

    $stmt = $pdo->prepare('SELECT * FROM coaching_sessions WHERE id = ? AND user_id = ?');
    $stmt->execute([$sessionId, $userId]);
    $sessionRow = $stmt->fetch();
    if (!$sessionRow) {
        json_error('not_found', 'Sitzung nicht gefunden.', 404);
    }

    $stmt = $pdo->prepare('SELECT * FROM coaching_messages WHERE session_id = ? ORDER BY id ASC');
    $stmt->execute([$sessionId]);

    json_out(['session' => public_session($sessionRow, $stmt->fetchAll())]);
}

json_error('method_not_allowed', 'Nur GET/POST/PUT erlaubt.', 405);
