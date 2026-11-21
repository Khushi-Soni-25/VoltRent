<?php
// api/login.php — Authenticate user / dealer / agent / admin
require_once 'config.php';

$body  = getBody();
$email = trim($body['email'] ?? '');
$pass  = $body['pass']  ?? '';

if (!$email || !$pass) {
    jsonResponse(['status'=>'error','message'=>'Email and password required']);
}

$db = getDB();

// Admin hardcoded
if ($email === 'admin@voltride.com' && $pass === 'admin123') {
    jsonResponse(['status'=>'ok','user'=>[
        'id'=>'ADMIN','name'=>'Admin','email'=>$email,'role'=>'admin'
    ]]);
}

// Search users -> dealers -> agents
$tables = ['users','dealers','agents'];

foreach ($tables as $table) {
    $stmt = $db->prepare("SELECT * FROM `$table` WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row) continue;

    $stored  = $row['password'] ?? '';
    $matched = false;

    // Try bcrypt hash first (registered via website)
    if (password_verify($pass, $stored)) {
        $matched = true;
    }
    // Fallback: plain text (entered manually in phpMyAdmin)
    elseif ($pass === $stored) {
        $matched = true;
        // Auto-upgrade to bcrypt so future logins use hash
        $hash = password_hash($pass, PASSWORD_BCRYPT);
        $db->prepare("UPDATE `$table` SET password=? WHERE email=?")->execute([$hash, $email]);
    }

    if ($matched) {
        unset($row['password']);

        if ($table === 'dealers') {
            $row['role'] = 'dealer';
            $row['addr'] = $row['address']   ?? '';
            $row['bat']  = (int)($row['bat_stock'] ?? 20);
            $row['chg']  = (int)($row['chg_stock'] ?? 10);
            unset($row['address'],$row['bat_stock'],$row['chg_stock']);
        }
        if ($table === 'agents') {
            $row['role']   = 'delivery';
            $row['online'] = (bool)($row['is_online']  ?? true);
            $row['done']   = (int)($row['total_done']  ?? 0);
            $row['earn']   = (float)($row['earnings']  ?? 0.0);
            unset($row['is_online'],$row['total_done'],$row['earnings']);
        }

        jsonResponse(['status'=>'ok','user'=>$row]);
    }
}

jsonResponse(['status'=>'error','message'=>'Invalid email or password.']);
