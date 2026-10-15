<?php
declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';

require_admin();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'GET') {
    $rows = $pdo->query(
        'SELECT u.id, u.name, u.age, u.civil_status, u.location,
                (SELECT COUNT(*) FROM coaching_sessions s WHERE s.user_id = u.id) AS session_count
         FROM users u ORDER BY u.created_at DESC'
    )->fetchAll();

    $out = array_map(static fn ($r) => [
        'id' => $r['id'],
        'name' => $r['name'],
        'age' => $r['age'] !== null ? (int) $r['age'] : null,
        'civilStatus' => $r['civil_status'],
        'location' => $r['location'],
        'sessionCount' => (int) $r['session_count'],
    ], $rows);

    json_out(['users' => $out]);
}

if ($method === 'DELETE') {
    require_csrf();
    $body = json_body();
    $id = str_field($body, 'id', 36, true);
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
        json_error('validation_error', 'Ungültige Nutzer-ID.', 422);
    }

    // Sitzungen, Chatverläufe, Check-ins, Aktivitäten und Sicherheitsplan werden
    // per ON DELETE CASCADE mitgelöscht. Kontaktanfragen haben keinen Fremdschlüssel.
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM contact_messages WHERE user_id = ?')->execute([$id]);
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            json_error('not_found', 'Nutzer nicht gefunden.', 404);
        }
        $pdo->prepare('INSERT INTO admin_audit_log (action, detail) VALUES (\'admin_user_delete\', ?)')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    json_out(['ok' => true]);
}

json_error('method_not_allowed', 'Nur GET/DELETE erlaubt.', 405);
