<?php
// Optional AI endpoint: demand prediction from supplied features.
// Does not read or modify production data yet.
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/ml_client.php';

function aiRunDemandPredictor($payload) {
    return aiMlApiRequest('/predict/demand', $payload);
}

$body = getBody();
if (!$body) {
    jsonResponse(['status' => 'error', 'message' => 'Prediction features are required.']);
}

jsonResponse(aiRunDemandPredictor($body));
