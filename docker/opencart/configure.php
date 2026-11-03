<?php

declare(strict_types=1);

require_once __DIR__ . '/environment.php';

function environment(string $name, string $default): string
{
    $value = getenv($name);

    return $value === false || $value === '' ? $default : $value;
}

function definition(string $name, string $value): string
{
    return "define('{$name}', " . var_export($value, true) . ");\n";
}

$root = '/var/www/html/opencart/upload/';
$httpServer = rtrim(environment('OPENCART_HTTP_SERVER', 'http://localhost/opencart/upload/'), '/') . '/';
$dbHost = environment('DB_HOST', 'database');
$dbUser = requiredEnvironment('DB_USER');
$dbPassword = requiredEnvironment('DB_PASSWORD');
$dbName = environment('DB_NAME', 'openshop');
$dbPrefix = environment('DB_PREFIX', 'oc_');
$dbPort = environment('DB_PORT', '3306');

$database = "// DB\n"
    . definition('DB_DRIVER', 'mysqli')
    . definition('DB_HOSTNAME', $dbHost)
    . definition('DB_USERNAME', $dbUser)
    . definition('DB_PASSWORD', $dbPassword)
    . definition('DB_DATABASE', $dbName)
    . definition('DB_PORT', $dbPort)
    . definition('DB_PREFIX', $dbPrefix);

$catalog = "<?php\n// HTTP\n"
    . definition('HTTP_SERVER', $httpServer)
    . "\n// HTTPS\n"
    . definition('HTTPS_SERVER', $httpServer)
    . "\n// DIR\n"
    . definition('DIR_APPLICATION', $root . 'catalog/')
    . definition('DIR_SYSTEM', $root . 'system/')
    . definition('DIR_IMAGE', $root . 'image/')
    . "define('DIR_STORAGE', DIR_SYSTEM . 'storage/');\n"
    . "define('DIR_LANGUAGE', DIR_APPLICATION . 'language/');\n"
    . "define('DIR_TEMPLATE', DIR_APPLICATION . 'view/theme/');\n"
    . "define('DIR_CONFIG', DIR_SYSTEM . 'config/');\n"
    . "define('DIR_CACHE', DIR_STORAGE . 'cache/');\n"
    . "define('DIR_DOWNLOAD', DIR_STORAGE . 'download/');\n"
    . "define('DIR_LOGS', DIR_STORAGE . 'logs/');\n"
    . "define('DIR_MODIFICATION', DIR_STORAGE . 'modification/');\n"
    . "define('DIR_SESSION', DIR_STORAGE . 'session/');\n"
    . "define('DIR_UPLOAD', DIR_STORAGE . 'upload/');\n\n"
    . $database;

$admin = "<?php\n// HTTP\n"
    . definition('HTTP_SERVER', $httpServer . 'admin/')
    . definition('HTTP_CATALOG', $httpServer)
    . "\n// HTTPS\n"
    . definition('HTTPS_SERVER', $httpServer . 'admin/')
    . definition('HTTPS_CATALOG', $httpServer)
    . "\n// DIR\n"
    . definition('DIR_APPLICATION', $root . 'admin/')
    . definition('DIR_SYSTEM', $root . 'system/')
    . definition('DIR_IMAGE', $root . 'image/')
    . "define('DIR_STORAGE', DIR_SYSTEM . 'storage/');\n"
    . definition('DIR_CATALOG', $root . 'catalog/')
    . "define('DIR_LANGUAGE', DIR_APPLICATION . 'language/');\n"
    . "define('DIR_TEMPLATE', DIR_APPLICATION . 'view/template/');\n"
    . "define('DIR_CONFIG', DIR_SYSTEM . 'config/');\n"
    . "define('DIR_CACHE', DIR_STORAGE . 'cache/');\n"
    . "define('DIR_DOWNLOAD', DIR_STORAGE . 'download/');\n"
    . "define('DIR_LOGS', DIR_STORAGE . 'logs/');\n"
    . "define('DIR_MODIFICATION', DIR_STORAGE . 'modification/');\n"
    . "define('DIR_SESSION', DIR_STORAGE . 'session/');\n"
    . "define('DIR_UPLOAD', DIR_STORAGE . 'upload/');\n\n"
    . $database
    . "\n// OpenCart API\n"
    . definition('OPENCART_SERVER', 'https://www.opencart.com/');

if (file_put_contents($root . 'config.php', $catalog) === false) {
    throw new RuntimeException('Unable to write the catalog config.php file.');
}

if (file_put_contents($root . 'admin/config.php', $admin) === false) {
    throw new RuntimeException('Unable to write the admin config.php file.');
}
