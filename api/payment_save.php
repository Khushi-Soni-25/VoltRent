<?php
require_once 'config.php';
$body = getBody();
$db   = getDB();
$id   = 'PAY-' . strtoupper(substr(md5(uniqid()), 0, 8));
$stmt = $db->prepare(
  "INSERT INTO payments (id, request_id, user_id, user_name, amount, method, status)
   VALUES (?,?,?,?,?,?,'success')"
);
$stmt->execute([
  $id,
  $body['request_id'] ?? '',
  $body['user_id']    ?? '',
  $body['user_name']  ?? '',
  $body['amount']     ?? 0,
  $body['method']     ?? 'upi'
]);
jsonResponse(['status'=>'ok','payment_id'=>$id]);
?>