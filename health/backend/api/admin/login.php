<?php
declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('method_not_allowed', 'Nur POST erlaubt.', 405);
}
require_csrf();
rate_limit('admin_login', 10, 300);

$body = json_body();
$pin = (string) ($body['pin'] ?? '');

$pdo = db();
$cfg = $pdo->query('SELECT * FROM admin_config WHERE id = 1')->fetch();

if (!$cfg) {
    json_error('server_error', 'Admin-Konfiguration fehlt.', 500);
}

if (!empty($cfg['locked_until']) && strtotime($cfg['locked_until']) > time()) {
    json_error('account_locked', 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.', 423);
}

if (!password_verify($pin, $cfg['pin_hash'])) {
    $failCount = (int) $cfg['failed_login_count'] + 1;
    $lockedUntil = null;
    if ($failCount >= 5) {
        $lockedUntil = date('Y-m-d H:i:s', time() + 900);
        $failCount = 0;
    }
    $upd = $pdo->prepare('UPDATE admin_config SET failed_login_count = ?, locked_until = ? WHERE id = 1');
    $upd->execute([$failCount, $lockedUntil]);
    json_error('invalid_pin', 'Falsche Admin-PIN.', 401);
}

$upd = $pdo->prepare('UPDATE admin_config SET failed_login_count = 0, locked_until = NULL WHERE id = 1');
$upd->execute();

$_SESSION['is_admin'] = true;
$log = $pdo->prepare('INSERT INTO admin_audit_log (action, detail) VALUES (\'admin_login\', NULL)');
$log->execute();

json_out(['ok' => true]);
