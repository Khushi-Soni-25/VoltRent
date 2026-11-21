<?php
// api/requests_get.php — Fetch requests (with optional filters)
require_once 'config.php';

$db     = getDB();
$uid    = $_GET['uid']    ?? null;
$did    = $_GET['did']    ?? null;   // dealer id
$status = $_GET['status'] ?? null;

$where  = [];
$params = [];

if ($uid)    { $where[] = 'r.user_id = ?';   $params[] = $uid; }
if ($did)    { $where[] = 'r.dealer_id = ?'; $params[] = $did; }
if ($status) { $where[] = 'r.status = ?';    $params[] = $status; }

$sql = "SELECT r.*,
               GROUP_CONCAT(t.label ORDER BY t.id SEPARATOR '|||') AS tl_labels,
               GROUP_CONCAT(t.done  ORDER BY t.id SEPARATOR '|||') AS tl_done,
               GROUP_CONCAT(IFNULL(t.done_at,'') ORDER BY t.id SEPARATOR '|||') AS tl_times
        FROM requests r
        LEFT JOIN request_timeline t ON t.request_id = r.id "
     . ($where ? "WHERE ".implode(' AND ', $where) : "")
     . " GROUP BY r.id ORDER BY r.created_at DESC LIMIT 200";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

// Build JS-compatible timeline arrays
foreach ($rows as &$row) {
    $labels = explode('|||', $row['tl_labels'] ?? '');
    $dones  = explode('|||', $row['tl_done']   ?? '');
    $times  = explode('|||', $row['tl_times']  ?? '');
    $row['tl'] = [];
    foreach ($labels as $i => $label) {
        $row['tl'][] = [
            'label' => $label,
            'done'  => (bool)(int)($dones[$i] ?? 0),
            'time'  => $times[$i] ?? ''
        ];
    }
    unset($row['tl_labels'], $row['tl_done'], $row['tl_times']);
    // Map DB cols to JS keys
    $row['uid']      = $row['user_id'];
    $row['uname']    = $row['user_name'];
    $row['loc']      = $row['location'];
    $row['vno']      = $row['vehicle_no'];

    $row['lat']      = $row['lat'] ? (float)$row['lat'] : null;
    $row['lng']      = $row['lng'] ? (float)$row['lng'] : null;
    $row['time']     = date('h:i A', strtotime($row['created_at']));
    $row['date']     = date('d/m/Y', strtotime($row['created_at']));
}

jsonResponse(['status'=>'ok','requests'=>$rows]);
