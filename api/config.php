<?php
// ══════════════════════════════════════════════
//  VOLTRIDE — Database Config
//  File: api/config.php
//  Edit DB_HOST, DB_USER, DB_PASS, DB_NAME below
// ══════════════════════════════════════════════

define('DB_HOST', 'localhost');
define('DB_USER', 'root');       // ← change to your MySQL username
define('DB_PASS', '');           // ← change to your MySQL password
define('DB_NAME', 'voltride');

// CORS — allow frontend to call API
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = 'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4';
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            jsonResponse(['status'=>'error','message'=>'DB connection failed: '.$e->getMessage()]);
            exit();
        }
    }
    return $pdo;
}

function jsonResponse($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function getBody() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function nextId($prefix, $table, $col = 'id') {
    $db  = getDB();
    $stmt = $db->query("SELECT COUNT(*) as cnt FROM `$table`");
    $cnt = (int)$stmt->fetch()['cnt'];
    return $prefix . str_pad($cnt + 1, 3, '0', STR_PAD_LEFT);
}
