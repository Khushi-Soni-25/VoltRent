-- ══════════════════════════════════════════════════
--  VOLTRIDE — EV Battery Rental System
--  MySQL Database Schema
--  Run this file once in phpMyAdmin or MySQL CLI:
--     mysql -u root -p < database.sql
-- ══════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS voltride CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE voltride;

-- ── USERS (EV Owners) ──────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(10)  PRIMARY KEY,          -- e.g. U001
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  phone       VARCHAR(15),
  password    VARCHAR(255) NOT NULL,             -- bcrypt hashed
  role        ENUM('user','dealer','delivery','admin') DEFAULT 'user',
  vehicle     VARCHAR(30),
  model       VARCHAR(100),
  location    VARCHAR(200),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── DEALERS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS dealers (
  id          VARCHAR(10)  PRIMARY KEY,          -- e.g. D001
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  phone       VARCHAR(15),
  password    VARCHAR(255) NOT NULL,
  address     TEXT,
  bat_stock   INT DEFAULT 20,
  chg_stock   INT DEFAULT 10,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── DELIVERY AGENTS ───────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id          VARCHAR(10)  PRIMARY KEY,          -- e.g. A001
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  phone       VARCHAR(15),
  password    VARCHAR(255) NOT NULL,
  vehicle     VARCHAR(50),
  area        VARCHAR(100),
  is_online   TINYINT(1) DEFAULT 1,
  total_done  INT DEFAULT 0,
  earnings    DECIMAL(10,2) DEFAULT 0.00,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── SERVICE REQUESTS ──────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id          VARCHAR(15)  PRIMARY KEY,          -- e.g. REQ-001
  user_id     VARCHAR(10),
  user_name   VARCHAR(100),
  dealer_id   VARCHAR(10),
  agent_id    VARCHAR(10),
  stype       ENUM('replacement','charger','swap') NOT NULL,
  vehicle_no  VARCHAR(20),
  model       VARCHAR(100),
  location    TEXT,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  priority    ENUM('normal','express','emergency') DEFAULT 'normal',
  need_tech   TINYINT(1) DEFAULT 0,
  notes       TEXT,
  status      ENUM('pending','approved','on_the_way','delivered','rejected','cancelled') DEFAULT 'pending',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE SET NULL,
  FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id)  REFERENCES agents(id)  ON DELETE SET NULL
);

-- ── REQUEST TIMELINE ──────────────────────────────
CREATE TABLE IF NOT EXISTS request_timeline (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  request_id  VARCHAR(15) NOT NULL,
  label       VARCHAR(100),
  done        TINYINT(1) DEFAULT 0,
  done_at     DATETIME,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

-- ── INVENTORY LOG ─────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  dealer_id   VARCHAR(10),
  item_type   ENUM('battery','charger'),
  delta       INT,                               -- +/- quantity change
  reason      VARCHAR(100),
  logged_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════
-- SEED DATA — Demo accounts (passwords: demo123)
-- bcrypt of 'demo123' = $2y$10$...
-- ══════════════════════════════════════════════════

INSERT IGNORE INTO users VALUES
('U001','Deep Daswani','user@demo.com','+91 9876543210',
 '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
 'user','scooter','Ather 450X','Ahmedabad', NOW());

INSERT IGNORE INTO dealers VALUES
('D001','EV Power Hub','dealer@demo.com','+91 9988776655',
 '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
 'Satellite, Ahmedabad', 20, 15, 23.0319, 72.5142, NOW());

INSERT IGNORE INTO agents VALUES
('A001','Rahul Shah','delivery@demo.com','+91 9876543200',
 '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
 'Motorcycle','Ahmedabad',1,0,0.00, NOW());

-- Note: The hash above is Laravel's default bcrypt of 'password'
-- For demo123 use PHP: echo password_hash('demo123', PASSWORD_BCRYPT);
-- Then update these rows.
