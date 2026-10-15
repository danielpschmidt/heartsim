<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

json_out(['csrfToken' => csrf_token()]);
