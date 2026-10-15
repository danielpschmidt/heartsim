<?php
/**
 * Kopiere diese Datei nach config.php und trage deine echten Zugangsdaten ein.
 * config.php darf NIE ins Git-Repo oder öffentlich erreichbar sein
 * (liegt aber ohnehin außerhalb des über HTTP erreichbaren "public"-Ordners,
 * sofern du die Verzeichnisstruktur wie empfohlen aufsetzt).
 */

return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => null, // z.B. 3306; leer lassen, wenn der Standardport genutzt wird
        'name' => 'auramind',
        'user' => 'auramind_user',
        'pass' => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],

    // Zufälliger, langer, geheimer String – z.B. mit: php -r "echo bin2hex(random_bytes(32));"
    'app_key' => 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET',

    // true, wenn die Seite ausschliesslich über HTTPS läuft (empfohlen für Produktion).
    'force_https_cookies' => true,

    // Optional: Empfänger-Adresse für Kontaktformular-Benachrichtigungen (leer = nur in DB speichern).
    'contact_email' => '',

    // Erlaubte Origins für CORS, falls Frontend und Backend auf unterschiedlichen
    // Domains/Subdomains laufen (z.B. während lokaler Entwicklung mit Vite).
    // Bei Deployment auf derselben Domain (empfohlen) kann die Liste leer bleiben.
    'cors_allowed_origins' => [
        'http://localhost:5173',
    ],
];
