<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/serialize.php';

$userId = require_login();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$pdo = db();

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    json_out(['user' => public_user($user)]);
}

if ($method === 'PUT') {
    require_csrf();
    $body = json_body();

    $name = str_field($body, 'name', 120, true);
    $civilStatus = str_field($body, 'civilStatus', 60);
    $location = str_field($body, 'location', 150);
    $emergencyContact = str_field($body, 'emergencyContact', 255);
    $notes = str_field($body, 'notes', 2000);
    $age = isset($body['age']) && $body['age'] !== '' && $body['age'] !== null ? (int) $body['age'] : null;
    if ($age !== null && ($age < 14 || $age > 120)) {
        json_error('validation_error', 'Ungültiges Alter.', 422);
    }

    $stmt = $pdo->prepare(
        'UPDATE users SET name = ?, age = ?, civil_status = ?, location = ?, emergency_contact = ?, notes = ? WHERE id = ?'
    );
    $stmt->execute([$name, $age, $civilStatus, $location, $emergencyContact, $notes, $userId]);

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    json_out(['user' => public_user($stmt->fetch())]);
}

json_error('method_not_allowed', 'Nur GET/PUT erlaubt.', 405);
