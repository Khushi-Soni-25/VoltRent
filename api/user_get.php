<?php
// api/user_get.php — Get fresh user data from DB by email
// Used by requireAuth to get correct ID after login
require_once 'config.php';

$email = $_GET['email'] ?? '';
if (!$email) jsonResponse(['status'=>'error','message'=>'Email required']);

$db     = getDB();
$tables = ['users','dealers','agents'];

foreach ($tables as $table) {
    $stmt = $db->prepare("SELECT * FROM `$table` WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row) continue;

    unset($row['password']);

    if ($table === 'dealers') {
        $row['role'] = 'dealer';
        $row['addr'] = $row['address']    ?? '';
        $row['bat']  = (int)($row['bat_stock'] ?? 20);
        $row['chg']  = (int)($row['chg_stock'] ?? 10);
    }
    if ($table === 'agents') {
        $row['role']   = 'delivery';
        $row['online'] = (bool)(int)($row['is_online']  ?? 1);
        $row['done']   = (int)($row['total_done']  ?? 0);
        $row['earn']   = (float)($row['earnings']  ?? 0);
    }

    jsonResponse(['status'=>'ok','user'=>$row]);
}

jsonResponse(['status'=>'error','message'=>'User not found']);
