<?php
declare(strict_types=1);
require_once __DIR__ . '/Humanizer.php';
require_once __DIR__ . '/Pdf.php';

const SITE_NAME = 'VINAS AI';
const MAX_CHARS = 50000;

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'");
header('Content-Type: text/html; charset=utf-8');

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function field(string $name): string
{
    $value = $_POST[$name] ?? '';
    return is_string($value) ? str_replace("\r\n", "\n", $value) : '';
}

/** Returns an error message, or '' when every text is usable. */
function textError(string ...$texts): string
{
    foreach ($texts as $text) {
        if (!mb_check_encoding($text, 'UTF-8')) {
            return 'That text is not valid UTF-8. Copy it again as plain text.';
        }
        if (mb_strlen($text) > MAX_CHARS) {
            return 'Keep each box under ' . number_format(MAX_CHARS) . ' characters.';
        }
    }
    return '';
}

function skillFile(string $name): string
{
    return str_replace("\r\n", "\n", (string) file_get_contents(__DIR__ . '/../skill/' . $name));
}

/** The before/after pairs in the project's README, shortest first. */
function examples(): array
{
    preg_match_all('/\*\*(Before|After)[^*]*:\*\*\n+((?:>[^\n]*\n?)+)/u', skillFile('README.md'), $m, PREG_SET_ORDER);
    $pairs = [];
    foreach ($m as [, $kind, $quote]) {
        $text = trim(preg_replace('/^> ?/mu', '', $quote));
        if ($kind === 'Before') {
            $pairs[] = ['before' => $text, 'after' => ''];
        } elseif ($pairs) {
            $pairs[count($pairs) - 1]['after'] = $text;
        }
    }
    return $pairs;
}

/** The little Markdown that SKILL.md and CHANGELOG.md use. */
function markdown(string $md): string
{
    $html = '';
    foreach (preg_split('/\n{2,}/', trim($md)) as $block) {
        if (preg_match('/^>/', $block)) {
            $html .= '<blockquote>' . markdown(preg_replace('/^> ?/m', '', $block)) . '</blockquote>';
        } elseif (preg_match('/^\*\*[^*]+:\*\*\n>/', $block)) {
            [$label, $quote] = explode("\n", $block, 2);
            $html .= '<p>' . inline($label) . '</p><blockquote>' . markdown(preg_replace('/^> ?/m', '', $quote)) . '</blockquote>';
        } elseif (preg_match('/^(#{2,4}) (.+)$/s', $block, $m)) {
            $html .= '<h3>' . inline($m[2]) . '</h3>';
        } elseif (preg_match('/^(?:[-*]|\d+\.) /', $block)) {
            $items = preg_split('/\n(?=(?:[-*]|\d+\.) )/', $block);
            $html .= '<ul>';
            foreach ($items as $item) {
                $html .= '<li>' . inline(preg_replace('/^(?:[-*]|\d+\.) /', '', $item)) . '</li>';
            }
            $html .= '</ul>';
        } else {
            $html .= '<p>' . nl2br(inline($block), false) . '</p>';
        }
    }
    return $html;
}

function inline(string $s): string
{
    $s = e($s);
    $s = preg_replace('/`([^`]+)`/', '<code>$1</code>', $s);
    $s = preg_replace('/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/', '<a href="$2">$1</a>', $s);
    $s = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $s);
    return preg_replace('/(?<![\w*])\*([^*\n]+)\*(?![\w*])/', '<em>$1</em>', $s);
}

/** A download button, or the browser's own print-to-PDF for scripts the PDF fonts lack. */
function pdfButton(string $text, string $name, bool $canPrint): void
{
    if (trim($text) === '') {
        return;
    }
    if (Pdf::supports($text)) { ?>
                <form method="post" action="pdf.php" class="inline">
                    <input type="hidden" name="text" value="<?= e($text) ?>">
                    <input type="hidden" name="name" value="<?= e($name) ?>">
                    <button type="submit" class="ghost">Download PDF</button>
                </form>
    <?php } elseif ($canPrint) { ?>
                <button type="button" class="ghost" data-print>Save as PDF</button>
    <?php }
}

function pageTop(string $title, string $intro): void
{
    $here = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $links = ['index.php' => 'Rewrite', 'check.php' => 'Check a rewrite', 'guide.php' => 'The 26 patterns', 'about.php' => 'How it works'];
    ?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($title) ?> | <?= e(SITE_NAME) ?></title>
    <meta name="theme-color" content="#cc4400">
    <link rel="stylesheet" href="style.css">
</head>
<body>
<main>
    <nav>
        <a class="brand" href="index.php"><?= e(SITE_NAME) ?></a>
        <?php foreach ($links as $href => $label): ?>
        <a href="<?= $href ?>"<?= $here === $href ? ' aria-current="page"' : '' ?>><?= e($label) ?></a>
        <?php endforeach ?>
    </nav>
    <header>
        <h1><?= e($title) ?></h1>
        <p><?= e($intro) ?></p>
    </header>
    <?php
}

function pageBottom(): void
{
    ?>
    <footer>
        <p>Your text is processed on this server and is not saved. This site does not try to get past AI detectors.</p>
        <p>Based on <a href="https://github.com/blader/humanizer">blader/humanizer</a>, copyright 2025 Siqi Chen, <a href="skill/LICENSE.txt">MIT License</a>. Not affiliated with that project.</p>
    </footer>
</main>
<script src="app.js"></script>
</body>
</html>
    <?php
}
