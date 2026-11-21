<?php
// api/register.php — Register user / dealer / agent
require_once 'config.php';

$body = getBody();
$role = $body['role'] ?? '';

if (!$role) jsonResponse(['status'=>'error','message'=>'Role required']);

$db   = getDB();
$pass = password_hash($body['pass'] ?? 'demo123', PASSWORD_BCRYPT);

if ($role === 'user') {
    $id   = nextId('U', 'users');
    $stmt = $db->prepare(
        "INSERT INTO users (id,name,email,phone,password,role,vehicle,model,location)
         VALUES (?,?,?,?,?,?,?,?,?)"
    );
    $stmt->execute([
        $id,
        $body['name']     ?? '',
        $body['email']    ?? '',
        $body['phone']    ?? '',
        $pass,
        'user',
        $body['vehicle']  ?? '',
        $body['model']    ?? '',
        'Ahmedabad'
    ]);
    jsonResponse(['status'=>'ok','id'=>$id]);

} elseif ($role === 'dealer') {
    $id   = nextId('D', 'dealers');
    $stmt = $db->prepare(
        "INSERT INTO dealers (id,name,email,phone,password,address,bat_stock,chg_stock)
         VALUES (?,?,?,?,?,?,?,?)"
    );
    $stmt->execute([
        $id,
        $body['name']    ?? '',
        $body['email']   ?? '',
        $body['phone']   ?? '',
        $pass,
        $body['addr']    ?? '',
        (int)($body['bat'] ?? 20),
        (int)($body['chg'] ?? 10),
    ]);
    jsonResponse(['status'=>'ok','id'=>$id]);

} elseif ($role === 'delivery') {
    $id   = nextId('A', 'agents');
    $stmt = $db->prepare(
        "INSERT INTO agents (id,name,email,phone,password,vehicle,area)
         VALUES (?,?,?,?,?,?,?)"
    );
    $stmt->execute([
        $id,
        $body['name']    ?? '',
        $body['email']   ?? '',
        $body['phone']   ?? '',
        $pass,
        $body['vehicle'] ?? '',
        $body['area']    ?? '',
    ]);
    jsonResponse(['status'=>'ok','id'=>$id]);

} else {
    jsonResponse(['status'=>'error','message'=>'Unknown role: '.$role]);
}
