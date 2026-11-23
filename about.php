<?php
declare(strict_types=1);
require_once __DIR__ . '/src/page.php';

$examples = examples();
pageTop('How it works', 'What the rules look for, what this site does with them, and where its limits are.');
?>
    <section>
        <h2>Why AI text sounds the way it does</h2>
        <p>A language model writes whatever is most likely to come next, so it makes the choice that fits the widest range of readers. A person chooses for one reader and one subject. Each of the <a href="guide.php">26 patterns</a> is a form of that default choice.</p>
    </section>

    <section>
        <h2>What happens to your text</h2>
        <ul>
            <li><strong>Protected first:</strong> quotations, code, links, paths, commands, tables and front matter are set aside. In the result, curly quotation marks may become straight.</li>
            <li><strong>First rewrite:</strong> stock phrases, chatbot leftovers, "not just X but Y", inflated words, sales words, decoration and dashes are fixed.</li>
            <li><strong>Strong mode, second rewrite:</strong> hype, staged openers, empty clauses and clipped fragments are cut or merged. Every cut is listed.</li>
            <li><strong>Fact check:</strong> you get a warning if a number, link or likely name from your text is missing.</li>
            <li><strong>The rest is highlighted:</strong> some tells need your judgment, such as who the "experts" are.</li>
        </ul>
    </section>

    <section>
        <h2>Kinds of text</h2>
        <ul>
            <li><strong>General:</strong> articles, posts and marketing.</li>
            <li><strong>Personal:</strong> Careful mode leaves your opinion words alone and only highlights them.</li>
            <li><strong>Technical, legal or reference:</strong> missing subjects and words such as "robust" are left alone.</li>
            <li><strong>Informal:</strong> chat messages and angry reviews stay as they are unless two unrelated tells appear. Chatbot leftovers always go.</li>
            <li><strong>Reply:</strong> also checks whether your decision comes after background the reader already has.</li>
        </ul>
    </section>

    <section id="limits">
        <h2>Limits</h2>
        <ul>
            <li>No tool can make AI text "100% human written", and this site does not certify who wrote anything.</li>
            <li>It edits for human readers. AI detectors may still flag the result.</li>
            <li>It matches known phrasings, so it misses tells worded another way. It does not rebuild whole paragraphs.</li>
            <li>It works on English only.</li>
        </ul>
    </section>

    <section>
        <h2>Examples</h2>
        <p>These are the original project's own examples. Its "after" versions were written with an AI model, so they go further than this site can.</p>
        <?php foreach ($examples as $i => $x): ?>
        <details>
            <summary>Example <?= $i + 1 ?></summary>
            <h3>Before</h3><blockquote><?= markdown($x['before']) ?></blockquote>
            <h3>After, by the original project</h3><blockquote><?= markdown($x['after']) ?></blockquote>
            <p><a href="index.php?example=<?= $i ?>">Try it here</a></p>
        </details>
        <?php endforeach ?>
    </section>

    <section>
        <h2>The original project</h2>
        <p><a href="https://github.com/blader/humanizer">blader/humanizer</a> is a free skill for AI agents. In Claude Code, install it with:</p>
        <pre>/plugin marketplace add blader/humanizer
/plugin install humanizer@humanizer</pre>
        <p>For other agents:</p>
        <pre>npx skills add blader/humanizer --global --agent '*'</pre>
        <p>Then run <code>/humanizer</code> and paste your text. Its files are here too: <a href="skill/SKILL.md">rules</a>, <a href="skill/README.md">README</a>, <a href="skill/CHANGELOG.md">changelog</a> and <a href="skill/LICENSE.txt">license</a>.</p>
        <details>
            <summary>Version history</summary>
            <?= markdown(preg_replace('/^# Changelog\n/', '', preg_replace('/^(## [^\n]+)\n(?!\n)/m', "$1\n\n", skillFile('CHANGELOG.md')))) ?>
        </details>
    </section>

    <section>
        <h2>Sources</h2>
        <ul>
            <li><a href="https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing">Wikipedia: Signs of AI writing</a>, maintained by WikiProject AI Cleanup, is the source of the pattern list.</li>
            <li>El Attar, Dönmez, Maurer and Falenska, "A Systematic Analysis of Linguistic Features in AI-Generated English Text Detection Across Domains and Models" (<a href="https://arxiv.org/abs/2606.04177">arXiv:2606.04177</a>, 2026), is the source of the caution that most signals change with the model and the kind of text.</li>
        </ul>
    </section>
<?php pageBottom();
