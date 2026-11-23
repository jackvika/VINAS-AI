<?php
// Builds the PHP-free version of the site for GitHub Pages. Run after changing a page, a rule or a skill file:
//   php tools/build.php
// Add --tests to also write tests/cases.js for tests/browser.html.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
ob_start();
require_once $root . '/src/page.php';

function capture(string $file): string
{
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['SCRIPT_NAME'] = '/' . basename($file);
    $_GET = $_POST = $_FILES = [];
    ob_start();
    (function () use ($file) {
        require $file;
    })();
    return str_replace("\r\n", "\n", (string) ob_get_clean());
}

function js($value): string
{
    // JSON_HEX_TAG keeps "</script>" out of the file.
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_THROW_ON_ERROR);
}

$rules = require $root . '/src/rules.php';
$widths = (new ReflectionClassConstant('Pdf', 'WIDTHS'))->getValue();
$data = [
    'max' => MAX_CHARS,
    'rules' => $rules,
    'widths' => $widths,
    'examples' => array_column(examples(), 'before'),
    'skill' => trim(preg_replace('/\A---\n.*?\n---\n/s', '', skillFile('SKILL.md'))),
];
file_put_contents($root . '/static/data.js', "// Built by tools/build.php. Do not edit.\nconst DATA = " . js($data) . ";\n");

$scripts = '';
foreach (['static/data.js', 'static/engine.js', 'static/pdf.js', 'app.js', 'static/site.js'] as $src) {
    // The hash makes browsers fetch a changed file instead of a cached one.
    $scripts .= '<script src="' . $src . '?' . substr(md5_file("$root/$src"), 0, 8) . '"></script>' . "\n";
}
$css = 'style.css?' . substr(md5_file($root . '/style.css'), 0, 8);

foreach (['index', 'check', 'guide', 'about'] as $page) {
    $html = capture("$root/$page.php");
    $html = preg_replace('/(href|action)="(index|check|guide|about)\.php/', '$1="$2.html', $html);
    $html = str_replace('href="style.css"', 'href="' . $css . '"', $html);
    $html = str_replace('Your text is processed on this server and is not saved.', 'Your text is processed in your browser and is not uploaded or saved.', $html);
    $interactive = $page === 'index' || $page === 'check';
    $html = str_replace("<script src=\"app.js\"></script>\n", $interactive
        ? '<noscript><p class="error">This page needs JavaScript.</p></noscript>' . "\n" . $scripts
        : "<script src=\"app.js\"></script>\n", $html);
    file_put_contents("$root/$page.html", $html);
}

if (in_array('--tests', $argv, true)) {
    $texts = array_column(examples(), 'before');
    preg_match_all('/\*\*(?:Before|After)[^*]*:\*\*\n+((?:>[^\n]*\n?)+)/u', skillFile('SKILL.md') . skillFile('README.md'), $m);
    foreach ($m[1] as $quote) {
        $texts[] = trim(preg_replace('/^> ?/mu', '', $quote));
    }
    foreach (['rewrites', 'untouched', 'flagged', 'strong', 'human'] as $list) {
        // The lists in tests/run.php, read without running it.
        preg_match('/^\$' . $list . ' = (\[.*?^\]);/ms', file_get_contents($root . '/tests/run.php'), $found);
        foreach (eval('return ' . $found[1] . ';') as $case) {
            $texts[] = is_array($case) ? $case[0] : $case;
        }
    }
    $texts[] = skillFile('SKILL.md');
    $texts[] = skillFile('README.md');
    $texts[] = "Ünïcode Café — “quoted” naïve — text. Experts believe it’s crucial. हिन्दी में — यह — ठीक है। ₹500 🚀";
    $texts[] = "A\r\nB — c — d\r\n\r\n\r\nLet that sink in.";
    $sample = "I don't think it's that hard — honestly we didn't plan much, and the trip was still vibrant and good. We can't complain about any of it.";
    $formal = str_repeat('We do not know what the plan is and we are not sure. ', 3);
    $cases = [];
    $engine = new Humanizer();
    foreach (array_values(array_unique($texts)) as $text) {
        foreach (array_keys(Humanizer::TYPES) as $type) {
            foreach ([false, true] as $strong) {
                $cases[] = [$text, ['type' => $type, 'strong' => $strong]];
            }
        }
        foreach (array_keys(Humanizer::TYPES) as $type) {
            $cases[] = [$text, ['type' => $type, 'human' => true]];
        }
        $cases[] = [$text, ['human' => true, 'sample' => $sample]];
        $cases[] = [$text, ['human' => true, 'sample' => $formal]];
        $cases[] = [$text, ['strong' => true, 'sample' => $sample]];
        $cases[] = [$text, ['sample' => $formal, 'dashes' => true]];
    }
    $out = [];
    foreach ($cases as [$text, $options]) {
        $r = $engine->run($text, $options);
        $strip = fn(array $flags) => array_map(fn($f) => [$f['pattern'], $f['text']], $flags);
        $out[] = ['in' => $text, 'options' => $options, 'want' => [
            'text' => $r['text'], 'first' => $r['first'], 'survived' => $strip($r['survived']), 'flags' => $strip($r['flags']),
            'edits' => array_map(fn($c) => [$c['pattern'], $c['before'], $c['after']], $r['edits']),
            'missing' => $r['missing'], 'held' => $r['held'], 'sections' => $r['sections'],
            'voice' => $r['voice'] ?: null, 'average' => $engine->averageSentence($text), 'tips' => $r['tips'], 'metrics' => $engine->metrics($text),
        ]];
    }
    // Several pages, with headings, lists, code and words longer than a line.
    $long = '';
    for ($i = 1; $i <= 60; $i++) {
        $long .= str_repeat('#', $i % 6 + 1) . " Heading $i (part) \\ é\n\nParagraph $i. " . str_repeat("The café cost €5 and “nobody” minded; $i people came. ", $i % 5 + 1)
            . "\n\n- " . str_repeat("item $i ", $i % 30 + 1) . "\n12. " . str_repeat('x', $i * 5) . "\n\n```\n\tcode --line $i\n```\n";
    }
    $pdfs = [];
    foreach (array_merge($texts, [$long]) as $text) {
        $pdfs[] = ['in' => $text, 'want' => Pdf::supports($text) && trim($text) !== '' ? bin2hex(Pdf::render($text, 'Tést')) : null];
    }
    file_put_contents($root . '/tests/cases.js', 'const CASES = ' . js($out) . ";\nconst PDFS = " . js($pdfs) . ";\n");
    $note = count($out) . ' cases and ' . count($pdfs) . ' PDFs';
}

ob_end_clean();
echo 'Built 4 pages', isset($note) ? " and $note" : '', "\n";
