<?php
// api/agents_get.php — Returns all online delivery agents
require_once 'config.php';

$db    = getDB();
$rows  = $db->query("SELECT id, name, phone, vehicle, area, is_online FROM agents ORDER BY name ASC")->fetchAll();

$agents = array_map(function($r) {
    return [
        'id'     => $r['id'],
        'name'   => $r['name'],
        'phone'  => $r['phone']   ?? '',
        'vehicle'=> $r['vehicle'] ?? '',
        'area'   => $r['area']    ?? '',
        'online' => (bool)(int)$r['is_online'],
    ];
}, $rows);

jsonResponse(['status' => 'ok', 'agents' => $agents]);
