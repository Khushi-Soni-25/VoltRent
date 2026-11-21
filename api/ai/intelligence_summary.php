<?php
// Optional AI endpoint: live data summary for Admin AI readiness.
// Read-only. Performs SELECT queries only.
require_once __DIR__ . '/../config.php';

function aiSummaryDb() {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    return new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

try {
    $db = aiSummaryDb();

    $tableCounts = [
        'users' => (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn(),
        'dealers' => (int)$db->query("SELECT COUNT(*) FROM dealers")->fetchColumn(),
        'requests' => (int)$db->query("SELECT COUNT(*) FROM requests")->fetchColumn(),
        'inventory_log' => (int)$db->query("SELECT COUNT(*) FROM inventory_log")->fetchColumn(),
        'request_timeline' => (int)$db->query("SELECT COUNT(*) FROM request_timeline")->fetchColumn(),
    ];

    $stock = $db->query(
        "SELECT
            COALESCE(SUM(bat_stock), 0) AS battery_stock,
            COALESCE(SUM(chg_stock), 0) AS charger_stock,
            SUM(CASE WHEN bat_stock > 0 THEN 1 ELSE 0 END) AS dealers_with_battery_stock,
            SUM(CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 1 ELSE 0 END) AS dealers_with_coordinates
         FROM dealers"
    )->fetch();

    $requestStats = $db->query(
        "SELECT
            SUM(CASE WHEN status IN ('pending','approved','on_the_way') THEN 1 ELSE 0 END) AS active_requests,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS completed_requests,
            MIN(created_at) AS first_request_at,
            MAX(created_at) AS last_request_at,
            COUNT(DISTINCT stype) AS request_type_count,
            COUNT(DISTINCT location) AS location_count
         FROM requests"
    )->fetch();

    $statusRows = $db->query(
        "SELECT status, COUNT(*) AS count
         FROM requests
         GROUP BY status
         ORDER BY status ASC"
    )->fetchAll();

    $serviceRows = $db->query(
        "SELECT stype, COUNT(*) AS count
         FROM requests
         GROUP BY stype
         ORDER BY stype ASC"
    )->fetchAll();

    jsonResponse([
        'status' => 'ok',
        'data_source' => 'live_mysql',
        'database' => DB_NAME,
        'statistics' => [
            'total_users' => $tableCounts['users'],
            'total_dealers' => $tableCounts['dealers'],
            'total_requests' => $tableCounts['requests'],
            'available_battery_stock' => (int)($stock['battery_stock'] ?? 0),
            'available_charger_stock' => (int)($stock['charger_stock'] ?? 0),
            'dealers_with_battery_stock' => (int)($stock['dealers_with_battery_stock'] ?? 0),
            'dealers_with_coordinates' => (int)($stock['dealers_with_coordinates'] ?? 0),
            'active_requests' => (int)($requestStats['active_requests'] ?? 0),
            'completed_requests' => (int)($requestStats['completed_requests'] ?? 0),
        ],
        'readiness' => [
            'historical_requests' => $tableCounts['requests'],
            'dealers' => $tableCounts['dealers'],
            'users' => $tableCounts['users'],
            'inventory_history_records' => $tableCounts['inventory_log'],
            'request_timeline_records' => $tableCounts['request_timeline'],
            'first_request_at' => $requestStats['first_request_at'] ?? null,
            'last_request_at' => $requestStats['last_request_at'] ?? null,
            'request_type_count' => (int)($requestStats['request_type_count'] ?? 0),
            'location_count' => (int)($requestStats['location_count'] ?? 0),
            'ml_status' => 'Insufficient historical data for meaningful production model validation.',
            'recommendation_status' => 'Live-data enabled',
            'battery_health_status' => 'Synthetic Prototype',
            'demand_prediction_status' => 'Synthetic Prototype',
        ],
        'breakdowns' => [
            'requests_by_status' => $statusRows,
            'requests_by_service_type' => $serviceRows,
        ],
        'models' => [
            'battery_health' => [
                'status' => 'Synthetic Prototype',
                'production_validated' => false,
            ],
            'demand_prediction' => [
                'status' => 'Synthetic Prototype',
                'production_validated' => false,
            ],
            'smart_recommendation' => [
                'status' => 'Live Data Enabled',
                'production_validated' => true,
                'type' => 'Explainable scoring engine',
            ],
        ],
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'status' => 'error',
        'message' => 'AI intelligence summary unavailable.',
        'detail' => $e->getMessage(),
    ]);
}

