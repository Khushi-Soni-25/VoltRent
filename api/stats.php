<?php
// api/stats.php — Dashboard stats for any role
require_once 'config.php';
$db = getDB();

$role = $_GET['role'] ?? 'admin';
$uid  = $_GET['uid']  ?? null;

if ($role === 'admin') {
    $stats = [
        'users'    => (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn(),
        'dealers'  => (int)$db->query("SELECT COUNT(*) FROM dealers")->fetchColumn(),
        'agents'   => (int)$db->query("SELECT COUNT(*) FROM agents")->fetchColumn(),
        'reqs'     => (int)$db->query("SELECT COUNT(*) FROM requests")->fetchColumn(),
        'pending'  => (int)$db->query("SELECT COUNT(*) FROM requests WHERE status='pending'")->fetchColumn(),
        'on_way'   => (int)$db->query("SELECT COUNT(*) FROM requests WHERE status='on_the_way'")->fetchColumn(),
        'delivered'=> (int)$db->query("SELECT COUNT(*) FROM requests WHERE status='delivered'")->fetchColumn(),
    ];

} elseif ($role === 'user' && $uid) {
    $stmt = $db->prepare("SELECT COUNT(*) FROM requests WHERE user_id=?");
    $stmt->execute([$uid]); $tot = (int)$stmt->fetchColumn();
    $stmt = $db->prepare("SELECT COUNT(*) FROM requests WHERE user_id=? AND status='pending'");
    $stmt->execute([$uid]); $pend = (int)$stmt->fetchColumn();
    $stmt = $db->prepare("SELECT COUNT(*) FROM requests WHERE user_id=? AND status='delivered'");
    $stmt->execute([$uid]); $del = (int)$stmt->fetchColumn();
    $stats = ['total'=>$tot,'pending'=>$pend,'delivered'=>$del];

} elseif ($role === 'dealer' && $uid) {
    $stmt = $db->prepare("SELECT bat_stock, chg_stock FROM dealers WHERE id=?");
    $stmt->execute([$uid]); $inv = $stmt->fetch();
    $stmt = $db->prepare("SELECT COUNT(*) FROM requests WHERE dealer_id=? AND status='pending'");
    $stmt->execute([$uid]); $pend = (int)$stmt->fetchColumn();
    $stmt = $db->prepare("SELECT COUNT(*) FROM requests WHERE dealer_id=? AND status='delivered'");
    $stmt->execute([$uid]); $del = (int)$stmt->fetchColumn();
    $stats = ['bat'=>(int)($inv['bat_stock']??20),'chg'=>(int)($inv['chg_stock']??10),'pending'=>$pend,'delivered'=>$del];

} else {
    $stats = [];
}

jsonResponse(['status'=>'ok','stats'=>$stats]);
