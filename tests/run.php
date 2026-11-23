<?php
// Run: C:\xampp\php\php.exe tests\run.php
declare(strict_types=1);
require __DIR__ . '/../src/Humanizer.php';

$h = new Humanizer();
$failed = 0;

// [input, expected]
$rewrites = [
    ["It's not just a feature; it's a whole new way to collaborate.", "It's a feature and a whole new way to collaborate."],
    ["Lisbon isn't just a place to visit; it's a place to fall in love with.", "Lisbon is a place to visit and a place to fall in love with."],
    ["It’s not just fast, it’s secure.", "It’s fast and secure."],
    ["The tool is not only fast but also cheap.", "The tool is fast and cheap."],
    ["Sales rose 10%. Let that sink in.", "Sales rose 10%."],
    ["And the best part? It's free.", "It's free."],
    ["Great question! The French Revolution began in 1789. I hope this helps!", "The French Revolution began in 1789."],
    ["Great question! Here is an overview of the French Revolution. It began in 1789. I hope this helps! Let me know if you'd like me to expand on any section.", "The French Revolution began in 1789."],
    ["Gallery 825 serves as an exhibition space. It boasts over 3,000 square feet.", "Gallery 825 is an exhibition space. It has over 3,000 square feet."],
    ["It was an intricate plan.", "It was a complex plan."],
    ["It was a crucial step.", "It was an important step."],
    ["The institute was established in 1989, marking a pivotal moment in the evolution of statistics in Spain.", "The institute was established in 1989."],
    ["The policy — announced without warning — affects workers. The changes -- long overdue -- take effect now.", "The policy, announced without warning, affects workers. The changes, long overdue, take effect now."],
    ["- **Performance:** Performance has been enhanced.", "- Performance has been improved."],
    ["🚀 **Launch Phase:** The product launches in Q3", "Launch Phase: The product launches in Q3"],
    ["It could potentially help.", "It could help."],
    ["\"It was a crucial step.\"", "\"It was an important step.\""],
];

// Must come back unchanged.
$untouched = [
    "The cat sat on the mat. It was warm.",
    "She said \"this is a pivotal moment\" and left.",
    "Run `delve into --fast` and see https://example.com/a–b--c/crucial for more.",
    "He works at Pivotal Software in Boston.",
    "I liked it — a lot.",
    "Pages 10–20 cover it.",
    "The report is high-quality.",
    "Worst. Service. Ever. tried restarting it twice, disgusting",
    "Of course I will come on Friday.",
    "Please let me know if you have any questions.",
    "```\nIt's not just X; it's Y — delve into\n```",
    "— Oscar Wilde",
    "Der Zug fährt um 10 Uhr. हिन्दी पाठ यहाँ है।",
];

// [input, pattern expected among the flags]
$flagged = [
    ["Experts believe it helps.", 17],
    ["The temple is blue, reflecting the community's deep connection to the land.", 15],
    ["The views were stunning.", 16],
    ["The real question is whether teams can adapt.", 3],
    ["It's not a song, it's a statement.", 1],
    ["She noted the door. She noted the lock. She filed both away.", 7],
    ["## Strategic Negotiations And Global Partnerships", 20],
    ["## Performance\n\nSpeed really matters.\n\nUsers leave slow pages.", 24],
    ["Her views were cited in The New York Times.", 17],
];

function check(string $kind, string $input, $expected, $actual, int &$failed): void
{
    if ($expected !== $actual) {
        $failed++;
        echo "FAIL $kind\n  in:   $input\n  want: $expected\n  got:  " . (is_array($actual) ? json_encode($actual) : $actual) . "\n";
    }
}

foreach ($rewrites as [$in, $want]) {
    check('rewrite', $in, $want, $h->run($in)['text'], $failed);
}
foreach ($untouched as $in) {
    check('untouched', $in, $in, $h->run($in)['text'], $failed);
}
foreach ($flagged as [$in, $n]) {
    $got = array_column($h->run($in)['flags'], 'pattern');
    check('flag', $in, true, in_array($n, $got, true), $failed);
}

// Options
check('keep dashes', '', 'A — b, it is important — yes.', $h->run('A — b, it is crucial — yes.', ['dashes' => true])['text'], $failed);
check('informal lone tell', '', 'lol that was crucial', $h->run('lol that was crucial', ['type' => 'informal'])['text'], $failed);

// Highlight offsets must point at the flagged text.
$r = $h->run("Ünïcode — “quoted” text. Experts believe it helps, ensuring a robust result.");
foreach ($r['flags'] as $f) {
    check('offset', $r['text'], $f['text'], substr($r['text'], $f['start'], $f['end'] - $f['start']), $failed);
}

// Strong mode
$strong = [
    ["It had no bias. No aesthetic prior. No nostalgia.", "It had no bias, no aesthetic prior, and no nostalgia."],
    ["She noted the door. She noted the lock on it. She filed both away.", "She noted the door and noted the lock on it. She filed both away."],
    ["The options come from the item, no guessing.", "The options come from the item without guessing."],
    ["I'm thrilled to announce that drafts are here.", "Drafts are here."],
    ["It's not a song, it's a statement.", "It's a statement."],
    ["## Strategic Work In Lisbon Today\n\nWe went to Lisbon in May.", "## Strategic work in Lisbon today\n\nWe went to Lisbon in May."],
    ["## Launch\n\nSales start Monday.\n\nBring a ticket.", "## Launch\n\nSales start Monday.\n\nBring a ticket."],
    ["The temple is blue, symbolizing the Gulf of Mexico.", "The temple is blue, symbolizing the Gulf of Mexico."],
    ["The temple is blue, symbolizing hope and unity.", "The temple is blue."],
    ["Let's explore how it works. It caches data.", "It caches data."],
];
foreach ($strong as [$in, $want]) {
    check('strong', $in, $want, $h->run($in, ['strong' => true])['text'], $failed);
}

// Human mode
$human = [
    ["In order to win, we utilize data.", "To win, we use data."],
    ["It is important to note that the shop is closed.", "The shop is closed."],
    ["However, the plan failed. However, Delhi agreed.", "But the plan failed. However, Delhi agreed."],
    ["It is a good plan and we do not know what it is.", "It's a good plan and we don't know what it is."],
    ["They are here. Tell me who they are and why.", "They're here. Tell me who they are and why."],
    ["This allows users to share. It allows access to files.", "This lets users share. It allows access to files."],
    ["We will not go and cannot pay.", "We won't go and can't pay."],
    ["She made a decision in an approximately correct way, with approximately 40 people.", "She decided in an approximately correct way, with about 40 people."],
    ["They will have the ability to vote. They have the ability to vote.", "They'll have the ability to vote. They can vote."],
    ["The plan, therefore, failed, and it is of paramount importance.", "The plan, therefore, failed, and it's of paramount importance."],
    ["They are not able to vote. Also, it rained.", "They can't vote. Also, it rained."],
    ["They foster a child and foster trust.", "They foster a child and encourage trust."],
    ["The new office opened in March after two years of planning by the council, and it now holds more than four hundred people from six teams.", "The new office opened in March after two years of planning by the council. It now holds more than four hundred people from six teams."],
    ["If the office opens in March after two years of planning by the council, and it holds more than four hundred people, we move in.", "If the office opens in March after two years of planning by the council, and it holds more than four hundred people, we move in."],
    ["He said \"it is important to note that we are able to utilize it\" twice.", "He said \"it is important to note that we are able to utilize it\" twice."],
    ["Run `utilize --it is` now.", "Run `utilize --it is` now."],
    ["There is a red door, therefore, wait.", "There's a red door, therefore, wait."],
    ["Therefore, we left. Thus, it ended.", "So we left. So it ended."],
];
foreach ($human as [$in, $want]) {
    check('human', $in, $want, $h->run($in, ['human' => true])['text'], $failed);
}
check('human reference', '', "To start, it is not safe. However, the team can.", $h->run("In order to start, it is not safe. However, the team is able to.", ['human' => true, 'type' => 'reference'])['text'], $failed);
check('human informal', '', 'i am fine, it is ok lmk', $h->run('i am fine, it is ok lmk', ['human' => true, 'type' => 'informal'])['text'], $failed);
check('human tips', '', ['vague', 'in recent years'], $h->run('It grew in recent years.', ['human' => true])['tips'][0] ?? null, $failed);
check('tips only in human', '', [], $h->run('It grew in recent years.', ['strong' => true])['tips'], $failed);

// Voice matching
$sample = "I don't think it's that hard — honestly we didn't plan much, and the trip was still vibrant and good. We can't complain about any of it.";
$r = $h->run("The town is vibrant and we do not mind — it is a crucial stop — at all.", ['sample' => $sample]);
check('voice', '', "The town is vibrant and we don't mind — it is an important stop — at all.", $r['text'], $failed);
$r = $h->run("We don't help and can't stay, it was crucial.", ['sample' => str_repeat('We do not know what the plan is and we are not sure. ', 3)]);
check('voice long', '', "We do not help and cannot stay, it was important.", $r['text'], $failed);

// File mode: prose only
$md = "---\ntitle: A crucial — plan\n---\n\n# Notes\n\nThis is a crucial step. See [the guide](docs/crucial--a.md).\n\n| crucial | a — b |\n\n\$ delve into --now\n\nC:\\work\\crucial\\x.txt\n\n```\ncrucial — code\n```";
$r = $h->run($md, ['strong' => true]);
check('file', '', str_replace('a crucial step', 'an important step', $md), $r['text'], $failed);
check('sections', '', 2, $r['sections'], $failed);

// Fact check
check('missing', '', ['12', 'https://a.example/x', 'Lisbon'], $h->missing('We saw 12 cats in Lisbon at https://a.example/x today.', 'We saw cats today.'), $failed);

// Every "Before" example in SKILL.md must be caught by its own pattern, and no "After" may trigger anything.
// Patterns SKILL.md marks weak alone must be left when nothing else is wrong.
$skill = str_replace("\r\n", "\n", file_get_contents(__DIR__ . '/../skill/SKILL.md'));
preg_match_all('/^### (\d+)\. [^\n]+\n(.*?)(?=^### |^## |\z)/msu', $skill, $sections, PREG_SET_ORDER);
$weak = [10, 11, 14, 21];
$seen = 0;
foreach ($sections as [, $n, $body]) {
    preg_match_all('/\*\*(Before|After)[^*]*:\*\*\n((?:>[^\n]*\n?)+)/u', $body, $pairs, PREG_SET_ORDER);
    foreach ($pairs as [, $kind, $quote]) {
        $seen++;
        $in = trim(preg_replace('/^> ?/mu', '', $quote));
        $r = $h->run($in, ['type' => $n === '26' ? 'reply' : 'general']);
        $hits = array_merge(array_column($r['edits'], 'pattern'), array_column($r['flags'], 'pattern'));
        if ($kind === 'After') {
            check("After §$n", $in, [], $hits, $failed);
            check("After strong §$n", $in, $in, $h->run($in, ['strong' => true])['text'], $failed);
        } else {
            check("Before §$n", $in, !in_array((int) $n, $weak, true), in_array((int) $n, $hits, true), $failed);
        }
    }
}
check('examples read', '', 82, $seen, $failed);

// PDF
require __DIR__ . '/../src/Pdf.php';
$pdf = Pdf::render("# Café (draft)\n\nIt costs €5 \\ “now”.\n\n- " . str_repeat('word ', 900) . "\n" . str_repeat('x', 400), 'Tést');
preg_match('/startxref\n(\d+)/', $pdf, $m);
check('pdf xref', '', 'xref', substr($pdf, (int) $m[1], 4), $failed);
preg_match_all('/^(\d{10}) 00000 n $/m', $pdf, $m);
foreach ($m[1] as $i => $offset) {
    check('pdf object', '', ($i + 1) . ' 0 obj', substr($pdf, (int) $offset, strlen(($i + 1) . ' 0 obj')), $failed);
}
preg_match_all('/<< \/Length (\d+) >>\nstream\n(.*?)endstream/s', $pdf, $m);
check('pdf lengths', '', array_map('intval', $m[1]), array_map('strlen', $m[2]), $failed);
check('pdf pages', '', true, count($m[1]) > 1, $failed);
check('pdf words', '', 900, substr_count($pdf, 'word'), $failed);
check('pdf long word', '', 400, substr_count($pdf, 'x') - substr_count($pdf, 'xref') - substr_count($pdf, 'Box'), $failed);
check('pdf escapes', '', true, strpos($pdf, '(Caf' . "\xE9" . ' \\(draft\\))') !== false, $failed);
check('pdf unsupported', '', [true, false, false, false], array_map(['Pdf', 'supports'], ['naïve “é” €', 'हिन्दी', '₹500', '🚀']), $failed);

// Running twice must change nothing more.
foreach ($rewrites as [$in, $want]) {
    check('stable', $in, $want, $h->run($want)['text'], $failed);
}

// Large input stays fast.
$t = microtime(true);
$h->run(str_repeat("It's not just a feature; it's a whole new way — truly — to work, ensuring quality. ", 240));
$secs = microtime(true) - $t;
check('speed', '', true, $secs < 3, $failed);
printf("20k characters: %.2fs\n", $secs);

echo $failed ? "$failed failed\n" : "All passed\n";
exit($failed ? 1 : 0);
