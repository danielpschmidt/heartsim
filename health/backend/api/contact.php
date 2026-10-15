<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('method_not_allowed', 'Nur POST erlaubt.', 405);
}
require_csrf();
rate_limit('contact', 3, 600);

$body = json_body();

// Honeypot: Bots füllen das versteckte Feld aus – so tun, als wäre alles ok.
if (trim((string) ($body['website'] ?? '')) !== '') {
    json_out(['ok' => true]);
}

$name = str_field($body, 'name', 120, true);
$email = mb_strtolower(str_field($body, 'email', 190, true));
$message = str_field($body, 'message', 4000, true);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error('validation_error', 'Ungültige E-Mail-Adresse.', 422);
}
if (mb_strlen($message) < 10) {
    json_error('validation_error', 'Die Nachricht ist zu kurz.', 422);
}

$stmt = db()->prepare('INSERT INTO contact_messages (user_id, name, email, message) VALUES (?, ?, ?, ?)');
$stmt->execute([current_user_id(), $name, $email, $message]);

// Optional zusätzlich per Mail benachrichtigen, falls in config.php hinterlegt.
$to = (string) (app_config()['contact_email'] ?? '');
if ($to !== '') {
    $safeName = preg_replace('/[\r\n]+/', ' ', $name);
    $subject = '=?UTF-8?B?' . base64_encode('AuraMind Kontaktanfrage von ' . $safeName) . '?=';
    $text = "Name: {$safeName}\nE-Mail: {$email}\n\n{$message}\n";
    $headers = [
        'Content-Type: text/plain; charset=UTF-8',
        'Reply-To: ' . $email,
    ];
    if (!@mail($to, $subject, $text, implode("\r\n", $headers))) {
        error_log('Kontaktformular: Mailversand fehlgeschlagen.');
    }
}

json_out(['ok' => true], 201);
