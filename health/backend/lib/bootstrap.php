<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/db.php';

$cfg = app_config();

// --- CORS (nur relevant, wenn Frontend & Backend auf unterschiedlichen Origins laufen) ---
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $cfg['cors_allowed_origins'] ?? [], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Session-Cookie hart absichern ---
$secure = (bool) ($cfg['force_https_cookies'] ?? true);
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_name('auramind_sid');
session_start();

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function csrf_token(): string
{
    return $_SESSION['csrf_token'];
}

function require_csrf(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return;
    }
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($sent === '' || !hash_equals($_SESSION['csrf_token'], $sent)) {
        json_error('csrf_invalid', 'Ungültiges oder fehlendes CSRF-Token.', 403);
    }
}

function current_user_id(): ?string
{
    return $_SESSION['user_id'] ?? null;
}

function require_login(): string
{
    $id = current_user_id();
    if ($id === null) {
        json_error('unauthenticated', 'Bitte melde dich zuerst an.', 401);
    }
    return $id;
}

/**
 * Wie require_login(), verlangt aber zusätzlich die ausdrückliche Einwilligung in die
 * Bearbeitung von Gesundheitsdaten (Art. 9 Abs. 2 lit. a DSGVO, Art. 6 Abs. 7 DSG).
 */
function require_health_consent(): string
{
    $id = require_login();
    if (empty($_SESSION['health_consent'])) {
        $stmt = db()->prepare('SELECT health_consent_at FROM users WHERE id = ?');
        $stmt->execute([$id]);
        if (empty($stmt->fetchColumn())) {
            json_error('consent_required', 'Bitte bestätige zuerst die Einwilligung zur Bearbeitung deiner Gesundheitsdaten.', 403);
        }
        $_SESSION['health_consent'] = true;
    }
    return $id;
}

function is_admin(): bool
{
    return !empty($_SESSION['is_admin']);
}

function require_admin(): void
{
    if (!is_admin()) {
        json_error('forbidden', 'Admin-Zugang erforderlich.', 403);
    }
}

/** Sehr einfaches Rate-Limiting pro Session+Aktion (schützt gegen naive Brute-Force-Skripte). */
function rate_limit(string $key, int $maxAttempts, int $windowSeconds): void
{
    $bucket = '_rl_' . $key;
    $now = time();
    $entry = $_SESSION[$bucket] ?? ['count' => 0, 'reset' => $now + $windowSeconds];
    if ($now > $entry['reset']) {
        $entry = ['count' => 0, 'reset' => $now + $windowSeconds];
    }
    $entry['count']++;
    $_SESSION[$bucket] = $entry;
    if ($entry['count'] > $maxAttempts) {
        json_error('rate_limited', 'Zu viele Versuche. Bitte kurz warten.', 429);
    }
}
