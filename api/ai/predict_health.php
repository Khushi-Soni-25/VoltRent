<?php
// Optional AI endpoint: battery health prediction from supplied features.
// Does not read or modify production data yet.
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/ml_client.php';

function aiRunHealthPredictor($payload) {
    return aiMlApiRequest('/predict/health', $payload);
}

$body = getBody();
if (!$body) {
    jsonResponse(['status' => 'error', 'message' => 'Prediction features are required.']);
}

jsonResponse(aiRunHealthPredictor($body));
