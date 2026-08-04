<?php
// teste.php — apague após resolver
header('Content-Type: text/html; charset=utf-8');

$host = '127.0.0.1';
$name = 'monitor_pg';
$user = 'roott';
$pass = 'jade132456';

echo "<pre style='font:14px monospace;padding:20px;background:#111;color:#eee'>";
echo "=== TESTE DE CONEXÃO ===\n\n";

// 1. PDO disponível?
echo "PDO: " . (extension_loaded('pdo') ? "✅ OK" : "❌ NÃO INSTALADO") . "\n";
echo "PDO MySQL: " . (extension_loaded('pdo_mysql') ? "✅ OK" : "❌ NÃO INSTALADO") . "\n\n";

// 2. Tenta conectar
echo "Tentando conectar em $host/$name com usuário '$user'...\n";
try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$name;charset=utf8mb4",
        $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "✅ CONEXÃO OK!\n\n";

    // 3. Tabelas
    echo "=== TABELAS ===\n";
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    foreach (['usuarios','pagamentos','configuracoes'] as $t) {
        if (in_array($t, $tables)) {
            $n = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
            echo "✅ $t ($n registros)\n";
        } else {
            echo "❌ $t — NÃO EXISTE\n";
        }
    }

    // 4. Testa sessão
    echo "\n=== SESSÃO ===\n";
    session_start();
    echo "✅ Sessão OK (ID: " . session_id() . ")\n";

} catch (PDOException $e) {
    echo "❌ ERRO: " . $e->getMessage() . "\n\n";

    $msg = $e->getMessage();
    echo "=== DIAGNÓSTICO ===\n";
    if (str_contains($msg, 'Access denied'))
        echo "➜ Usuário '$user' sem permissão no banco '$name'\n"
           . "➜ Solução: AAPanel → Database → '$name' → Permission → adicione '$user'\n";
    elseif (str_contains($msg, 'Unknown database'))
        echo "➜ Banco '$name' não existe\n"
           . "➜ Solução: crie o banco no AAPanel e rode o schema.sql\n";
    elseif (str_contains($msg, 'Connection refused') || str_contains($msg, "Can't connect"))
        echo "➜ MySQL não está rodando ou host errado\n"
           . "➜ Tente trocar '127.0.0.1' por 'localhost' no config.php\n";
    elseif (str_contains($msg, 'getaddrinfo'))
        echo "➜ Host '$host' não encontrado\n"
           . "➜ Tente trocar por 'localhost' no config.php\n";
}

echo "\n=== ARQUIVOS NA PASTA ===\n";
foreach (glob(__DIR__ . '/*.{php,html,js,sql}', GLOB_BRACE) as $f)
    echo "📄 " . basename($f) . "\n";

echo "</pre>";
// APAGUE ESTE ARQUIVO APÓS RESOLVER