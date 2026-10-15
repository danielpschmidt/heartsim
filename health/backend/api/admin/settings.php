<?php
declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';

require_admin();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'GET') {
    $cfg = $pdo->query('SELECT gemini_api_key, gemini_model FROM admin_config WHERE id = 1')->fetch();
    $key = $cfg['gemini_api_key'] ?? '';
    $masked = $key !== '' ? (mb_substr($key, 0, 6) . str_repeat('•', 10) . mb_substr($key, -4)) : '';

    json_out([
        'hasApiKey' => $key !== '',
        'apiKeyMasked' => $masked,
        'model' => $cfg['gemini_model'] ?? 'gemini-2.5-flash',
    ]);
}

if ($method === 'POST') {
    require_csrf();
    $body = json_body();

    $updates = [];
    $params = [];

    if (array_key_exists('apiKey', $body)) {
        $apiKey = trim((string) $body['apiKey']);
        $updates[] = 'gemini_api_key = ?';
        $params[] = $apiKey !== '' ? $apiKey : null;
    }
    if (array_key_exists('model', $body)) {
        $model = trim((string) $body['model']);
        if ($model !== '') {
            $updates[] = 'gemini_model = ?';
            $params[] = mb_substr($model, 0, 100);
        }
    }
    if (array_key_exists('newPin', $body) && trim((string) $body['newPin']) !== '') {
        $newPin = trim((string) $body['newPin']);
        if (mb_strlen($newPin) < 6) {
            json_error('validation_error', 'Die neue Admin-PIN muss mindestens 6 Zeichen lang sein.', 422);
        }
        $updates[] = 'pin_hash = ?';
        $params[] = password_hash($newPin, PASSWORD_BCRYPT);
    }

    if (!empty($updates)) {
        $sql = 'UPDATE admin_config SET ' . implode(', ', $updates) . ' WHERE id = 1';
        $pdo->prepare($sql)->execute($params);

        $log = $pdo->prepare('INSERT INTO admin_audit_log (action, detail) VALUES (\'admin_config_update\', ?)');
        $log->execute([implode(',', array_keys($body))]);
    }

    json_out(['ok' => true]);
}

json_error('method_not_allowed', 'Nur GET/POST erlaubt.', 405);
