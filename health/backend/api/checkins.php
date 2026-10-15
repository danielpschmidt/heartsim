<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/serialize.php';

$userId = require_health_consent();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

function valid_date_str(string $s): bool
{
    $d = DateTime::createFromFormat('Y-m-d', $s);
    return $d && $d->format('Y-m-d') === $s;
}

function valid_time_str(string $s): bool
{
    return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $s);
}

/** Minuten seit Mitternacht, für Rhythmus-Berechnungen. */
function time_to_minutes(string $t): int
{
    $parts = explode(':', $t);
    return ((int) $parts[0]) * 60 + ((int) $parts[1]);
}

function stddev(array $values): float
{
    $n = count($values);
    if ($n < 2) return 0.0;
    $mean = array_sum($values) / $n;
    $variance = array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $values)) / $n;
    return sqrt($variance);
}

if ($method === 'GET') {
    $days = isset($_GET['days']) ? max(7, min(90, (int) $_GET['days'])) : 30;

    $stmt = $pdo->prepare(
        'SELECT * FROM daily_checkins WHERE user_id = ? AND checkin_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY checkin_date ASC'
    );
    $stmt->execute([$userId, $days]);
    $rows = $stmt->fetchAll();

    // Frühwarn-Heuristiken (transparent & nachvollziehbar, kein Black-Box-ML)
    $lowSleepStreak = 0;
    for ($i = count($rows) - 1; $i >= 0; $i--) {
        $sh = $rows[$i]['sleep_hours'];
        if ($sh !== null && (float) $sh < 5.0) {
            $lowSleepStreak++;
        } else {
            break;
        }
    }

    $wakeMinutes = [];
    foreach ($rows as $r) {
        if (!empty($r['wake_time'])) {
            $wakeMinutes[] = time_to_minutes($r['wake_time']);
        }
    }
    $wakeVarianceMinutes = count($wakeMinutes) >= 4 ? round(stddev($wakeMinutes), 1) : null;
    $irregularWakeTimes = $wakeVarianceMinutes !== null && $wakeVarianceMinutes > 90;

    json_out([
        'checkins' => array_map('public_checkin', $rows),
        'flags' => [
            'lowSleepStreak' => $lowSleepStreak,
            'lowSleepWarning' => $lowSleepStreak >= 3,
            'wakeVarianceMinutes' => $wakeVarianceMinutes,
            'irregularWakeTimes' => $irregularWakeTimes,
        ],
    ]);
}

if ($method === 'POST') {
    require_csrf();
    rate_limit('checkin_save', 60, 600);

    $body = json_body();
    $date = str_field($body, 'date', 10, false, date('Y-m-d'));
    if (!valid_date_str($date)) {
        json_error('validation_error', 'Ungültiges Datum.', 422);
    }
    if ($date > date('Y-m-d')) {
        json_error('validation_error', 'Datum darf nicht in der Zukunft liegen.', 422);
    }
    if ($date < date('Y-m-d', strtotime('-90 days'))) {
        json_error('validation_error', 'Einträge können höchstens 90 Tage rückwirkend erfasst werden.', 422);
    }

    $moodScore = isset($body['moodScore']) ? (int) $body['moodScore'] : null;
    if ($moodScore === null || $moodScore < -5 || $moodScore > 5) {
        json_error('validation_error', 'moodScore muss zwischen -5 und 5 liegen.', 422);
    }

    $sleepHours = null;
    if (isset($body['sleepHours']) && $body['sleepHours'] !== '' && $body['sleepHours'] !== null) {
        $sleepHours = round((float) $body['sleepHours'], 1);
        if ($sleepHours < 0 || $sleepHours > 24) {
            json_error('validation_error', 'sleepHours muss zwischen 0 und 24 liegen.', 422);
        }
    }

    $wakeTime = null;
    if (!empty($body['wakeTime'])) {
        $wakeTime = (string) $body['wakeTime'];
        if (!valid_time_str($wakeTime)) {
            json_error('validation_error', 'Ungültige Aufstehzeit (HH:MM erwartet).', 422);
        }
    }

    $medicationTaken = array_key_exists('medicationTaken', $body) && $body['medicationTaken'] !== null
        ? (int) (bool) $body['medicationTaken']
        : null;

    $irritability = isset($body['irritability']) ? (int) $body['irritability'] : 0;
    if ($irritability < 0 || $irritability > 3) {
        json_error('validation_error', 'irritability muss zwischen 0 und 3 liegen.', 422);
    }

    $socialContact = !empty($body['socialContact']) ? 1 : 0;
    $note = str_field($body, 'note', 500);

    $stmt = $pdo->prepare(
        'INSERT INTO daily_checkins
            (user_id, checkin_date, mood_score, sleep_hours, wake_time, medication_taken, irritability, social_contact, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            mood_score = VALUES(mood_score),
            sleep_hours = VALUES(sleep_hours),
            wake_time = VALUES(wake_time),
            medication_taken = VALUES(medication_taken),
            irritability = VALUES(irritability),
            social_contact = VALUES(social_contact),
            note = VALUES(note)'
    );
    $stmt->execute([
        $userId, $date, $moodScore, $sleepHours, $wakeTime,
        $medicationTaken, $irritability, $socialContact, $note,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM daily_checkins WHERE user_id = ? AND checkin_date = ?');
    $stmt->execute([$userId, $date]);
    json_out(['checkin' => public_checkin($stmt->fetch())], 201);
}

json_error('method_not_allowed', 'Nur GET/POST erlaubt.', 405);
