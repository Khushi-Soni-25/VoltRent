<?php
// api/fix_passwords.php
// ─────────────────────────────────────────────────────
// Run this ONCE in your browser:
//   http://localhost/voltride/api/fix_passwords.php
//
// It finds every password that is NOT a bcrypt hash
// and re-saves it as a proper bcrypt hash.
// Delete this file after running it!
// ─────────────────────────────────────────────────────
require_once 'config.php';

$db      = getDB();
$tables  = ['users','dealers','agents'];
$fixed   = [];
$skipped = [];

foreach ($tables as $table) {
    $rows = $db->query("SELECT id, email, password FROM `$table`")->fetchAll();
    foreach ($rows as $row) {
        $pwd = $row['password'];
        // bcrypt hashes always start with $2y$
        if (strpos($pwd, '$2y$') === 0) {
            $skipped[] = "[$table] {$row['email']} — already hashed, skipped";
            continue;
        }
        // Plain text — hash it
        $hash = password_hash($pwd, PASSWORD_BCRYPT);
        $db->prepare("UPDATE `$table` SET password=? WHERE id=?")
           ->execute([$hash, $row['id']]);
        $fixed[] = "[$table] {$row['email']} — plain text '{$pwd}' → hashed ✅";
    }
}

header('Content-Type: text/plain; charset=utf-8');
echo "=== VoltRide Password Fix Tool ===\n\n";
echo "FIXED (" . count($fixed) . "):\n";
foreach ($fixed   as $m) echo "  $m\n";
echo "\nSKIPPED (" . count($skipped) . "):\n";
foreach ($skipped as $m) echo "  $m\n";
echo "\n✅ Done! You can delete this file now.\n";
echo "   (api/fix_passwords.php)\n";
