<?php
declare(strict_types=1);
require __DIR__ . '/src/page.php';

$original = field('original');
$rewrite = field('rewrite');
$error = '';
$report = null;
$engine = new Humanizer();
$patterns = $engine->patterns();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $error = textError($original, $rewrite);
    if ($error !== '') {
        $original = $rewrite = '';
    } elseif (trim($original) !== '' && trim($rewrite) !== '') {
        try {
            $report = [
                'missing' => $engine->missing($original, $rewrite),
                'added' => $engine->missing($rewrite, $original),
                'before' => count($engine->inspect($original)['tells']),
                'tells' => $engine->inspect($rewrite)['tells'],
            ];
        } catch (RuntimeException $ex) {
            error_log($ex->getMessage());
            $error = 'That text could not be processed. Try a shorter section.';
        }
    } elseif (isset($_POST['rewrite'])) {
        $error = 'Paste both the original and the rewrite.';
    }
}

pageTop('Check a rewrite', 'Compare any rewrite with the original: which facts went missing, which are new, and which tells are left.');
?>
    <?php if ($error !== ''): ?><p class="error" role="alert"><?= e($error) ?></p><?php endif ?>

    <form method="post" action="check.php#report">
        <label for="original">Original</label>
        <textarea id="original" name="original" rows="8" maxlength="<?= MAX_CHARS ?>"><?= "\n" . e($original) ?></textarea>
        <label for="rewrite">Rewrite</label>
        <textarea id="rewrite" name="rewrite" rows="8" maxlength="<?= MAX_CHARS ?>"><?= "\n" . e($rewrite) ?></textarea>
        <button type="submit">Check rewrite</button>
    </form>

    <?php if ($report !== null): ?>
    <section id="report">
        <div class="bar">
            <h2>Report</h2>
            <?php pdfButton($rewrite, 'rewrite', false) ?>
        </div>
        <p class="stats">
            <span><b><?= $report['before'] ?> → <?= count($report['tells']) ?></b> tells</span>
            <span><b><?= count($report['missing']) ?></b> details missing</span>
            <span><b><?= count($report['added']) ?></b> details added</span>
        </p>
        <?php if ($report['missing']): ?><p class="error">Missing from the rewrite: <?= e(implode(', ', $report['missing'])) ?></p><?php endif ?>
        <?php if ($report['added']): ?><p class="error">Not in the original: <?= e(implode(', ', $report['added'])) ?></p><?php endif ?>
        <?php if (!$report['missing'] && !$report['added']): ?><p class="note">Every number, link and name matches. Read it once more for changed meaning, which this check cannot see.</p><?php endif ?>
        <?php if ($report['tells']): ?>
        <h3>Tells still in the rewrite</h3>
        <ul class="list">
            <?php foreach ($report['tells'] as $t): [$name, $advice] = $patterns[$t['pattern']] ?>
            <li><a class="tag" href="guide.php#p<?= $t['pattern'] ?>"><?= $t['pattern'] ?>. <?= e($name) ?></a> <mark><?= e($t['text']) ?></mark><span><?= e($advice) ?></span></li>
            <?php endforeach ?>
        </ul>
        <?php else: ?>
        <p class="note">No tells this site can detect are left.</p>
        <?php endif ?>
    </section>
    <?php endif ?>
<?php pageBottom();
