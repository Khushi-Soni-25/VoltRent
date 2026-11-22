<?php
// Optional AI endpoint: dealer-level battery/service recommendation.
// Read-only. Does not modify existing Voltride data.
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/ml_client.php';

function aiRunMlRecommendation($payload) {
    return aiMlApiRequest('/recommendations/battery', $payload);
}

function aiFetchDealersReadOnly(&$warning = null) {
    try {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo->query(
            "SELECT id, name, address, bat_stock, chg_stock, lat, lng
             FROM dealers
             ORDER BY name ASC"
        )->fetchAll();
    } catch (Throwable $e) {
        $warning = 'Live database unavailable; used request-provided dealer data if supplied.';
        return [];
    }
}

$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true);
if (trim($rawBody) !== '' && json_last_error() !== JSON_ERROR_NONE) {
    jsonResponse([
        'success' => false,
        'status' => 'invalid_request',
        'type' => 'real_data_recommendation',
        'message' => 'Malformed JSON request body.',
        'recommendation' => null,
        'alternatives' => [],
    ]);
}
if (!is_array($body)) {
    $body = [];
}
$dealers = isset($body['dealers']) && is_array($body['dealers']) ? $body['dealers'] : [];
$warning = null;
$dataSource = $dealers ? 'request_payload' : 'live_mysql';

if (!$dealers) {
    $dealers = aiFetchDealersReadOnly($warning);
}

if (!$dealers) {
    jsonResponse([
        'success' => false,
        'status' => 'insufficient_real_data',
        'type' => 'real_data_recommendation',
        'data_source' => $warning ? 'unavailable' : $dataSource,
        'message' => 'No dealer inventory data available for recommendation.',
        'warning' => $warning,
        'recommendation' => null,
        'alternatives' => [],
    ]);
}

$result = aiRunMlRecommendation([
    'request' => $body ?: new stdClass(),
    'dealers' => $dealers,
]);

if ($warning && is_array($result)) {
    $result['warning'] = $warning;
}

if (is_array($result)) {
    $result['success'] = ($result['status'] ?? '') === 'ok';
    $result['type'] = 'real_data_recommendation';
    $result['data_source'] = $warning ? 'fallback_or_unavailable' : $dataSource;
    $result['dealer_count'] = count($dealers);
    if (count($dealers) < 2 && ($result['status'] ?? '') === 'ok') {
        $result['data_quality'] = 'limited_real_data';
        $result['warning'] = 'Only one dealer record was available, so alternatives may be limited.';
    }
}

jsonResponse($result);
