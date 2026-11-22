<?php
// Server-side Render ML API client. Keep ML_API_URL in the PHP host's
// environment; it is never emitted to browser JavaScript.

function aiMlApiRequest($path, $payload) {
    $baseUrl = rtrim((string)getenv('ML_API_URL'), '/');
    if ($baseUrl === '' || !filter_var($baseUrl, FILTER_VALIDATE_URL)) {
        return ['status' => 'error', 'message' => 'AI service is not configured.'];
    }
    if (!function_exists('curl_init')) {
        return ['status' => 'error', 'message' => 'AI service is unavailable.'];
    }

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return ['status' => 'error', 'message' => 'Could not prepare AI request.'];
    }

    $curl = curl_init($baseUrl . '/' . ltrim($path, '/'));
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    $decoded = is_string($response) ? json_decode($response, true) : null;
    if ($status >= 200 && $status < 300 && is_array($decoded)) {
        return $decoded;
    }
    return ['status' => 'error', 'message' => 'AI service is temporarily unavailable.'];
}
