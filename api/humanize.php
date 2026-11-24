<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reply(405, ['error' => 'Send a POST request.']);
}
if (!sameOrigin($_SERVER) || !str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
    reply(403, ['error' => 'Use the form on this site.']);
}
if (!aiReady()) {
    reply(503, ['error' => 'Full rewrite is not set up on this server.']);
}
set_time_limit(180);

try {
    $in = readInput((string) file_get_contents('php://input', false, null, 0, 200000));
    if (!allow(visitor($_SERVER), time())) {
        reply(429, ['error' => 'The limit for now is used up. Try again later.']);
    }
    reply(200, ['text' => rewrite($in)]);
} catch (AiError $e) {
    reply($e->status, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('Rewrite failed: ' . get_class($e));
    reply(500, ['error' => 'Something went wrong. Try again.']);
}
