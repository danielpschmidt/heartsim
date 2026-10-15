<?php
declare(strict_types=1);

require_once __DIR__ . '/../../lib/bootstrap.php';
require_once __DIR__ . '/../../lib/serialize.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('method_not_allowed', 'Nur POST erlaubt.', 405);
}
require_csrf();
rate_limit('register', 10, 600);

$body = json_body();
$name = str_field($body, 'name', 120, true);
$email = mb_strtolower(str_field($body, 'email', 190, true));
$password = (string) ($body['password'] ?? '');
$age = isset($body['age']) && $body['age'] !== '' ? (int) $body['age'] : null;
$civilStatus = str_field($body, 'civilStatus', 60, false, 'Ledig');
$location = str_field($body, 'location', 150, false, 'Nicht angegeben');

if (($body['healthConsent'] ?? false) !== true) {
    json_error('consent_required', 'Bitte bestätige die Einwilligung zur Bearbeitung deiner Gesundheitsdaten.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error('validation_error', 'Ungültige E-Mail-Adresse.', 422);
}
if (mb_strlen($password) < 8) {
    json_error('validation_error', 'Das Passwort muss mindestens 8 Zeichen lang sein.', 422);
}
if ($age !== null && ($age < 14 || $age > 120)) {
    json_error('validation_error', 'Ungültiges Alter.', 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    json_error('email_taken', 'Diese E-Mail ist bereits registriert.', 409);
}

$id = uuid_v4();
$hash = password_hash($password, PASSWORD_BCRYPT);

$stmt = $pdo->prepare(
    'INSERT INTO users (id, email, password_hash, name, age, civil_status, location, emergency_contact, notes, health_consent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, \'\', \'\', NOW())'
);
$stmt->execute([$id, $email, $hash, $name, $age, $civilStatus, $location]);

session_regenerate_id(true);
$_SESSION['user_id'] = $id;
$_SESSION['health_consent'] = true;

$stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$id]);
$user = $stmt->fetch();

json_out(['user' => public_user($user)], 201);
