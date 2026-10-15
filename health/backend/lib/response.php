<?php
declare(strict_types=1);

function json_out(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $code, string $message, int $status = 400): void
{
    json_out(['error' => $code, 'message' => $message], $status);
}

function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_error('invalid_json', 'Der Request-Body ist kein gültiges JSON.', 400);
    }
    return $decoded;
}

/** Holt einen String-Wert, trimmt ihn und begrenzt die Länge. */
function str_field(array $body, string $key, int $maxLen = 500, bool $required = false, string $default = ''): string
{
    $val = isset($body[$key]) ? (string) $body[$key] : $default;
    $val = trim($val);
    if ($required && $val === '') {
        json_error('validation_error', "Feld \"$key\" ist erforderlich.", 422);
    }
    if (mb_strlen($val) > $maxLen) {
        $val = mb_substr($val, 0, $maxLen);
    }
    return $val;
}
