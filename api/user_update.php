<?php
require_once 'config.php';
$body  = getBody();
$db    = getDB();
$email = $body['email'] ?? '';
if (!$email) jsonResponse(['status'=>'error','message'=>'Email required']);

$tables = ['users','dealers','agents'];
foreach ($tables as $table) {
    $stmt = $db->prepare("SELECT id FROM `$table` WHERE email=? LIMIT 1");
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row) continue;
    $db->prepare("UPDATE `$table` SET name=?, phone=? WHERE email=?")
       ->execute([$body['name'] ?? '', $body['phone'] ?? '', $email]);
    jsonResponse(['status'=>'ok']);
}
jsonResponse(['status'=>'error','message'=>'User not found']);
?>