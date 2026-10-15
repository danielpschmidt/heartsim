<?php
declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/serialize.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('method_not_allowed', 'Nur POST erlaubt.', 405);
}
require_csrf();
rate_limit('login', 15, 300);

$body = json_body();
$email = mb_strtolower(str_field($body, 'email', 190, true));
$password = (string) ($body['password'] ?? '');

$pdo = db();
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

$genericError = static function () {
    json_error('invalid_credentials', 'Ungültige E-Mail-Adresse oder falsches Passwort.', 401);
};

if (!$user) {
    // Timing-Angriffe erschweren: trotzdem einen Hash-Vergleich durchführen.
    password_verify($password, '$2y$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    $genericError();
}

if (!empty($user['locked_until']) && strtotime($user['locked_until']) > time()) {
    json_error('account_locked', 'Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut.', 423);
}

if (!password_verify($password, $user['password_hash'])) {
    $failCount = (int) $user['failed_login_count'] + 1;
    $lockedUntil = null;
    if ($failCount >= 5) {
        $lockedUntil = date('Y-m-d H:i:s', time() + 900);
        $failCount = 0;
    }
    $upd = $pdo->prepare('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?');
    $upd->execute([$failCount, $lockedUntil, $user['id']]);
    $genericError();
}

$upd = $pdo->prepare('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?');
$upd->execute([$user['id']]);

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];
unset($_SESSION['is_admin'], $_SESSION['admin_impersonating'], $_SESSION['health_consent']);

json_out(['user' => public_user($user)]);
