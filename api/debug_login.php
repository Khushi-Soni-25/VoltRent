<?php
// api/debug_login.php
// Open in browser to see all accounts and their password types:
//   http://localhost/voltride/api/debug_login.php
// DELETE THIS FILE after debugging!
require_once 'config.php';

$db = getDB();
header('Content-Type: text/plain; charset=utf-8');
echo "=== VoltRide Login Debugger ===\n\n";

$tables = ['users','dealers','agents'];
foreach ($tables as $table) {
    echo strtoupper($table) . ":\n";
    $rows = $db->query("SELECT id, name, email, password FROM `$table`")->fetchAll();
    if (!$rows) { echo "  (empty)\n\n"; continue; }
    foreach ($rows as $row) {
        $pwd = $row['password'];
        $type = (strpos($pwd,'$2y$')===0) ? 'bcrypt hash ✅' : "PLAIN TEXT ⚠️  → value: '{$pwd}'";
        echo "  [{$row['id']}] {$row['name']} ({$row['email']})\n";
        echo "       Password: $type\n";
    }
    echo "\n";
}
echo "If you see PLAIN TEXT above, run:\n";
echo "  http://localhost/voltride/api/fix_passwords.php\n";
