<?php

declare(strict_types=1);

/** PHP expression used by the generated OpenCart configuration. */
function httpServerExpression(string $publicServer, string $internalServer, string $suffix = ''): string
{
    $public = var_export($publicServer . $suffix, true);
    if ($internalServer === '') {
        return $public;
    }

    $parts = parse_url($internalServer);
    if ($parts === false || empty($parts['host']) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)) {
        throw new RuntimeException('OPENCART_INTERNAL_HTTP_SERVER must be an absolute HTTP(S) URL.');
    }
    $host = strtolower($parts['host']);
    $defaultPort = $parts['scheme'] === 'https' ? 443 : 80;
    $port = $parts['port'] ?? $defaultPort;
    $authorities = [$host . ':' . $port];
    if ($port === $defaultPort) {
        $authorities[] = $host;
    }

    // Only the explicitly configured internal authority selects the internal
    // URL. An arbitrary Host header can never become an OpenCart base URL.
    $condition = 'in_array(strtolower($_SERVER[\'HTTP_HOST\'] ?? \'\'), '
        . var_export($authorities, true) . ', true)';
    return '(' . $condition . ' ? ' . var_export($internalServer . $suffix, true) . ' : ' . $public . ')';
}
