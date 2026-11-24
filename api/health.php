<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';

reply(200, ['ok' => true, 'ai' => aiReady(), 'max' => MAX_TEXT]);
