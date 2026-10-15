<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/serialize.php';
require_once __DIR__ . '/../lib/coach_engine.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('method_not_allowed', 'Nur POST erlaubt.', 405);
}
require_csrf();

$userId = require_health_consent();
rate_limit('chat', 60, 60);

$body = json_body();
$sessionId = str_field($body, 'sessionId', 36, true);
$text = str_field($body, 'text', 2000, true);

$pdo = db();

$stmt = $pdo->prepare('SELECT * FROM coaching_sessions WHERE id = ? AND user_id = ?');
$stmt->execute([$sessionId, $userId]);
$session = $stmt->fetch();
if (!$session) {
    json_error('not_found', 'Sitzung nicht gefunden.', 404);
}

// Nutzer-Nachricht speichern
$stmt = $pdo->prepare('INSERT INTO coaching_messages (session_id, sender, body) VALUES (?, \'user\', ?)');
$stmt->execute([$sessionId, $text]);

$stmt = $pdo->prepare('SELECT * FROM coaching_messages WHERE session_id = ? ORDER BY id ASC');
$stmt->execute([$sessionId]);
$history = $stmt->fetchAll();

$userStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
$userStmt->execute([$userId]);
$user = $userStmt->fetch();

$cfgStmt = $pdo->query('SELECT * FROM admin_config WHERE id = 1');
$adminConfig = $cfgStmt->fetch();

$usedGemini = false;
$reply = null;
$suggestions = [];
$notice = null;
$openBreathing = false;

if (!empty($adminConfig['gemini_api_key'])) {
    $systemPrompt = "Du bist AuraMind, ein empathischer, traumainformierter und verhaltenstherapeutisch geschulter Mental-Health-Coach für Menschen mit extremen Stimmungsschwankungen (Hypomanie, Manie, bipolare Depression, Mischzustände).
Klientendaten (bewusst ohne Name und Zivilstand – sprich die Person nicht mit Namen an):
- Alter: " . ($user['age'] ?? 'Nicht angegeben') . "
- Wohnort: {$user['location']}
- Erkannte Tendenz dieser Sitzung: {$session['tendency']}
- Gewähltes Stabilisierungsziel: {$session['goal']}
- Vom Klienten selbst hinterlegte persönliche Trigger/Frühwarnzeichen: " . ($user['notes'] !== '' ? $user['notes'] : 'Keine Angabe') . "

Wichtige Regeln:
1. Validiere Gefühle warmherzig, ohne zu pathologisieren.
2. Bei Manie: Tempo drosseln, 48h-Kaufstopps durchsetzen, Reize abschalten, Schlaf verteidigen.
3. Bei Depression: Radikale 1%-Mikroschritte, Schuldgefühle nehmen, keine Überforderung.
   Berücksichtige die hinterlegten persönlichen Trigger/Frühwarnzeichen aktiv in deiner Antwort, falls vorhanden.
4. Bei Mischzuständen: Kältereize (DBT Tauchreflex), 5-Sinne-Erdung, Deeskalation.
5. Halte Antworten prägnant (maximal 2-3 kurze Absätze).
6. Antworte ausschließlich als valides JSON mit den Schlüsseln: \"reply\" (String) und \"suggestions\" (Array von 2-4 kurzen Kurzantworten für den Klienten).";

    // Name nicht an die KI geben: Die Begrüssung (und ggf. Nutzertexte) enthalten den Vornamen.
    $nameParts = array_filter(
        preg_split('/\s+/u', trim((string) $user['name'])) ?: [],
        static fn ($p) => mb_strlen($p) >= 2
    );
    $maskedHistory = array_map(static function (array $m) use ($nameParts): array {
        foreach ($nameParts as $part) {
            $m['body'] = preg_replace('/(?<!\pL)' . preg_quote($part, '/') . '(?!\pL)/iu', '[Name]', $m['body']) ?? $m['body'];
        }
        return $m;
    }, $history);

    try {
        $result = coach_call_gemini(
            $adminConfig['gemini_api_key'],
            $adminConfig['gemini_model'] ?: 'gemini-2.5-flash',
            $systemPrompt,
            $maskedHistory
        );
        $reply = $result['text'];
        $suggestions = $result['suggestions'];
        $usedGemini = true;
    } catch (Throwable $e) {
        error_log('Gemini call failed: ' . $e->getMessage());
        $fallback = coach_local_reply($session['tendency'], $text);
        $reply = "*(Lokaler Coach-Modus – KI vorübergehend nicht erreichbar)*\n\n" . $fallback['text'];
        $suggestions = $fallback['suggestions'];
        $openBreathing = !empty($fallback['openBreathing']);
    }
} else {
    $fallback = coach_local_reply($session['tendency'], $text);
    $reply = $fallback['text'];
    $suggestions = $fallback['suggestions'];
    $openBreathing = !empty($fallback['openBreathing']);
}

if (coach_detect_crisis($text)) {
    $notice = 'crisis_keywords_detected';
}

$stmt = $pdo->prepare('INSERT INTO coaching_messages (session_id, sender, body) VALUES (?, \'assistant\', ?)');
$stmt->execute([$sessionId, $reply]);

json_out([
    'reply' => $reply,
    'suggestions' => $suggestions,
    'usedGemini' => $usedGemini,
    'notice' => $notice,
    'openBreathing' => $openBreathing,
]);
