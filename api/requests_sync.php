<?php
// api/requests_sync.php
// Called by frontend every few seconds to pull latest requests from DB
// Returns requests in the exact same shape as the JS S.reqs array
require_once 'config.php';

$db = getDB();

// Optional filters
$uid    = $_GET['uid']    ?? null;
$role   = $_GET['role']   ?? 'admin';
$status = $_GET['status'] ?? null;

$where  = [];
$params = [];

if ($role === 'user' && $uid) {
    // User sees only their own requests
    $where[] = 'r.user_id = ?';
    $params[] = $uid;
} elseif ($role === 'delivery' && $uid) {
    // Agent sees requests assigned to them (approved/on_the_way/delivered)
    $where[] = 'r.agent_id = ?';
    $params[] = $uid;
} elseif ($role === 'dealer') {
    // Dealer sees ALL requests (pending + active + completed)
    // no filter needed
}
// Admin sees everything — no filter

if ($status) {
    $where[] = 'r.status = ?';
    $params[] = $status;
}

$sql = "SELECT r.*,
        GROUP_CONCAT(t.label    ORDER BY t.id SEPARATOR '|||') AS tl_labels,
        GROUP_CONCAT(t.done     ORDER BY t.id SEPARATOR '|||') AS tl_done,
        GROUP_CONCAT(IFNULL(DATE_FORMAT(t.done_at,'%h:%i %p'),'') ORDER BY t.id SEPARATOR '|||') AS tl_times
        FROM requests r
        LEFT JOIN request_timeline t ON t.request_id = r.id
        " . ($where ? 'WHERE '.implode(' AND ',$where) : '') . "
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT 500";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$result = [];
foreach ($rows as $row) {
    // Build timeline array matching JS format
    $labels = $row['tl_labels'] ? explode('|||', $row['tl_labels']) : [];
    $dones  = $row['tl_done']   ? explode('|||', $row['tl_done'])   : [];
    $times  = $row['tl_times']  ? explode('|||', $row['tl_times'])  : [];
    $tl = [];
    foreach ($labels as $i => $label) {
        $tl[] = [
            'label' => $label,
            'done'  => (bool)(int)($dones[$i] ?? 0),
            'time'  => $times[$i] ?? ''
        ];
    }

    $result[] = [
        'id'       => $row['id'],
        'uid'      => $row['user_id']    ?? '',
        'uname'    => $row['user_name']  ?? '',
        'stype'    => $row['stype']      ?? '',
        'vno'      => $row['vehicle_no'] ?? '',
        'model'    => $row['model']      ?? '',
        'loc'      => $row['location']   ?? '',
        'lat'      => $row['lat']   ? (float)$row['lat'] : null,
        'lng'      => $row['lng']   ? (float)$row['lng'] : null,
        'priority' => $row['priority']   ?? 'normal',
        'tech'     => $row['need_tech']  ? 'yes' : 'no',
        'notes'    => $row['notes']      ?? '',
        'status'   => $row['status']     ?? 'pending',
        'time'     => $row['created_at'] ? date('h:i A', strtotime($row['created_at'])) : '',
        'date'     => $row['created_at'] ? date('d/m/Y', strtotime($row['created_at'])) : '',
        'tl'       => $tl,
    ];
}

jsonResponse(['status'=>'ok','reqs'=>$result,'count'=>count($result)]);
