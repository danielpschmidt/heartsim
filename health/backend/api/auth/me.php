<?php
declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/serialize.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_error('method_not_allowed', 'Nur GET erlaubt.', 405);
}

$userId = current_user_id();
if ($userId === null) {
    json_out(['user' => null, 'isAdmin' => is_admin(), 'csrfToken' => csrf_token()]);
}

$stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    // Nutzer wurde gelöscht, Session ist verwaist.
    $_SESSION = [];
    session_destroy();
    json_out(['user' => null, 'isAdmin' => false, 'csrfToken' => csrf_token()]);
}

json_out([
    'user' => public_user($user),
    'isAdmin' => is_admin(),
    'impersonating' => !empty($_SESSION['admin_impersonating']),
    'csrfToken' => csrf_token(),
]);
