-- AuraMind Datenbankschema (MySQL / MariaDB)
-- Einspielen z.B. via phpMyAdmin oder: mysql -u USER -p DBNAME < schema.sql

CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(120) NOT NULL,
    age INT NULL,
    civil_status VARCHAR(60) NULL,
    location VARCHAR(150) NULL,
    emergency_contact VARCHAR(255) NULL,
    notes TEXT NULL,
    health_consent_at DATETIME NULL,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coaching_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    tendency VARCHAR(20) NOT NULL,
    title VARCHAR(150) NOT NULL,
    goal VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_user (user_id),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coaching_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    sender ENUM('user','assistant') NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_session (session_id),
    CONSTRAINT fk_messages_session FOREIGN KEY (session_id) REFERENCES coaching_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Es gibt genau eine Konfigurationszeile (id=1).
CREATE TABLE IF NOT EXISTS admin_config (
    id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
    pin_hash VARCHAR(255) NOT NULL,
    gemini_api_key VARCHAR(255) NULL,
    gemini_model VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash',
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sicherheitsplan nach dem Stanley-Brown-Modell (Safety Planning Intervention).
-- Genau ein Plan pro Nutzer, den dieser selbst in stabilen Phasen ausfüllt.
CREATE TABLE IF NOT EXISTS safety_plans (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    warning_signs TEXT NULL,
    internal_coping TEXT NULL,
    social_distractions TEXT NULL,
    people_to_ask TEXT NULL,
    professional_contacts TEXT NULL,
    safe_environment TEXT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_safety_plan_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tägliches Life-Charting (NIMH-Methode) + Social-Rhythm-Daten.
CREATE TABLE IF NOT EXISTS daily_checkins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    checkin_date DATE NOT NULL,
    mood_score TINYINT NOT NULL,
    sleep_hours DECIMAL(3,1) NULL,
    wake_time TIME NULL,
    medication_taken TINYINT(1) NULL,
    irritability TINYINT NOT NULL DEFAULT 0,
    social_contact TINYINT(1) NOT NULL DEFAULT 0,
    note VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_date (user_id, checkin_date),
    CONSTRAINT fk_checkin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Behavioral Activation: kleine, im Voraus geplante Tagesaktivitäten gegen depressive Lähmung.
-- mastery_rating/pleasure_rating (0-2) werden erst nach Erledigung gesetzt und sind
-- der eigentliche Kern der Methode: Handeln erzeugt nachweisbar Erfolgs-/Freudegefühl,
-- auch wenn vorher keine Motivation da war.
CREATE TABLE IF NOT EXISTS activity_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    activity_date DATE NOT NULL,
    title VARCHAR(200) NOT NULL,
    difficulty ENUM('tiny','small','medium') NOT NULL DEFAULT 'small',
    done TINYINT(1) NOT NULL DEFAULT 0,
    mastery_rating TINYINT NULL,
    pleasure_rating TINYINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_user_date (user_id, activity_date),
    CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    detail VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default Admin-PIN ist "admin2026" (bcrypt-Hash). BITTE NACH DEM ERSTEN LOGIN AENDERN!
INSERT INTO admin_config (id, pin_hash, gemini_api_key, gemini_model)
VALUES (1, '$2y$12$gQt4BH2NZKFx3A.3fjiununn9hWzfk.uGaA56Pw5IE.ZOZRPStRES', NULL, 'gemini-2.5-flash')
ON DUPLICATE KEY UPDATE id = id;
