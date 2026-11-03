<?php

declare(strict_types=1);

/** Require supplied credentials without including their values in errors. */
function requiredEnvironment(string $name): string
{
    $value = getenv($name);

    if ($value === false || trim($value) === '') {
        throw new RuntimeException($name . ' must be configured.');
    }

    return $value;
}
