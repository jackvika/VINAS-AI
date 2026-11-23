<?php
declare(strict_types=1);
require_once __DIR__ . '/src/page.php';

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
        <li><a href="#human">Human mode techniques</a></li>
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

    <section id="human">
        <h2>Human mode techniques</h2>
        <p>These four are VINAS AI's own. They are not signs of AI writing; they are ordinary habits of clear writers.</p>
        <details class="pattern" id="p27"><summary><strong>27. Plain words</strong></summary><p>Long phrases become short ones: "in order to" becomes "to", "utilize" becomes "use", "made a decision" becomes "decided".</p></details>
        <details class="pattern" id="p28"><summary><strong>28. Filler and connectors</strong></summary><p>"It is important to note that", "Moreover," and "In conclusion," are cut. "Therefore," becomes "So", and "However, the" becomes "But the".</p></details>
        <details class="pattern" id="p29"><summary><strong>29. Contractions</strong></summary><p>"It is not" becomes "it isn't". Technical and legal text, and writing samples that avoid contractions, keep the full form.</p></details>
        <details class="pattern" id="p30"><summary><strong>30. Sentence rhythm</strong></summary><p>A sentence of 20 words or more is split where both halves can stand alone.</p></details>
        <p>Human mode also lists what only you can add: a real number, name, date, example or opinion. It never invents one, and it never adds mistakes.</p>
    </section>
<?php pageBottom();
