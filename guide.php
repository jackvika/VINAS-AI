<?php
declare(strict_types=1);
require __DIR__ . '/src/page.php';

// What this site does with each pattern.
$flagOnly = [6, 14, 17, 25, 26];
$status = fn(int $n): string => in_array($n, $flagOnly, true) ? 'Highlighted' : (in_array($n, [2, 3, 4, 5, 7, 11, 15, 20, 23, 24], true) ? 'Some fixed, some highlighted' : 'Fixed, or highlighted when unsure');

$skill = skillFile('SKILL.md');
preg_match_all('/^## ([A-F])\. ([^\n]+)\n(.*?)(?=^## |\z)/msu', $skill, $groups, PREG_SET_ORDER);

pageTop('The 26 patterns', 'Numbered from strongest to weakest. The first five are worth fixing on sight; a pattern marked weak alone counts only next to others.');
?>
    <ul class="toc">
        <?php foreach ($groups as [, $letter, $title]): ?><li><a href="#<?= $letter ?>"><?= $letter ?>. <?= e($title) ?></a></li><?php endforeach ?>
        <li><a href="#exceptions">When not to act</a></li>
    </ul>

    <?php foreach ($groups as [, $letter, $title, $body]):
        $parts = preg_split('/^### (?=\d+\. )/mu', $body); ?>
    <section id="<?= $letter ?>">
        <h2><?= $letter ?>. <?= e($title) ?></h2>
        <?= markdown(array_shift($parts)) ?>
        <?php foreach ($parts as $part):
            [$heading, $content] = explode("\n", $part, 2);
            $n = (int) $heading; ?>
        <details class="pattern" id="p<?= $n ?>">
            <summary><strong><?= e($heading) ?></strong> <span class="muted"><?= e($status($n)) ?></span></summary>
            <?= markdown($content) ?>
        </details>
        <?php endforeach ?>
    </section>
    <?php endforeach ?>

    <?php preg_match('/^## When not to act\n(.*?)(?=^## |\z)/msu', $skill, $m); ?>
    <section id="exceptions">
        <h2>When not to act</h2>
        <?= markdown($m[1] ?? '') ?>
    </section>
<?php pageBottom();
