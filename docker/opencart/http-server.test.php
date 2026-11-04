<?php

declare(strict_types=1);
require __DIR__ . '/http-server.php';

$public = 'http://localhost:18086/opencart/upload/';
$internal = 'http://opencart/opencart/upload/';
$cases = [
    [null, $internal, '', $public],
    ['localhost:18086', $internal, '', $public],
    ['opencart', $internal, '', $internal],
    ['OPENCART', $internal, '', $internal],
    ['opencart:80', $internal, '', $internal],
    ['opencart', $internal, 'admin/', $internal . 'admin/'],
    ['localhost:18086', $internal, 'admin/', $public . 'admin/'],
    ['untrusted.example', $internal, '', $public],
    ['opencart.evil.example', $internal, '', $public],
    ['opencart:81', $internal, '', $public],
    ['opencart', '', '', $public],
    ['opencart:8081', 'http://opencart:8081/opencart/upload/', '', 'http://opencart:8081/opencart/upload/'],
];
foreach ($cases as [$host, $configuredInternal, $suffix, $expected]) {
    unset($_SERVER['HTTP_HOST']);
    if ($host !== null) {
        $_SERVER['HTTP_HOST'] = $host;
    }
    $actual = eval('return ' . httpServerExpression($public, $configuredInternal, $suffix) . ';');
    if ($actual !== $expected) {
        throw new RuntimeException('Wrong configured URL for host ' . ($host ?? '<CLI>'));
    }
}
echo count($cases) . " OpenCart URL selection checks passed.\n";
