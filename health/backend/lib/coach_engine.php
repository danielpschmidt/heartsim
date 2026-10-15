<?php
declare(strict_types=1);

/**
 * Portierte Version der Client-seitigen Regel-Engine (Fallback, wenn kein
 * Gemini-API-Key hinterlegt ist). Läuft komplett serverseitig.
 */

function coach_initial_greeting(string $tendency, string $goal, string $firstName): array
{
    $base = "Hallo {$firstName}! Schön, dass du dir diesen Moment nimmst.";

    switch ($tendency) {
        case 'mania':
            return [
                'text' => "{$base}\n\n⚡ Dein System befindet sich im Beschleunigungsmodus. Ideen sprudeln und das Schlafbedürfnis sinkt – doch genau jetzt ist es wichtig, dich vor Erschöpfung und unüberlegten Impulsen zu schützen.\n\nDein gewähltes Ziel: **\"{$goal}\"**.\n\nWie sieht deine direkte Umgebung gerade aus? Gibt es laute Musik, helle Lichter oder offene Shopping-Tabs?",
                'suggestions' => [
                    'Hier läuft laute Musik & grelles Licht',
                    'Ich habe einen Impulskauf im Sinn',
                    'Lass uns die 4-7-8 Atemübung starten',
                    'Ich habe seit gestern kaum geschlafen',
                ],
            ];
        case 'depression':
            return [
                'text' => "{$base}\n\n🌧️ Dein System läuft auf äußerster Sparflamme. Jede Bewegung und Entscheidung fühlt sich bleischwer an. Wichtigste Regel für heute: **Du musst überhaupt nichts leisten.**\n\nFür dein Ziel: **\"{$goal}\"** arbeiten wir nur mit winzigen **1%-Mikroschritten**.\n\nWo bist du gerade? Liegst du im Bett oder auf dem Sofa?",
                'suggestions' => [
                    'Ich liege im Bett und komme nicht hoch',
                    'Ich mache mir Vorwürfe, nichts zu schaffen',
                    'Gib mir einen einfachen 2-Minuten-Schritt',
                    'Ich fühle mich innerlich taub',
                ],
            ];
        case 'mixed':
            return [
                'text' => "{$base}\n\n🌪️ Körperliche Getriebenheit gepaart mit innerer Zerrissenheit ist extrem kräfteraubend. Dein Körper will rennen, während dein Geist leidet.\n\nFür dein Ziel: **\"{$goal}\"** nutzen wir **körperliche Notbremsen (DBT-Skills)**, um den Alarmzustand deines Nervensystems zu dämpfen.\n\nMöchtest du die 5-Sinne-Erdung ausprobieren oder kurz kaltes Wasser an die Schläfen bringen?",
                'suggestions' => [
                    'Lass uns die 5-Sinne-Erdung machen',
                    'Ich habe riesige innere Unruhe & Frust',
                    'Wie funktioniert der Kälte-Skill?',
                    'Ich will mir einfach etwas von der Seele schreiben',
                ],
            ];
        default:
            return [
                'text' => "{$base}\n\n🌱 Dein Befinden wirkt im grünen Bereich. Eine stabile Phase ist der ideale Moment, um deine Routinen zu festigen und achtsam zu bleiben.\n\nFür dein Ziel: **\"{$goal}\"**: Was hat dir in den letzten Tagen besonders geholfen, deine Balance zu wahren?",
                'suggestions' => [
                    'Regelmäßige Schlafenszeiten einhalten',
                    'Kurze Atemübung zur Entspannung',
                    'Einfach kurz reflektieren',
                ],
            ];
    }
}

function coach_local_reply(string $tendency, string $input): array
{
    $text = mb_strtolower($input);

    $contains = static function (string $haystack, array $needles): bool {
        foreach ($needles as $n) {
            if (mb_strpos($haystack, $n) !== false) {
                return true;
            }
        }
        return false;
    };

    if ($contains($text, ['kauf', 'shopping', 'geld', 'bestell'])) {
        return [
            'text' => "🛑 **Hier greift sofort deine 48-Stunden-Kaufregel:**\n\n1. Schließe jetzt unverzüglich alle offenen Shopping-Tabs.\n2. Schreibe den Artikel mit Datum und Uhrzeit auf einen Zettel, statt ihn in den Warenkorb zu legen.\n3. Wenn du in genau 48 Stunden noch denselben Wunsch verspürst, prüfen wir das in Ruhe.\n\nKannst du dein Smartphone für die nächsten 20 Minuten weglegen?",
            'suggestions' => ['Ja, ich lege das Handy weg', 'Es fällt mir sehr schwer', 'Ich gehe kurz an die frische Luft'],
        ];
    }

    if ($contains($text, ['atem', '4-7-8', 'panik', 'druck'])) {
        return [
            'text' => "Ich habe dir die **4-7-8 Atemregulation** geöffnet. Atme sanft 4 Sekunden durch die Nase ein, halte 7 Sekunden und atme 8 Sekunden durch den Mund aus. Das senkt direkt deinen Puls.\n\nWie fühlt sich dein Brustkorb nach 3 Runden an?",
            'suggestions' => ['Etwas ruhiger geworden', 'Mein Kopf kreist noch immer', 'Ich brauche den Kälte-Skill'],
            'openBreathing' => true,
        ];
    }

    if ($contains($text, ['bett', 'lähm', 'komme nicht hoch', 'schwer'])) {
        return [
            'text' => "Dass du im Bett liegst, ist kein Versagen, sondern ein Schutzreflex deines Körpers vor Erschöpfung.\n\nUnser **1%-Mikroschritt** lautet:\n👉 **Bewege nur sanft deine Zehen und nimm zwei Schlucke Wasser**, falls etwas zu trinken in Reichweite steht.\n\nSchaffst du diese zwei Schlucke?",
            'suggestions' => ['Wasser getrunken', 'Ich schaffe nicht mal das', 'Meine Gedanken verurteilen mich'],
        ];
    }

    if ($contains($text, ['wut', 'unruhe', 'kälte', 'eis'])) {
        return [
            'text' => "Bei extremer Anspannung hilft der **DBT-Tauchreflex**:\n\nHalte deine Handgelenke für 30 Sekunden unter eiskaltes fließendes Wasser oder kühle dein Gesicht mit einem kalten Waschlappen. Das zwingt das vegetative Nervensystem sofort zur Beruhigung.\n\nGib mir kurz Rückmeldung, wenn du das Kaltwasser getestet hast.",
            'suggestions' => ['Kaltes Wasser hat geholfen', 'Ich brauche noch die 5-Sinne-Übung', 'Bin immer noch getrieben'],
        ];
    }

    switch ($tendency) {
        case 'mania':
            return [
                'text' => "In einer Beschleunigungsphase scheint alles extrem dringend. Genau hier liegt jedoch das Risiko der Überreizung.\n\nLass uns das Tempo halbieren: Dimme das Licht im Zimmer und mach dir ein beruhigendes Getränk (z. B. warmen Tee). Was kannst du jetzt sofort tun?",
                'suggestions' => ['Ich dimme das Licht', 'Ich mache mir einen Tee', 'Ich brauche eine Atemübung'],
            ];
        case 'depression':
            return [
                'text' => "Danke für deine Offenheit. Du musst heute niemanden beeindrucken. Wir nehmen jeden Leistungsdruck heraus.\n\nWollen wir gemeinsam eine Sache festlegen, die du heute ganz bewusst unerledigt liegen lassen darfst?",
                'suggestions' => ['Ich lasse die Arbeit liegen', 'Ich erlaube mir heute Pause', 'Hilf mir mich abzulenken'],
            ];
        case 'mixed':
            return [
                'text' => 'Ich verstehe die Zerrissenheit. Lass uns deinen Fokus auf die reale Umgebung lenken: Nenne mir 3 Gegenstände, die du gerade in deinem Raum sehen kannst.',
                'suggestions' => ['Lampe, Buch, Fenster', 'Ich spüre den harten Boden', 'Lass uns die 4-7-8 Atmung machen'],
            ];
        default:
            return [
                'text' => 'Ein sehr guter Gedanke. Konsistente Routinen sind das stabilste Fundament gegen künftige Schwankungen.\n\nWelche gesunde Gewohnheit möchtest du heute besonders pflegen?',
                'suggestions' => ['Feste Schlafenszeit heute', 'Ausgewogene Mahlzeit kochen', 'Spaziergang an der Luft'],
            ];
    }
}

/** Sehr simple Erkennung akuter Krisen-/Suizidsignale, um serverseitig auf SOS hinzuweisen. */
function coach_detect_crisis(string $input): bool
{
    $text = mb_strtolower($input);
    $markers = [
        'suizid', 'selbstmord', 'nicht mehr leben', 'umbringen', 'sterben will',
        'keinen sinn mehr', 'mir etwas antun', 'ritzen',
    ];
    foreach ($markers as $m) {
        if (mb_strpos($text, $m) !== false) {
            return true;
        }
    }
    return false;
}

function coach_call_gemini(string $apiKey, string $model, string $systemPrompt, array $historyMessages): array
{
    $contents = [];
    foreach (array_slice($historyMessages, -6) as $m) {
        $contents[] = [
            'role' => $m['sender'] === 'user' ? 'user' : 'model',
            'parts' => [['text' => $m['body']]],
        ];
    }

    $payload = [
        'contents' => $contents,
        'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
        'generationConfig' => ['responseMimeType' => 'application/json'],
    ];

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 20,
    ]);
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $curlErr !== '') {
        throw new RuntimeException('Gemini-Anfrage fehlgeschlagen: ' . $curlErr);
    }
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException("Gemini-API antwortete mit Status {$status}.");
    }

    $data = json_decode($raw, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
    if (!is_string($text)) {
        throw new RuntimeException('Unerwartetes Gemini-Antwortformat.');
    }

    $parsed = json_decode($text, true);
    if (!is_array($parsed)) {
        // Modell hat evtl. kein reines JSON geliefert - roh als reply verwenden.
        return ['text' => $text, 'suggestions' => []];
    }

    return [
        'text' => is_string($parsed['reply'] ?? null) ? $parsed['reply'] : 'Ich bin da. Lass uns gemeinsam den nächsten kleinen Schritt gehen.',
        'suggestions' => is_array($parsed['suggestions'] ?? null) ? array_values(array_filter($parsed['suggestions'], 'is_string')) : [],
    ];
}
