<?php
declare(strict_types=1);

/** Gibt niemals password_hash o.ä. nach außen. */
function public_user(array $row): array
{
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'name' => $row['name'],
        'age' => $row['age'] !== null ? (int) $row['age'] : null,
        'civilStatus' => $row['civil_status'],
        'location' => $row['location'],
        'emergencyContact' => $row['emergency_contact'],
        'notes' => $row['notes'],
        'healthConsent' => !empty($row['health_consent_at']),
    ];
}

function public_message(array $row): array
{
    return [
        'sender' => $row['sender'],
        'text' => $row['body'],
    ];
}

function public_session(array $row, array $messages): array
{
    return [
        'id' => $row['id'],
        'date' => $row['created_at'],
        'tendency' => $row['tendency'],
        'title' => $row['title'],
        'goal' => $row['goal'],
        'messages' => array_map('public_message', $messages),
    ];
}

function public_safety_plan(?array $row): array
{
    if (!$row) {
        return [
            'exists' => false,
            'warningSigns' => '',
            'internalCoping' => '',
            'socialDistractions' => '',
            'peopleToAsk' => '',
            'professionalContacts' => '',
            'safeEnvironment' => '',
            'updatedAt' => null,
        ];
    }
    return [
        'exists' => true,
        'warningSigns' => $row['warning_signs'] ?? '',
        'internalCoping' => $row['internal_coping'] ?? '',
        'socialDistractions' => $row['social_distractions'] ?? '',
        'peopleToAsk' => $row['people_to_ask'] ?? '',
        'professionalContacts' => $row['professional_contacts'] ?? '',
        'safeEnvironment' => $row['safe_environment'] ?? '',
        'updatedAt' => $row['updated_at'],
    ];
}

function public_checkin(array $row): array
{
    return [
        'date' => $row['checkin_date'],
        'moodScore' => (int) $row['mood_score'],
        'sleepHours' => $row['sleep_hours'] !== null ? (float) $row['sleep_hours'] : null,
        'wakeTime' => $row['wake_time'],
        'medicationTaken' => $row['medication_taken'] !== null ? (bool) $row['medication_taken'] : null,
        'irritability' => (int) $row['irritability'],
        'socialContact' => (bool) $row['social_contact'],
        'note' => $row['note'],
    ];
}

function public_activity(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'date' => $row['activity_date'],
        'title' => $row['title'],
        'difficulty' => $row['difficulty'] ?? 'small',
        'done' => (bool) $row['done'],
        'masteryRating' => $row['mastery_rating'] !== null ? (int) $row['mastery_rating'] : null,
        'pleasureRating' => $row['pleasure_rating'] !== null ? (int) $row['pleasure_rating'] : null,
    ];
}
