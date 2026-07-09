<?php
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'monitor_pg');
define('DB_USER', 'roott');
define('DB_PASS', 'jade132456');

function db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    try {
        $pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
    } catch (PDOException $e) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        die(json_encode(['ok'=>false,'error'=>'Erro BD: '.$e->getMessage()]));
    }
    return $pdo;
}

function startSession() {
    if (session_status()===PHP_SESSION_NONE) {
        session_name('mp_sess');
        session_set_cookie_params(60*60*24*7);
        session_start();
    }
}

function ensureTokenTable() {
    static $done=false; if($done)return; $done=true;
    db()->exec("CREATE TABLE IF NOT EXISTS auth_tokens (token VARCHAR(64) PRIMARY KEY, usuario_id INT NOT NULL, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function generateToken($uid) {
    ensureTokenTable();
    $token = bin2hex(random_bytes(32));
    db()->prepare('INSERT INTO auth_tokens (token,usuario_id) VALUES (?,?)')->execute([$token,$uid]);
    return $token;
}

function authUser() {
    $token = isset($_SERVER['HTTP_X_AUTH_TOKEN']) ? trim($_SERVER['HTTP_X_AUTH_TOKEN']) : '';
    if ($token) {
        ensureTokenTable();
        $st = db()->prepare('SELECT usuario_id FROM auth_tokens WHERE token=?');
        $st->execute([$token]);
        $row = $st->fetch();
        if ($row) return (int)$row['usuario_id'];
    }
    startSession();
    if (!empty($_SESSION['user_id'])) return (int)$_SESSION['user_id'];
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(401);
    die(json_encode(['ok'=>false,'error'=>'Não autorizado.']));
}