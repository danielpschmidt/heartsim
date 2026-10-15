<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/serialize.php';

$userId = require_login();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$pdo = db();

// Einwilligung zur Bearbeitung von Gesundheitsdaten nachträglich erteilen
// (für Konten, die vor Einführung der Einwilligung angelegt wurden).
if ($method === 'POST') {
    require_csrf();
    $body = json_body();
    if (($body['healthConsent'] ?? false) !== true) {
        json_error('consent_required', 'Bitte bestätige die Einwilligung.', 422);
    }
    $pdo->prepare('UPDATE users SET health_consent_at = NOW() WHERE id = ?')->execute([$userId]);
    $_SESSION['health_consent'] = true;

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    json_out(['user' => public_user($stmt->fetch())]);
}

// Konto inkl. aller Daten selbst endgültig löschen (Art. 17 DSGVO, Art. 32 DSG).
if ($method === 'DELETE') {
    require_csrf();
    rate_limit('account_delete', 5, 600);
    if (!empty($_SESSION['admin_impersonating'])) {
        json_error('forbidden', 'Im Admin-Modus bitte die Nutzerverwaltung verwenden.', 403);
    }

    $body = json_body();
    $password = (string) ($body['password'] ?? '');

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $hash = $stmt->fetchColumn();
    if ($hash === false || !password_verify($password, (string) $hash)) {
        json_error('invalid_password', 'Das Passwort ist nicht korrekt.', 403);
    }

    // Sitzungen, Chatverläufe, Check-ins, Aktivitäten und Sicherheitsplan werden
    // per ON DELETE CASCADE mitgelöscht. Kontaktanfragen haben keinen Fremdschlüssel.
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM contact_messages WHERE user_id = ?')->execute([$userId]);
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $_SESSION = [];
    session_destroy();

    json_out(['ok' => true]);
}

json_error('method_not_allowed', 'Nur POST/DELETE erlaubt.', 405);
