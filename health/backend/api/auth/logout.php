<?php
declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('method_not_allowed', 'Nur POST erlaubt.', 405);
}
require_csrf();

$_SESSION = [];
session_destroy();

json_out(['ok' => true]);
