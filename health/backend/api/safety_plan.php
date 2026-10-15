<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/serialize.php';

$userId = require_health_consent();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT * FROM safety_plans WHERE user_id = ?');
    $stmt->execute([$userId]);
    json_out(['plan' => public_safety_plan($stmt->fetch() ?: null)]);
}

if ($method === 'PUT') {
    require_csrf();
    $body = json_body();

    $warningSigns = str_field($body, 'warningSigns', 2000);
    $internalCoping = str_field($body, 'internalCoping', 2000);
    $socialDistractions = str_field($body, 'socialDistractions', 2000);
    $peopleToAsk = str_field($body, 'peopleToAsk', 2000);
    $professionalContacts = str_field($body, 'professionalContacts', 2000);
    $safeEnvironment = str_field($body, 'safeEnvironment', 2000);

    $stmt = $pdo->prepare(
        'INSERT INTO safety_plans
            (user_id, warning_signs, internal_coping, social_distractions, people_to_ask, professional_contacts, safe_environment)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            warning_signs = VALUES(warning_signs),
            internal_coping = VALUES(internal_coping),
            social_distractions = VALUES(social_distractions),
            people_to_ask = VALUES(people_to_ask),
            professional_contacts = VALUES(professional_contacts),
            safe_environment = VALUES(safe_environment)'
    );
    $stmt->execute([
        $userId, $warningSigns, $internalCoping, $socialDistractions,
        $peopleToAsk, $professionalContacts, $safeEnvironment,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM safety_plans WHERE user_id = ?');
    $stmt->execute([$userId]);
    json_out(['plan' => public_safety_plan($stmt->fetch() ?: null)]);
}

json_error('method_not_allowed', 'Nur GET/PUT erlaubt.', 405);
