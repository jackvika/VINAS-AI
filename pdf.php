<?php
declare(strict_types=1);
require_once __DIR__ . '/src/page.php';

$text = trim(field('text'));
$error = textError($text);
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || $text === '') {
    $error = 'There is no text to save. Go back and rewrite some text first.';
} elseif ($error === '' && !Pdf::supports($text)) {
    $error = 'This text has characters the PDF fonts do not cover. Use your browser to print the result and choose "Save as PDF".';
}

if ($error !== '') {
    http_response_code(400);
    pageTop('PDF not created', $error);
    pageBottom();
    exit;
}

$name = preg_replace('/\.(?:txt|md|markdown)$/i', '', field('name'));
$name = trim(preg_replace('/[^A-Za-z0-9 _-]+/', '-', mb_substr(mb_scrub($name, 'UTF-8'), 0, 60)), ' -');
$name = $name === '' ? 'rewrite' : $name;
$pdf = Pdf::render($text, $name);

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $name . '.pdf"');
header('Content-Length: ' . strlen($pdf));
header('Cache-Control: no-store');
echo $pdf;
