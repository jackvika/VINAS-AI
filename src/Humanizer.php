<?php
declare(strict_types=1);

final class Humanizer
{
    public const TYPES = [
        'general' => 'General writing',
        'personal' => 'Personal',
        'reference' => 'Technical or legal',
        'informal' => 'Informal (chat, review)',
        'reply' => 'Reply to someone',
    ];

    private const OPEN = "\u{E000}";
    private const CLOSE = "\u{E001}";
    private const SENTENCE_START = '(?:^[ \t]*|(?<=[.!?]\s)|(?<=[.!?]["\')]\s)|(?<=[-*]\s))';
    private const EMOJI = '(?:[\x{1F000}-\x{1FAFF}\x{2600}-\x{2712}\x{2719}-\x{27BF}\x{2B50}\x{2B55}][\x{FE0F}\x{200D}]*)+';
    // Code, front matter, table rows, commands, URLs, link targets, HTML tags, emails and paths.
    private const CODE = '/\A---\n.*?\n---(?=\n|\z)|```.*?(?:```|\z)|`[^`\n]+`|^\|[^\n]*\|[ \t]*$|^\$ [^\n]+$|(?<=\])\([^)\s]+\)'
        . '|https?:\/\/[^\s<>)\]]+|<\/?[a-zA-Z][^<>\n]*>|\b[\w.+-]+@[\w-]+\.\w+(?:\.\w+)*|\b[A-Za-z]:\\\\[^\s"]+|(?<![\w\/])\.{0,2}\/[\w.-]+\/[\w.\/-]+/msu';
    private const QUOTE = '/"[^"\n]{1,400}"|“[^”\n]{1,400}”/u';
    private const PREDICATE = '/\b(?:is|are|was|were|be|been|looks?|looked|very|so|truly|absolutely|simply|most|more)\s$/iu';
    private const NOT_A_NOUN = 'and|but|or|for|in|as|to|that|because|when|from|with|at|on|if|by|is|are|was|were|than|today|now|here|too|enough';
    private const CALENDAR = '/^(?:January|February|March|April|May|June|July|August|September|October|November|December|(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day|I)$/';
    private const WEAK = [8, 11, 14];

    private array $rules;
    private array $edits = [];
    private array $vault = [];
    private string $type = 'general';
    private string $sample = '';
    private bool $keepDashes = false;
    private bool $keepCurly = false;

    public function __construct()
    {
        $this->rules = require __DIR__ . '/rules.php';
    }

    public function patterns(): array
    {
        return $this->rules['patterns'];
    }

    /**
     * Options: type (a TYPES key), strong (bool), human (bool, implies strong), sample (string), dashes (bool, keep them).
     *
     * @return array{text:string, first:?string, survived:array, edits:array, flags:array, tips:array, missing:array, held:bool, voice:array, sections:int}
     */
    public function run(string $text, array $options = []): array
    {
        $this->edits = [];
        $this->type = isset(self::TYPES[$options['type'] ?? '']) ? $options['type'] : 'general';
        $this->sample = $this->normalise($options['sample'] ?? '');
        $voice = $this->readVoice();
        $this->keepDashes = !empty($options['dashes']) || ($voice['dashes'] ?? false);
        $this->keepCurly = $voice['curly'] ?? false;

        $original = $this->normalise($text);
        $human = !empty($options['human']);
        $result = $this->pass($original, false);
        $first = null;
        $survived = [];

        // SKILL.md's default output: first rewrite, the tells that survived it, final rewrite.
        if ($human || !empty($options['strong'])) {
            $first = $result;
            $survived = $this->flags($result);
            $result = $this->pass($result, true);
        }
        $result = $this->matchContractions($result, $voice);
        $flags = $this->flags($result);

        // SKILL.md: in informal text one lone tell is not enough to act on, except chatbot residue.
        $held = false;
        if ($this->type === 'informal') {
            $found = array_unique(array_merge(array_column($this->edits, 'pattern'), array_column($flags, 'pattern')));
            $found = array_diff($found, [0]);
            $human = $human && count($found) > 1;
            if (count($found) === 1 && !in_array(22, $found, true)) {
                $held = true;
                $this->edits = $flags = $survived = [];
                $first = null;
                $result = $original;
            }
        }
        if ($human) {
            $result = $this->natural($result, $voice);
            $flags = $this->flags($result);
        }

        return [
            'text' => $result,
            'first' => $first,
            'survived' => $survived,
            'edits' => $this->edits,
            'flags' => $flags,
            'tips' => $human ? $this->tips($result) : [],
            'missing' => $this->missing($original, $result),
            'held' => $held,
            'voice' => $voice,
            'sections' => max(1, preg_match_all('/^#{1,6} /mu', $original) + (preg_match('/^#{1,6} /u', $original) ? 0 : 1)),
        ];
    }

    /** Checks finished text without changing it. */
    public function inspect(string $text, string $type = 'general'): array
    {
        $result = $this->run($text, ['type' => $type]);
        $this->edits = [];
        return ['tells' => array_merge(
            array_map(fn($c) => ['pattern' => $c['pattern'], 'text' => $c['before']], $result['edits']),
            array_map(fn($f) => ['pattern' => $f['pattern'], 'text' => $f['text']], $result['flags']),
        )];
    }

    /** Numbers, names and links in $before that are absent from $after. */
    public function missing(string $before, string $after): array
    {
        $lost = [];
        preg_match_all('/\d[\d.,]*\d|\d/', $before, $a);
        preg_match_all('/\d[\d.,]*\d|\d/', $after, $b);
        $lost = array_diff($a[0], $b[0]);

        preg_match_all('/https?:\/\/[^\s<>)\]]+/u', $before, $m);
        $lost = array_merge($lost, array_filter($m[0], fn($url) => strpos($after, $url) === false));

        // A capital that does not open a sentence, line or quotation is likely a name.
        preg_match_all('/(?<=[\p{L}\d,;)]\s)\p{Lu}[\p{L}\d]*(?:[\'’-]\p{L}+)*/u', $before, $m);
        foreach ($m[0] as $name) {
            $name = preg_replace('/[\'’]s$/u', '', $name);
            if (!preg_match('/^I(?:[\'’]|$)/u', $name) && mb_stripos($after, $name) === false) {
                $lost[] = $name;
            }
        }
        return array_values(array_unique($lost));
    }

    /* ---------- passes ---------- */

    private function normalise(string $text): string
    {
        return trim(str_replace(["\r\n", "\r", self::OPEN, self::CLOSE], ["\n", "\n", '', ''], $text));
    }

    private function pass(string $text, bool $strong): string
    {
        $this->vault = [];
        $editsBefore = count($this->edits);

        // A paste wrapped in one pair of quotes is the text itself, not a quotation inside it.
        $wrap = ['', ''];
        $work = $text;
        if (preg_match('/\A(["“])([^"“”]+)(["”])\z/u', $work, $m)) {
            $wrap = [$m[1], $m[3]];
            $work = $m[2];
        }
        $work = $this->protect($work, self::CODE, 'C');
        $work = $this->protect($work, self::QUOTE, 'Q');

        if ($strong) {
            $work = $this->strong($work);
        }
        $work = $this->stockPhrases($work);
        $work = $this->notJust($work);
        $work = $this->inflation($work);
        if ($this->type !== 'personal' || $strong) {
            $work = $this->salesAdjectives($work, $strong);
        }
        $work = $this->leadingEmoji($work);
        $work = $this->repeatedLabels($work);
        $others = $this->edits || $this->flags($this->restore($work, 'QC'), true);
        $work = $this->weak($work, $others);

        $work = $this->restore($work, 'Q');
        if (!$this->keepCurly && ($others || $this->edits)) {
            $work = $this->replace(21, '/[“”]/u', fn() => '"', $work, true);
        }
        $work = $this->restore($work, 'C');
        if (count($this->edits) > $editsBefore) {
            $work = preg_replace(['/[ \t]+$/mu', '/\n{3,}/u'], ['', "\n\n"], $work);
        }
        return $wrap[0] . trim($work) . $wrap[1];
    }

    private function protect(string $text, string $regex, string $kind): string
    {
        return $this->sub($regex, function (array $m) use ($kind): string {
            $this->vault[] = $m[0][0];
            return self::OPEN . $kind . (count($this->vault) - 1) . self::CLOSE;
        }, $text);
    }

    private function restore(string $text, string $kinds): string
    {
        foreach (str_split($kinds) as $kind) {
            $regex = '/' . self::OPEN . $kind . '(\d+)' . self::CLOSE . '/u';
            $text = $this->sub($regex, fn(array $m) => $this->vault[(int) $m[1][0]], $text);
        }
        return $text;
    }

    /* ---------- rewriting ---------- */

    private function stockPhrases(string $t): string
    {
        // "Here is an overview of X. It began..." => "X began..."
        $regex = '/' . self::SENTENCE_START . "(?:here(?:['’]s| is) an? (?:overview|summary|breakdown) of )([^.!?:\\n]{1,80})[.:] (?:It|They) /imu";
        $t = $this->replace(22, $regex, fn(array $m) => $this->ucfirst($m[1][0]) . ' ', $t);
        return $this->strips('strip', $this->deletes('delete', $t));
    }

    private function deletes(string $key, string $t): string
    {
        foreach ($this->rules[$key] as $n => $list) {
            $regex = '/' . self::SENTENCE_START . '(?:' . $this->alt($list) . ')[.!?:]+(?:[ \t]+|(?=\n|\z))/imu';
            $t = $this->replace($n, $regex, fn() => '', $t);
        }
        return $t;
    }

    private function strips(string $key, string $t): string
    {
        foreach ($this->rules[$key] as $n => $list) {
            $regex = '/' . self::SENTENCE_START . '(?:' . $this->alt($list) . ')\s+(\p{L})/imu';
            $t = $this->replace($n, $regex, fn(array $m) => mb_strtoupper($m[1][0]), $t);
        }
        return $t;
    }

    private function swaps(string $key, array $order, string $t): string
    {
        foreach ($order as $n) {
            foreach ($this->rules[$key][$n] as $from => $to) {
                $regex = '/(?<![\w-])(?:(an?) )?(' . $this->apos($from) . ')(?![\w-])/iu';
                $t = $this->replace($n, $regex, function (array $m, string $before) use ($to): ?string {
                    [$article, $hit] = [$m[1][0] ?? '', $m[2][0]];
                    $start = $article === '' && $this->atSentenceStart($before);
                    // A capital inside a sentence is a proper name, and the sample's own words are the writer's.
                    if ((preg_match('/^\p{Lu}/u', $hit) && !$start) || $this->inSample($hit)) {
                        return null;
                    }
                    $new = str_replace(['$1', '$2'], [$m[3][0] ?? '', $m[4][0] ?? ''], $to);
                    $new = $this->likeCase($hit, $new);
                    return $article === '' ? $new : $this->article($article, $new) . ' ' . $new;
                }, $t);
            }
        }
        return $t;
    }

    /** "is not just X; it's Y" and "not only X but Y" => X and Y, so neither claim is lost. */
    private function notJust(string $t): string
    {
        $just = '(?:just|only|merely|simply)';
        $x = '([^,.;!?\n—–]{2,80}?)';
        $then = $this->apos("\\s*(?:[;,.]|[—–]|--)\\s*(?:it|this|that|they)(?:'s|'re| is| are) (?:also )?");
        $merge = fn(array $m) => $m[1][0] . ' ' . $m[2][0] . ' and ';

        $t = $this->replace(1, $this->apos("/\\b(is|are)(?:n't| not) $just $x") . $then . '/iu', $merge, $t);
        $t = $this->replace(1, $this->apos("/((?<=\\w)'s) not $just $x") . $then . '/iu', $merge, $t);

        $aux = 'do|does|did|is|are|was|were|has|have|had|can|could|will|would|should|may|might|must';
        $regex = "/(?<!\\bdo )(?<!\\bdoes )(?<!\\bdid )(?<!\\bcan )(?<!\\bwill )\\b(not) $just (?!(?:$aux)\\b)$x,? but (?:also )?/iu";
        return $this->replace(1, $regex, fn(array $m) => $this->likeCase($m[1][0], $m[2][0]) . ' and ', $t);
    }

    private function inflation(string $t): string
    {
        $regex = '/,\s*(?:marking|representing)\s+an?\s+(?:pivotal|crucial|significant|major|key|defining|important)\s+'
            . '(?:moment|milestone|turning point|shift|step)[^.;!?\n,\d' . self::OPEN . ']*(?=[.!])/iu';
        $t = $this->replace(13, $regex, fn() => '', $t);
        return $this->swaps('swap', [13, 16, 18, 9, 12], $t);
    }

    private function salesAdjectives(string $t, bool $strong): string
    {
        $words = $strong ? $this->rules['hype'] : 'breathtaking|stunning|groundbreaking|renowned|must-visit';
        $comma = $strong ? ',?' : '';
        $regex = "/(?<![\\w-])(?:(an?) )?($words)$comma (?!(?:" . self::NOT_A_NOUN . ")\\b)(\\p{L}[\\w-]*)/u";
        return $this->replace(16, $regex, function (array $m, string $before): ?string {
            $article = $m[1][0] ?? '';
            if (($article === '' && preg_match(self::PREDICATE, $before)) || $this->inSample($m[2][0])) {
                return null;
            }
            return ($article === '' ? '' : $this->article($article, $m[3][0]) . ' ') . $m[3][0];
        }, $t);
    }

    /** Cuts that need a human eye afterwards. Each one is logged. */
    private function strong(string $t): string
    {
        $t = $this->deletes('strong_delete', $t);
        $t = $this->swaps('strong_swap', [1, 3, 4, 16, 18], $t);
        $t = $this->strips('strong_strip', $t);
        $t = $this->mergeFragments($t);
        $t = $this->mergeOpenings($t);

        $t = $this->replace(1, '/, no (guessing|fuss|hassle|surprises|exceptions)(?=[.!])/iu', fn(array $m) => ' without ' . $m[1][0], $t);
        // "ensuring" and "contributing to" often carry a real claim, so they stay flagged.
        $ing = 'highlighting|underscoring|emphasi[sz]ing|reflecting|symboli[sz]ing|cultivating|fostering|showcasing|showing';
        // A clause with a name, number or quotation in it holds a fact, so it stays too.
        $t = $this->replace(15, "/, (?:$ing)\\b[^.;!?\\n\\d\\p{Lu}" . self::OPEN . ']{0,160}(?=[.!])/u', fn() => '', $t);
        $t = $this->replace(16, '/(?<!not )(?<!n\'t )(?<!n’t )(?<!never )\b(truly|absolutely|completely|incredibly) (?=\p{Ll})/u',
            fn(array $m) => $this->inSample($m[1][0]) ? null : '', $t);
        $t = $this->replace(11, '/' . self::SENTENCE_START . 'No ([a-z]+(?: [a-z]+)?) (?:needed|required)(?=[.!])/mu', fn(array $m) => 'You do not need any ' . $m[1][0], $t);
        $t = $this->replace(24, '/^(#{1,6} [^\n]+\n+)[\w\']+ (?:really |truly )?(?:matters|counts|is (?:important|key|everything))\.\n\n/mu', fn(array $m) => $m[1][0], $t);
        $t = $this->sentenceCaseHeadings($t);
        return $this->replace(20, '/^((?:#{1,6} |[-*] ))→\s*/mu', fn(array $m) => $m[1][0], $t);
    }

    /** "It had no X. No Y. No Z." => "It had no X, no Y, and no Z." */
    private function mergeFragments(string $t): string
    {
        $regex = '/([^.!?\n]*\bno [^.!?\n]*)\.((?: No [a-z][^.!?,\n]{1,60}\.){2,})/u';
        return $this->replace(2, $regex, function (array $m): string {
            $items = array_map(fn($s) => $this->lcfirst(trim($s)), array_filter(explode('.', $m[2][0]), 'trim'));
            $last = array_pop($items);
            return $m[1][0] . ', ' . implode(', ', $items) . ', and ' . $last . '.';
        }, $t);
    }

    /** "She noted X. She noted Y. She filed Z." => "She noted X and noted Y. She filed Z." */
    private function mergeOpenings(string $t): string
    {
        $s = '((?:[^\s.!?,;:]+ ){1,10}[^\s.!?,;:]+)\.';
        $regex = "/\\b(She|He|They|It|We|I) $s \\1 $s(?= \\1 )/u";
        return $this->replace(7, $regex, function (array $m): ?string {
            return preg_match('/\b(?:and|or|but)\b/u', $m[2][0]) ? null : "{$m[1][0]} {$m[2][0]} and {$m[3][0]}.";
        }, $t);
    }

    private function sentenceCaseHeadings(string $t): string
    {
        preg_match_all('/(?<=[a-z,;] )\p{Lu}[\p{L}\']+/u', preg_replace('/^#{1,6} .*$/mu', '', $t), $m);
        $names = array_flip($m[0]);
        return $this->replace(20, '/^(#{1,6} )((?:\p{Lu}[\w\'’-]*[ \t]+){2,}\p{Lu}[\w\'’-]*)$/mu', function (array $m) use ($names): string {
            $words = explode(' ', $m[2][0]);
            foreach ($words as $i => $w) {
                $plain = preg_match('/^\p{Lu}[\p{Ll}\'’-]*$/u', $w);
                if ($i > 0 && $plain && !isset($names[$w]) && !preg_match(self::CALENDAR, $w)) {
                    $words[$i] = $this->lcfirst($w);
                }
            }
            return $m[1][0] . implode(' ', $words);
        }, $t);
    }

    private function leadingEmoji(string $t): string
    {
        return $this->replace(20, '/^((?:#{1,6} |[-*] |\d+\. )?)' . self::EMOJI . '\s*/mu', fn(array $m) => $m[1][0], $t);
    }

    /** "- **Performance:** Performance has improved" => "- Performance has improved" */
    private function repeatedLabels(string $t): string
    {
        $regex = '/^([-*] )\*\*([^*\n]{2,40}?):?\*\*:?\s+((?:the )?\2\b)/imu';
        return $this->replace(19, $regex, fn(array $m) => $m[1][0] . $this->ucfirst($m[3][0]), $t);
    }

    /** Patterns SKILL.md marks "weak alone", plus decoration that only matters in volume. */
    private function weak(string $t, bool $others): string
    {
        if ($others || preg_match_all('/\*\*[^*\n]+\*\*/u', $t) > 2) {
            $t = $this->replace(19, '/\*\*([^*\n]+)\*\*/u', fn(array $m) => $m[1][0], $t);
        }
        if (preg_match_all('/^(?:-{3,}|\*{3,}|_{3,})$/mu', $t) > 1) {
            $t = $this->replace(20, '/^(?:-{3,}|\*{3,}|_{3,})\n?$/mu', fn() => '', $t);
        }
        if ($others) {
            $t = $this->replace(20, '/[ \t]*' . self::EMOJI . '/u', fn() => '', $t);
            $regex = '/\b((?:is|are|was|were) )(' . $this->rules['hyphens'] . ')(?=[.,;!?]|\s+and\b|\s*$)/imu';
            $t = $this->replace(10, $regex, fn(array $m) => $m[1][0] . str_replace('-', ' ', $m[2][0]), $t);
        }
        if (!$this->keepDashes && ($others || preg_match_all('/—|\s–\s|\s--\s/u', $t) > 1)) {
            $t = implode("\n", array_map([$this, 'dashes'], explode("\n", $t)));
        }
        return $t;
    }

    private function dashes(string $line): string
    {
        // Attributions, table rows and rules keep their dashes.
        if (!preg_match('/[—–]|\s--\s/u', $line) || preg_match('/^\s*(?:[—–]|\||-{3,}$)/u', $line)) {
            return $line;
        }
        $line = $this->replace(8, '/(?<=[\p{L}\d])–(?=[\p{L}\d])|(?<=\d)\s?[—–]\s?(?=\d)/u', fn() => '-', $line);

        $label = '/^(#{1,6} .+?|[-*] (?:\S+ ){0,3}\S+?)\s*(?:—|\s–|\s--)\s*(\S.*)$/u';
        if (preg_match($label, $line, $m) && !preg_match('/[—–]/u', $m[2])) {
            $new = $m[1] . ': ' . $m[2];
            $this->log(8, $line, $new);
            return $new;
        }

        $out = '';
        foreach (preg_split('/((?<=[.!?])\s+(?![—–-]))/u', $line, -1, PREG_SPLIT_DELIM_CAPTURE) as $sentence) {
            $parts = preg_split('/\s*—\s*|\s+–\s+|\s+--\s+/u', $sentence);
            if (count($parts) < 2 || in_array('', array_map('trim', $parts), true)) {
                $out .= $sentence;
                continue;
            }
            if (count($parts) === 2) {
                $new = $this->join($parts[0], $parts[1]);
            } elseif (count($parts) === 3) {
                [$a, $b, $c] = $parts;
                $new = preg_match('/[,;!?]/u', $b) ? "$a ($b) $c" : "$a, $b, $c";
            } else {
                $new = implode(', ', $parts);
            }
            $this->log(8, $sentence, $new);
            $out .= $new;
        }
        return $out;
    }

    private function join(string $a, string $b): string
    {
        if (preg_match('/[.!?:;,]$/u', $a)) {
            return "$a $b";
        }
        $subordinate = '/^\W*(?:when|if|while|because|since|although|though|with|after|before|once|as|from|to|in|for)\b/iu';
        $clause = $this->apos("/^(?:it|it's|this is|that's|that is|they|they're|we|we're|you|you're|I|I'm|he|she|there's|there are)\\b/iu");
        return preg_match($clause, $b) && !preg_match($subordinate, $a)
            ? "$a. " . $this->ucfirst($b)
            : "$a, $b";
    }

    /* ---------- voice ---------- */

    private function readVoice(): array
    {
        $words = preg_match_all('/[\p{L}\d][\p{L}\d\'’-]*/u', $this->sample);
        if ($words < 20) {
            return [];
        }
        $short = preg_match_all('/\b\p{L}+n[\'’]t\b/iu', $this->sample);
        $long = preg_match_all('/\b(?:do|does|did|is|are|was|were|has|have|had|could|would|should|can|will) ?not\b/iu', $this->sample);
        return [
            'words' => $words,
            'sentence' => $this->averageSentence($this->sample),
            'dashes' => (bool) preg_match('/—|\s–\s|\s--\s/u', $this->sample),
            'curly' => (bool) preg_match('/[“”]/u', $this->sample),
            'contractions' => $short > 0 && $long === 0 ? 'short' : ($long > 0 && $short === 0 ? 'long' : 'mixed'),
        ];
    }

    public function averageSentence(string $text): int
    {
        $sentences = array_filter(preg_split('/(?<=[.!?])\s+|\n+/u', trim($text)), fn($s) => preg_match('/\p{L}/u', $s));
        $words = preg_match_all('/[\p{L}\d][\p{L}\d\'’-]*/u', $text);
        return $sentences ? (int) round($words / count($sentences)) : 0;
    }

    private function matchContractions(string $t, array $voice): string
    {
        if (!in_array($voice['contractions'] ?? '', ['short', 'long'], true)) {
            return $t;
        }
        $this->vault = [];
        $t = $this->protect($this->protect($t, self::CODE, 'C'), self::QUOTE, 'Q');
        if ($voice['contractions'] === 'short') {
            $t = $this->replace(0, '/\b(do|does|did|is|are|was|were|has|have|had|could|would|should) not\b(?! only| just)/iu', fn(array $m) => $m[1][0] . "n't", $t);
            $t = $this->replace(0, '/\b(c)an ?not\b(?! only| just)/iu', fn(array $m) => $m[1][0] . "an't", $t);
            $t = $this->replace(0, '/\b(w)ill not\b/iu', fn(array $m) => $m[1][0] . "on't", $t);
        } else {
            $t = $this->replace(0, "/\\b(c)an['’]t\\b(?=\\s)/iu", fn(array $m) => $m[1][0] . 'annot', $t);
            $t = $this->replace(0, "/\\b(w)on['’]t\\b(?=\\s)/iu", fn(array $m) => $m[1][0] . 'ill not', $t);
            // A question ("Don't you...") cannot simply be expanded.
            $t = $this->replace(0, "/\\b(do|does|did|is|are|was|were|has|have|had|could|would|should)n['’]t\\b(?= (?!(?:you|we|they|he|she|it|I)\\b))/u", fn(array $m) => $m[1][0] . ' not', $t);
        }
        return $this->restore($t, 'QC');
    }

    /* ---------- human mode ---------- */

    private function natural(string $text, array $voice): string
    {
        $this->vault = [];
        $t = $this->protect($this->protect($text, self::CODE, 'C'), self::QUOTE, 'Q');
        $t = $this->strips('human_strip', $t);
        $t = $this->swaps('human_swap', [27], $t);
        if ($this->type !== 'reference') {
            foreach ($this->rules['human_open'] as $from => $to) {
                $t = $this->replace(28, '/' . self::SENTENCE_START . $from . '(?= \p{L})/imu', fn() => $to, $t);
            }
            $t = $this->plainHowever($t);
            if (($voice['contractions'] ?? '') !== 'long') {
                $t = $this->contract($t);
            }
        }
        $t = implode("\n", array_map([$this, 'breakLong'], explode("\n", $t)));
        return $this->restore($t, 'QC');
    }

    /** "However, the plan" => "But the plan", only where the next word is safe to put in lower case. */
    private function plainHowever(string $t): string
    {
        $next = 'the|it|this|that|they|we|you|he|she|a|an|these|those|there|many|some|most|our|their|its|his|her|your|not|if|when';
        return $this->replace(28, '/' . self::SENTENCE_START . "However, ((?:$next)\\b)/mu", fn(array $m) => 'But ' . $this->lcfirst($m[1][0]), $t);
    }

    private function contract(string $t): string
    {
        $verbs = 'do|does|did|is|are|was|were|has|have|had|could|would|should';
        $t = $this->replace(29, "/\\b($verbs) not\\b(?! only| just)/iu", fn(array $m) => $m[1][0] . "n't", $t);
        $t = $this->replace(29, '/\b(c)an ?not\b(?! only| just)/iu', fn(array $m) => $m[1][0] . "an't", $t);
        $t = $this->replace(29, '/\b(w)ill not\b/iu', fn(array $m) => $m[1][0] . "on't", $t);
        // "what it is", "as they are" and a verb at the end of a clause keep the full form.
        $free = '(?<!what )(?<!where )(?<!how )(?<!who )(?<!why )(?<!when )(?<!as )(?<!than )(?<!whatever )(?<!wherever )';
        $after = '(?= (?!(?:and|or|but|nor|today|now|because|if|when|that)\b)\p{Ll})';
        $t = $this->replace(29, "/$free\\b(it|there) is$after/iu", fn(array $m) => $m[1][0] . "'s", $t);
        $t = $this->replace(29, '/' . self::SENTENCE_START . "(That) is(?= (?:a|an|the|why|how|what|where|not|because)\\b)/mu", fn(array $m) => $m[1][0] . "'s", $t);
        $t = $this->replace(29, "/$free\\b(we|you|they) are$after/iu", fn(array $m) => $m[1][0] . "'re", $t);
        $t = $this->replace(29, "/$free\\bI am$after/u", fn() => "I'm", $t);
        $t = $this->replace(29, "/\\b(I|we|you|they) will(?= \\p{Ll})/iu", fn(array $m) => $m[1][0] . "'ll", $t);
        return $this->replace(29, "/\\b(I|we|you|they) have(?= (?:been|already|seen|made|done|never|always|become|found|learned|used)\\b)/iu", fn(array $m) => $m[1][0] . "'ve", $t);
    }

    /** Splits one long sentence at a joint where both halves stand alone. */
    private function breakLong(string $line): string
    {
        if (preg_match('/^\s*(?:#|>|\||[-*] |\d+\. )/u', $line)) {
            return $line;
        }
        $out = '';
        foreach (preg_split('/((?<=[.!?])\s+)/u', $line, -1, PREG_SPLIT_DELIM_CAPTURE) as $sentence) {
            $new = $this->splitSentence($sentence);
            if ($new !== $sentence) {
                $this->log(30, $sentence, $new);
            }
            $out .= $new;
        }
        return $out;
    }

    private function splitSentence(string $s): string
    {
        $subject = '(?:it|they|we|you|he|she|I|there|this|these|those)';
        if ($this->words($s) < 20 || preg_match('/^\W*(?:when|if|while|because|since|although|though|once|unless|whether|not|whereas|what|how)\b/iu', $s)) {
            return $s;
        }
        preg_match_all("/, (and|but|so) (?=$subject\\b)|; (?=$subject\\b)|, which means (?:that )?/u", $s, $m, PREG_OFFSET_CAPTURE);
        foreach ($m[0] as $i => [$hit, $at]) {
            $left = substr($s, 0, $at);
            $right = substr($s, $at + strlen($hit));
            if ($this->words($left) < 7 || $this->words($right) < 6 || substr_count($left, '(') !== substr_count($left, ')')) {
                continue;
            }
            $joint = $m[1][$i][0] ?? '';
            if (strpos($hit, 'which') !== false) {
                return "$left. That means $right";
            }
            return $joint === 'but' || $joint === 'so' ? "$left. " . $this->ucfirst($joint) . " $right" : "$left. " . $this->ucfirst($right);
        }
        return $s;
    }

    /** Things only the writer can do. Nothing here changes the text. */
    private function tips(string $text): array
    {
        $plain = preg_replace([self::CODE, self::QUOTE], ' ', $text);
        $tips = [];
        foreach ($this->find(0, '/(?<![\w-])(?:' . $this->alt($this->rules['vague']) . ')(?![\w-])/iu', $plain) as $hit) {
            $tips[] = ['vague', $hit['text']];
        }
        $run = [];
        foreach ($this->sentences($plain) as $s) {
            $n = $this->words($s);
            if ($n > 30) {
                $tips[] = ['long', trim($s)];
            }
            $run = $n >= 6 && $run && abs($n - $this->words($run[0])) <= 2 ? array_merge($run, [$s]) : [$s];
            if (count($run) === 4) {
                $tips[] = ['even', trim($run[0])];
                $run = [];
            }
        }
        if ($this->words($plain) >= 60) {
            if (!preg_match('/\d|(?<=[\p{Ll},;] )\p{Lu}\p{L}+/u', $plain)) {
                $tips[] = ['detail', ''];
            }
            if ($this->type === 'personal' && !preg_match('/\b(?:I|we|my|our|me|us)\b/iu', $plain)) {
                $tips[] = ['self', ''];
            }
        }
        return array_slice($tips, 0, 10);
    }

    /** Spread of sentence lengths, and Flesch reading ease from 0 to 100. */
    public function metrics(string $text): array
    {
        $lengths = array_map([$this, 'words'], $this->sentences($text));
        $count = count($lengths);
        $words = array_sum($lengths);
        if ($count === 0 || $words === 0) {
            return ['variety' => 0, 'ease' => 0];
        }
        $mean = $words / $count;
        $spread = sqrt(array_sum(array_map(fn($n) => ($n - $mean) ** 2, $lengths)) / $count);
        $syllables = 0;
        preg_match_all('/[A-Za-z]+/', $text, $m);
        foreach ($m[0] as $word) {
            $syllables += max(1, preg_match_all('/[aeiouy]+/i', preg_replace('/(?<=[^aeiouyl])e$/i', '', $word)));
        }
        $ease = 206.835 - 1.015 * $mean - 84.6 * $syllables / max(1, count($m[0]));
        return ['variety' => (int) round($spread), 'ease' => (int) round(max(0, min(100, $ease)))];
    }

    private function sentences(string $text): array
    {
        return array_values(array_filter(preg_split('/(?<=[.!?])\s+|\n+/u', trim($text)), fn($s) => $this->words($s) > 0));
    }

    private function words(string $s): int
    {
        return preg_match_all('/[\p{L}\d][\p{L}\d\'’-]*/u', $s);
    }

    private function inSample(string $phrase): bool
    {
        return $this->sample !== '' && mb_stripos($this->sample, $phrase) !== false;
    }

    /* ---------- flags ---------- */

    private function flags(string $text, ?bool $keepDashes = null): array
    {
        $keepDashes ??= $this->keepDashes;
        $found = [];
        foreach ($this->rules['flag'] as $n => $list) {
            foreach ($list as $p) {
                // Patterns that open with a comma or a lookbehind follow a word; the rest start one.
                $start = preg_match('/^(?:,|\(\?<)/', $p) ? '' : '(?<![\w-])';
                $found = array_merge($found, $this->find($n, "/$start(?:" . $this->apos($p) . ')(?![\w-])/iu', $text));
            }
        }
        $item = '\p{L}[\w-]*(?: [\w-]+)?';
        $triads = $this->find(6, "/\\b$item, $item,? and $item(?=[.!?;,])/u", $text);
        if (count($triads) > 1) {
            $found = array_merge($found, $triads);
        }
        $word = '((?!(?:The|A|An)\b)\p{Lu}[\w\']*)\b[^.!?\n]*[.!?]';
        $found = array_merge(
            $found,
            $this->find(2, '/(?:(?<=[.!?] )|^)No [a-z][^.!?,\n]{1,60}\.(?: No [a-z][^.!?,\n]{1,60}\.)+/mu', $text),
            $this->find(6, '/\b(?:An?|Every|Some) [\w-]+ (\w+) [^.!?\n]*\. (?:An?|Every|Some) [\w-]+ \1 [^.!?\n]*\. (?:An?|Every|Some) [\w-]+ \1 [^.!?\n]*\./u', $text),
            $this->find(7, "/(?:^|(?<=[.!?]\\s))$word\\s+\\1\\b[^.!?\\n]*[.!?]\\s+\\1\\b[^.!?\\n]*[.!?]/mu", $text),
            $this->find(20, '/^#{1,6} (?:\p{Lu}[\w\'’-]*[ \t]+){2,}\p{Lu}[\w\'’-]*$/mu', $text),
            $this->find(24, '/^#{1,6} [^\n]+\n+(?:[\w\']+ ){1,4}[\w\']+\.(?=\n\n)/mu', $text),
            $this->repeatedLines($text),
            $this->type === 'reply' ? $this->lateDecision($text) : [],
        );
        $dashes = $this->find(8, '/—/u', $text);
        if (!$keepDashes && count($dashes) > 1) {
            $found = array_merge($found, $dashes);
        }
        if ($this->type === 'reference') {
            // Passive voice and "robust" are ordinary in technical writing.
            $found = array_filter($found, fn($f) => $f['pattern'] !== 11 && strcasecmp($f['text'], 'robust') !== 0);
        }

        $skip = $this->protectedRanges($text);
        usort($found, fn($a, $b) => [$a['start'], -$a['end']] <=> [$b['start'], -$b['end']]);
        $kept = [];
        $end = 0;
        foreach ($found as $flag) {
            foreach ($skip as [$from, $to]) {
                if ($flag['start'] >= $from && $flag['start'] < $to) {
                    continue 2;
                }
            }
            if ($flag['start'] >= $end && !(in_array($flag['pattern'], [12, 16], true) && $this->inSample($flag['text']))) {
                $kept[] = $flag;
                $end = $flag['end'];
            }
        }
        // "Weak alone": these count only next to other tells.
        $strong = array_filter($kept, fn($f) => !in_array($f['pattern'], self::WEAK, true));
        $edited = array_filter($this->edits, fn($c) => $c['pattern'] > 0 && $c['pattern'] < 27);
        return $strong || $edited ? $kept : [];
    }

    /** The same one-line paragraph used as a closer more than once. */
    private function repeatedLines(string $text): array
    {
        $lines = array_filter(explode("\n", $text), fn($l) => preg_match('/^\p{Lu}[^|`]{3,80}[.!]$/u', $l));
        $found = [];
        foreach (array_filter(array_count_values($lines), fn($n) => $n > 1) as $line => $n) {
            $found = array_merge($found, $this->find(2, '/^' . preg_quote((string) $line, '/') . '$/mu', $text));
        }
        return $found;
    }

    /** A reply whose decision sits after a long run of background. */
    private function lateDecision(string $text): array
    {
        $decision = $this->apos("/[^.!?\\n]*\\b(?:I'd rather|I would rather|I'd prefer|let's|I'll|I will|I suggest|I recommend|we should|my vote|fine to (?:keep|merge|ship)|go ahead)\\b[^.!?\\n]*[.!?]/iu");
        if (!preg_match($decision, $text, $m, PREG_OFFSET_CAPTURE)) {
            return [];
        }
        [$hit, $at] = $m[0];
        $before = preg_match_all('/[\p{L}\d][\p{L}\d\'’-]*/u', substr($text, 0, $at));
        $trim = strlen($hit) - strlen(ltrim($hit));
        return $before < 40 ? [] : [['pattern' => 26, 'start' => $at + $trim, 'end' => $at + strlen($hit), 'text' => ltrim($hit)]];
    }

    private function find(int $pattern, string $regex, string $text): array
    {
        if (preg_match_all($regex, $text, $m, PREG_OFFSET_CAPTURE) === false) {
            throw new RuntimeException("Pattern $pattern: " . preg_last_error_msg());
        }
        $out = [];
        foreach ($m[0] as [$hit, $at]) {
            $lead = strspn($hit, ", \n");
            $hit = trim($hit, ", \n");
            $out[] = ['pattern' => $pattern, 'start' => $at + $lead, 'end' => $at + $lead + strlen($hit), 'text' => $hit];
        }
        return $out;
    }

    private function protectedRanges(string $text): array
    {
        $ranges = [];
        foreach ([self::CODE, self::QUOTE] as $regex) {
            preg_match_all($regex, $text, $m, PREG_OFFSET_CAPTURE);
            foreach ($m[0] as [$hit, $at]) {
                if (strlen($hit) < strlen($text)) {
                    $ranges[] = [$at, $at + strlen($hit)];
                }
            }
        }
        return $ranges;
    }

    /* ---------- helpers ---------- */

    /** Runs a replacement, logging each change. The callback returns null to leave a match alone. */
    private function replace(int $pattern, string $regex, callable $fn, string $text, bool $logOnce = false): string
    {
        $logged = false;
        return $this->sub($regex, function (array $m) use ($pattern, $fn, $text, $logOnce, &$logged): string {
            [$hit, $at] = $m[0];
            $new = $fn($m, substr($text, 0, $at));
            if ($new === null || $new === $hit) {
                return $hit;
            }
            if (!$logOnce || !$logged) {
                $this->log($pattern, $hit, $new);
                $logged = true;
            }
            return $new;
        }, $text);
    }

    private function sub(string $regex, callable $fn, string $text): string
    {
        $out = preg_replace_callback($regex, $fn, $text, -1, $count, PREG_OFFSET_CAPTURE);
        if ($out === null) {
            throw new RuntimeException('Pattern failed: ' . preg_last_error_msg());
        }
        return $out;
    }

    private function log(int $pattern, string $before, string $after): void
    {
        $this->edits[] = [
            'pattern' => $pattern,
            'before' => trim($this->restore($before, 'QC')),
            'after' => trim($this->restore($after, 'QC')),
        ];
    }

    private function alt(array $list): string
    {
        return $this->apos(implode('|', $list));
    }

    private function apos(string $pattern): string
    {
        return str_replace("'", "['’]", $pattern);
    }

    private function atSentenceStart(string $before): bool
    {
        return (bool) preg_match('/(?:^|\n|[.!?:]["\')]?\s+|[-*]\s+)$/u', $before);
    }

    private function article(string $old, string $next): string
    {
        $vowel = preg_match('/^(?:[aeiou]|hour|honest)/i', $next) && !preg_match('/^(?:uni|use|one\b|eu)/i', $next);
        return $this->likeCase($old, $vowel ? 'an' : 'a');
    }

    private function likeCase(string $old, string $new): string
    {
        return preg_match('/^\p{Lu}/u', $old) ? $this->ucfirst($new) : $new;
    }

    private function ucfirst(string $s): string
    {
        return mb_strtoupper(mb_substr($s, 0, 1)) . mb_substr($s, 1);
    }

    private function lcfirst(string $s): string
    {
        return mb_strtolower(mb_substr($s, 0, 1)) . mb_substr($s, 1);
    }
}
