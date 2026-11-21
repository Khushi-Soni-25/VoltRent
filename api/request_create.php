<?php
// api/request_create.php — Save a new service request + timeline rows
require_once 'config.php';

$body = getBody();
$db   = getDB();

// Generate ID if not provided
$id = $body['id'] ?? null;
if (!$id) {
    $count = (int)$db->query("SELECT COUNT(*) FROM requests")->fetchColumn();
    $id = 'REQ-' . str_pad($count + 1, 3, '0', STR_PAD_LEFT);
}

// Insert or update request
$stmt = $db->prepare(
    "INSERT INTO requests
       (id, user_id, user_name, stype, vehicle_no, model,
        location, lat, lng, priority, need_tech, notes, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending')
     ON DUPLICATE KEY UPDATE
       status     = VALUES(status),
       updated_at = NOW()"
);

$stmt->execute([
    $id,
    $body['uid']      ?? null,
    $body['uname']    ?? '',
    $body['stype']    ?? 'replacement',
    $body['vno']      ?? '',
    $body['model']    ?? '',
    $body['loc']      ?? '',
    $body['lat']      ?? null,
    $body['lng']      ?? null,
    $body['priority'] ?? 'normal',
    ($body['tech'] ?? 'no') === 'yes' ? 1 : 0,
    $body['notes']    ?? '',
]);

// Insert timeline rows (only if they don't exist yet)
$tl = [
    'Request Submitted',
    'Dealer Notified',
    'Approved & Dispatched',
    'On the Way',
    'Delivered'
];

// Check if timeline rows already exist
$existing = (int)$db->prepare("SELECT COUNT(*) FROM request_timeline WHERE request_id=?")->execute([$id]);
$existing = (int)$db->query("SELECT COUNT(*) FROM request_timeline WHERE request_id='$id'")->fetchColumn();

if ($existing === 0) {
    $ts = $db->prepare("INSERT INTO request_timeline (request_id, label, done, done_at) VALUES (?,?,?,?)");
    foreach ($tl as $i => $label) {
        // First step always done (submitted)
        $ts->execute([$id, $label, $i === 0 ? 1 : 0, $i === 0 ? date('Y-m-d H:i:s') : null]);
    }
}

jsonResponse(['status' => 'ok', 'id' => $id]);
