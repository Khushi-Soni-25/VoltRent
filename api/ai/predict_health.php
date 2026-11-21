<?php
// Optional AI endpoint: battery health prediction from supplied features.
// Does not read or modify production data yet.
require_once __DIR__ . '/../config.php';

function aiRunHealthPredictor($payload) {
    $script = realpath(__DIR__ . '/../../ml/prediction/health_predictor.py');
    if (!$script) {
        return ['status' => 'error', 'message' => 'Health predictor module is missing.'];
    }
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $inputFile = tempnam(sys_get_temp_dir(), 'voltride_ai_');
    if ($inputFile === false || file_put_contents($inputFile, $json) === false) {
        return ['status' => 'error', 'message' => 'Could not prepare health prediction input.'];
    }
    try {
        $cmd = 'python ' . escapeshellarg($script) . ' --input-file ' . escapeshellarg($inputFile);
        $output = [];
        $code = 0;
        exec($cmd, $output, $code);
        if ($code !== 0 || !$output) {
            return ['status' => 'error', 'message' => 'Health prediction script failed.'];
        }
    } finally {
        @unlink($inputFile);
    }
    $decoded = json_decode(implode("\n", $output), true);
    return $decoded ?: ['status' => 'error', 'message' => 'Invalid health prediction response.'];
}

$body = getBody();
if (!$body) {
    jsonResponse(['status' => 'error', 'message' => 'Prediction features are required.']);
}

jsonResponse(aiRunHealthPredictor($body));
