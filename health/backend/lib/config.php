<?php
declare(strict_types=1);

function app_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $path = __DIR__ . '/../config.php';
    if (!file_exists($path)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'server_misconfigured',
            'message' => 'backend/config.php fehlt. Bitte backend/config.example.php kopieren und ausfüllen.',
        ]);
        exit;
    }

    $config = require $path;
    return $config;
}
