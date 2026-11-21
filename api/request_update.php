<?php
// api/request_update.php — Update request status + auto-assign agent + fix timeline
require_once 'config.php';

$body   = getBody();
$db     = getDB();
$id     = $body['id']     ?? '';
$status = $body['status'] ?? '';

if (!$id || !$status) {
    jsonResponse(['status'=>'error','message'=>'id and status required']);
}

// ── 1. Resolve agent_id ────────────────────────────────────────
$agentId = $body['agent_id'] ?? null;

// If no specific agent chosen (auto-assign) and status is approved → pick first online agent
if (!$agentId && $status === 'approved') {
    $onlineAgent = $db->query(
        "SELECT id FROM agents WHERE is_online=1 ORDER BY RAND() LIMIT 1"
    )->fetch();
    if ($onlineAgent) {
        $agentId = $onlineAgent['id'];
    }
}

// ── 2. Update main request row ─────────────────────────────────
$stmt = $db->prepare(
    "UPDATE requests
     SET status=?,
         dealer_id = COALESCE(?, dealer_id),
         agent_id  = COALESCE(?, agent_id),
         updated_at = NOW()
     WHERE id=?"
);
$stmt->execute([
    $status,
    $body['dealer_id'] ?? null,
    $agentId,
    $id
]);

// ── 3. Update timeline rows ────────────────────────────────────
$stepMap = [
    'pending'    => 0,
    'approved'   => 2,
    'on_the_way' => 3,
    'delivered'  => 4,
    'rejected'   => 0,
    'cancelled'  => 0,
];
$upToStep = $stepMap[$status] ?? 0;

$tlRows = $db->query(
    "SELECT id FROM request_timeline WHERE request_id='$id' ORDER BY id ASC"
)->fetchAll();

foreach ($tlRows as $i => $tlRow) {
    if ($i === 0 || ($i === 1 && $status !== 'pending') || $i <= $upToStep) {
        $db->prepare("UPDATE request_timeline SET done=1, done_at=COALESCE(done_at,NOW()) WHERE id=?")
           ->execute([$tlRow['id']]);
    } else {
        $db->prepare("UPDATE request_timeline SET done=0, done_at=NULL WHERE id=?")
           ->execute([$tlRow['id']]);
    }
}

// ── 4. If delivered → update agent earnings ────────────────────
if ($status === 'delivered' && $agentId) {
    $db->prepare(
        "UPDATE agents SET total_done=total_done+1, earnings=earnings+150 WHERE id=?"
    )->execute([$agentId]);
}

// ── 5. Return assigned agent info so frontend can show it ──────
$assignedAgent = null;
if ($agentId) {
    $assignedAgent = $db->prepare("SELECT id, name, phone, vehicle FROM agents WHERE id=?")
        ->execute([$agentId]);
    $assignedAgent = $db->query("SELECT id, name, phone, vehicle FROM agents WHERE id='$agentId'")->fetch();
}

jsonResponse([
    'status'         => 'ok',
    'request_id'     => $id,
    'new_status'     => $status,
    'assigned_agent' => $assignedAgent,
]);
