<?php

declare(strict_types=1);

require_once __DIR__ . '/environment.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$host = getenv('DB_HOST') ?: 'database';
$user = requiredEnvironment('DB_USER');
$dbPassword = requiredEnvironment('DB_PASSWORD');
$database = getenv('DB_NAME') ?: 'openshop';
$port = (int) (getenv('DB_PORT') ?: 3306);
$prefix = getenv('DB_PREFIX') ?: 'oc_';
$email = strtolower(requiredEnvironment('OPENCART_TEST_EMAIL'));
$password = requiredEnvironment('OPENCART_TEST_PASSWORD');

if (!preg_match('/^[A-Za-z0-9_]+$/', $prefix)) {
    throw new RuntimeException('DB_PREFIX may contain only letters, numbers, and underscores.');
}

$connection = new mysqli($host, $user, $dbPassword, $database, $port);
$connection->set_charset('utf8');

$select = $connection->prepare("SELECT customer_id FROM `{$prefix}customer` WHERE LOWER(email) = ? LIMIT 1");
$select->bind_param('s', $email);
$select->execute();
$select->store_result();

if ($select->num_rows === 0) {
    $salt = substr(bin2hex(random_bytes(8)), 0, 9);
    $passwordHash = sha1($salt . sha1($salt . sha1($password)));

    $insert = $connection->prepare(
        "INSERT INTO `{$prefix}customer` "
        . '(customer_group_id, store_id, language_id, firstname, lastname, email, telephone, fax, '
        . 'password, salt, cart, wishlist, newsletter, address_id, custom_field, ip, status, safe, '
        . 'token, code, date_added) '
        . "VALUES (1, 0, 1, 'Pavan', 'Kumar', ?, '1234567890', '', ?, ?, NULL, NULL, 0, 0, '', "
        . "'127.0.0.1', 1, 0, '', '', NOW())"
    );
    $insert->bind_param('sss', $email, $passwordHash, $salt);
    $insert->execute();

    echo "Created the Playwright test customer.\n";
}

$connection->close();
