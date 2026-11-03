<?php

declare(strict_types=1);

require_once __DIR__ . '/environment.php';

mysqli_report(MYSQLI_REPORT_OFF);

$host = getenv('DB_HOST') ?: 'database';
$user = requiredEnvironment('DB_USER');
$password = requiredEnvironment('DB_PASSWORD');
$database = getenv('DB_NAME') ?: 'openshop';
$port = (int) (getenv('DB_PORT') ?: 3306);
$prefix = getenv('DB_PREFIX') ?: 'oc_';

if (!preg_match('/^[A-Za-z0-9_]+$/', $prefix)) {
    fwrite(STDERR, "DB_PREFIX may contain only letters, numbers, and underscores.\n");
    exit(2);
}

for ($attempt = 1; $attempt <= 60; $attempt++) {
    $connection = @new mysqli($host, $user, $password, $database, $port);

    if (!$connection->connect_errno) {
        $table = $connection->real_escape_string($prefix . 'setting');
        $result = $connection->query("SHOW TABLES LIKE '{$table}'");
        $installed = $result !== false && $result->num_rows > 0;
        $connection->close();

        exit($installed ? 0 : 10);
    }

    sleep(2);
}

fwrite(STDERR, "The OpenCart container could not connect to MySQL.\n");
exit(1);
