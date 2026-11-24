// The rewriting engine. Rules are in rules.js; tests are in tests/index.html.
class Humanizer {
    constructor(rules) {
        this.rules = rules;
        this.edits = [];
        this.vault = [];
        this.type = 'general';
        this.sample = '';
        this.keepDashes = false;
        this.keepCurly = false;
        this.fullForms = false;
    }

    /** Options: type, strong (bool), human (bool, implies strong), sample (string), dashes (bool, keep them), fullForms (bool, no contractions). */
    run(text, options = {}) {
        this.edits = [];
        this.type = Humanizer.TYPES.includes(options.type) ? options.type : 'general';
        this.sample = this.normalise(options.sample || '');
        const voice = this.readVoice();
        this.fullForms = Boolean(options.fullForms);
        this.keepDashes = Boolean(options.dashes) || Boolean(voice && voice.dashes);
        this.keepCurly = Boolean(voice && voice.curly);

        const original = this.normalise(text);
        let human = Boolean(options.human);
        let result = this.pass(original, false);
        let first = null;
        let survived = [];
        if (human || options.strong) {
            first = result;
            survived = this.flags(result);
            result = this.pass(result, true);
        }
        result = this.matchContractions(result, this.fullForms ? { contractions: 'long' } : voice);
        let flags = this.flags(result);

        let held = false;
        if (this.type === 'informal') {
            const found = new Set([...this.edits, ...flags].map((x) => x.pattern));
            found.delete(0);
            human = human && found.size > 1;
            if (found.size === 1 && !found.has(22)) {
                held = true;
                this.edits = [];
                flags = [];
                survived = [];
                first = null;
                result = original;
            }
        }
        if (human) {
            result = this.natural(result, voice);
            if (this.fullForms) result = result.replace(/, so it['’]s /g, ', so it is ').replace(/, so they['’]re /g, ', so they are ');
            flags = this.flags(result);
        }
        const headings = original.match(rx('^#{1,6} ', 'gm')) || [];
        return {
            text: result, first, survived, edits: this.edits, flags, tips: human ? this.tips(result) : [],
            missing: this.missing(original, result), held, voice,
            sections: Math.max(1, headings.length + (/^#{1,6} /.test(original) ? 0 : 1)),
        };
    }

    inspect(text, type = 'general') {
        const r = this.run(text, { type });
        this.edits = [];
        return [
            ...r.edits.map((c) => ({ pattern: c.pattern, text: c.before })),
            ...r.flags.map((f) => ({ pattern: f.pattern, text: f.text })),
        ];
    }

    missing(before, after) {
        const numbers = (s) => s.match(/[0-9][0-9.,]*[0-9]|[0-9]/g) || [];
        const kept = new Set(numbers(after));
        const lost = numbers(before).filter((n) => !kept.has(n));
        for (const url of before.match(rx('https?:\\/\\/[^\\s<>)\\]]+', 'g')) || []) {
            if (!after.includes(url)) lost.push(url);
        }
        const lower = after.toLowerCase();
        for (const hit of before.match(rx("(?<=[\\p{L}\\d,;)] )\\p{Lu}[\\p{L}\\d]*(?:['’-]\\p{L}+)*", 'g')) || []) {
            const name = hit.replace(/['’]s$/u, '');
            if (!/^I(?:['’]|$)/u.test(name) && !name.toLowerCase().split('-').every((part) => lower.includes(part))) lost.push(name);
        }
        return [...new Set(lost)];
    }

    /* ---------- passes ---------- */

    normalise(text) {
        return trim(text.replace(/\r\n?/g, '\n').replace(/[]/g, ''));
    }

    pass(text, strong) {
        this.vault = [];
        const editsBefore = this.edits.length;
        let wrap = ['', ''];
        let work = text;
        const m = /^(["“])([^"“”]+)(["”])$/u.exec(work);
        if (m) {
            wrap = [m[1], m[3]];
            work = m[2];
        }
        work = this.protect(work, CODE, 'C');
        work = this.protect(work, QUOTE, 'Q');

        if (strong) work = this.strong(work);
        work = this.stockPhrases(work);
        work = this.notJust(work);
        work = this.inflation(work);
        if (this.type !== 'personal' || strong) work = this.salesAdjectives(work, strong);
        work = this.leadingEmoji(work);
        work = this.repeatedLabels(work);
        const others = this.edits.length > 0 || this.flags(this.restore(work, 'QC'), true).length > 0;
        work = this.weak(work, others);

        work = this.restore(work, 'Q');
        if (!this.keepCurly && (others || this.edits.length > 0)) {
            work = this.replace(21, rx('[“”]', 'g'), () => '"', work, true);
        }
        work = this.restore(work, 'C');
        if (this.edits.length > editsBefore) {
            work = work.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
        }
        return wrap[0] + trim(work) + wrap[1];
    }

    protect(text, regex, kind) {
        return text.replace(regex, (hit) => {
            this.vault.push(hit);
            return OPEN + kind + (this.vault.length - 1) + CLOSE;
        });
    }

    restore(text, kinds) {
        for (const kind of kinds) {
            text = text.replace(new RegExp(OPEN + kind + '([0-9]+)' + CLOSE, 'g'), (_, i) => this.vault[Number(i)]);
        }
        return text;
    }

    /* ---------- rewriting ---------- */

    stockPhrases(t) {
        const regex = rx(SENTENCE_START + "(?:here(?:['’]s| is) an? (?:overview|summary|breakdown) of )([^.!?:\\n]{1,80})[.:] (?:It|They) ", 'gim');
        t = this.replace(22, regex, (m) => ucfirst(m[1]) + ' ', t);
        return this.strips('strip', this.deletes('delete', t));
    }

    deletes(key, t) {
        for (const [n, list] of entries(this.rules[key])) {
            t = this.replace(n, rx(SENTENCE_START + '(?:' + alt(list) + ')[.!?:]+(?:[ \\t]+|(?=\\n|\\z))', 'gim'), () => '', t);
        }
        return t;
    }

    strips(key, t) {
        for (const [n, list] of entries(this.rules[key])) {
            t = this.replace(n, rx(SENTENCE_START + '(?:' + alt(list) + ')\\s+(\\p{L})', 'gim'), (m) => m[1].toUpperCase(), t);
        }
        return t;
    }

    swaps(key, order, t) {
        for (const n of order) {
            for (const [from, to] of Object.entries(this.rules[key][n])) {
                t = this.replace(n, rx('(?<![\\w-])(?:(an?) )?(' + apos(from) + ')(?![\\w-])', 'gi'), (m, before) => {
                    const article = m[1] || '';
                    const hit = m[2];
                    const start = article === '' && atSentenceStart(before);
                    if ((/^\p{Lu}/u.test(hit) && !start) || this.inSample(hit)) return null;
                    const next = likeCase(hit, to.split('$1').join(m[3] || '').split('$2').join(m[4] || ''));
                    return article === '' ? next : articleFor(article, next) + ' ' + next;
                }, t);
            }
        }
        return t;
    }

    notJust(t) {
        const just = '(?:just|only|merely|simply)';
        const x = '([^,.;!?\\n—–]{2,80}?)';
        const then = apos("\\s*(?:[;,.]|[—–]|--)\\s*(?:it|this|that|they|he|she)(?:'s|'re| is| are| was| were) (?:also )?");
        const merge = (m) => m[1] + ' ' + m[2] + ' and ';
        t = this.replace(1, rx(apos(`\\b(is|are|was|were)(?:n't| not) ${just} ${x}`) + then, 'gi'), merge, t);
        t = this.replace(1, rx(apos(`((?<=\\w)'s) not ${just} ${x}`) + then, 'gi'), merge, t);
        t = this.replace(1, rx(`\\b(is|are|was|were) more than (?:just )?(?=(?:an?|the) )${x}` + then, 'gi'), merge, t);
        const aux = 'do|does|did|is|are|was|were|has|have|had|can|could|will|would|should|may|might|must';
        const regex = `(?<!\\bdo )(?<!\\bdoes )(?<!\\bdid )(?<!\\bcan )(?<!\\bwill )\\b(not) ${just} (?!(?:${aux})\\b)${x},? but (?:also )?`;
        return this.replace(1, rx(regex, 'gi'), (m) => likeCase(m[1], m[2]) + ' and ', t);
    }

    inflation(t) {
        const regex = ',\\s*(?:marking|representing)\\s+an?\\s+(?:pivotal|crucial|significant|major|key|defining|important)\\s+'
            + '(?:moment|milestone|turning point|shift|step)[^.;!?\\n,\\d' + OPEN + ']*(?=[.!])';
        t = this.replace(13, rx(regex, 'gi'), () => '', t);
        return this.swaps('swap', [13, 16, 18, 9, 12], t);
    }

    /** Swaps hype for a plain word, so the claim stays: "stunning views" => "beautiful views". */
    salesAdjectives(t, strong) {
        // In personal writing the general list holds the writer's opinions.
        const plain = { ...this.rules.hype, ...(strong ? this.rules.hype_strong : {}), ...(strong && this.type !== 'personal' ? this.rules.hype_general : {}) };
        const regex = rx(`(?<![\\w-])(?:(an?) )?(${Object.keys(plain).join('|')})(,?) (?!(?:${NOT_A_NOUN})\\b)(\\p{L}[\\w-]*)`, 'g');
        return this.replace(16, regex, (m, before) => {
            const [, article = '', hype, comma, noun] = m;
            if ((article === '' && rx(PREDICATE, 'i').test(before)) || this.inSample(hype)) return null;
            // "the breathtaking region of Gonder" names a place; praise there says nothing.
            const word = /^(?:region|town|city|village|district|area|state|country|natural|beauty)$/.test(noun) ? '' : plain[hype];
            const next = word === '' ? noun : `${word}${comma} ${noun}`;
            return (article === '' ? '' : articleFor(article, next) + ' ') + next;
        }, t);
    }

    strong(t) {
        t = this.deletes('strong_delete', t);
        t = this.swaps('strong_swap', [1, 3, 4, 16, 18], t);
        t = this.strips('strong_strip', t);
        t = this.mergeFragments(t);
        t = this.mergeOpenings(t);

        t = this.replace(1, rx(', no (guessing|fuss|hassle|surprises|exceptions)(?=[.!])', 'gi'), (m) => ' without ' + m[1], t);
        const ing = 'highlighting|underscoring|emphasi[sz]ing|reflecting|symboli[sz]ing|cultivating|fostering|showcasing|showing';
        t = this.replace(15, rx(`, (?:${ing})\\b[^.;!?\\n\\d\\p{Lu}${OPEN}]{0,160}(?=[.!])`, 'g'), () => '', t);
        t = this.replace(16, rx("(?<!not )(?<!n't )(?<!n’t )(?<!never )\\b(truly|absolutely|completely|incredibly) (?=\\p{Ll})", 'g'),
            (m) => (this.inSample(m[1]) ? null : ''), t);
        t = this.replace(11, rx(SENTENCE_START + 'No ([a-z]+(?: [a-z]+)?) (?:needed|required)(?=[.!])', 'gm'), (m) => 'You do not need any ' + m[1], t);
        t = this.replace(24, rx("^(#{1,6} [^\\n]+\\n+)[\\w']+ (?:really |truly )?(?:matters|counts|is (?:important|key|everything))\\.\\n\\n", 'gm'), (m) => m[1], t);
        t = this.sentenceCaseHeadings(t);
        return this.replace(20, rx('^((?:#{1,6} |[-*] ))→\\s*', 'gm'), (m) => m[1], t);
    }

    mergeFragments(t) {
        return this.replace(2, rx('([^.!?\\n]*\\bno [^.!?\\n]*)\\.((?: No [a-z][^.!?,\\n]{1,60}\\.){2,})', 'g'), (m) => {
            const items = m[2].split('.').filter((s) => trim(s) !== '').map((s) => lcfirst(trim(s)));
            const last = items.pop();
            return m[1] + ', ' + items.join(', ') + ', and ' + last + '.';
        }, t);
    }

    mergeOpenings(t) {
        const s = '((?:[^\\s.!?,;:]+ ){1,10}[^\\s.!?,;:]+)\\.';
        return this.replace(7, rx(`\\b(She|He|They|It|We|I) ${s} \\1 ${s}(?= \\1 )`, 'g'), (m) => (
            rx('\\b(?:and|or|but)\\b', '').test(m[2]) ? null : `${m[1]} ${m[2]} and ${m[3]}.`
        ), t);
    }

    sentenceCaseHeadings(t) {
        const names = new Set(t.replace(/^#{1,6} .*$/gm, '').match(rx("(?<=[a-z,;] )\\p{Lu}[\\p{L}']+", 'g')) || []);
        return this.replace(20, rx("^(#{1,6} )((?:\\p{Lu}[\\w'’-]*[ \\t]+){2,}\\p{Lu}[\\w'’-]*)$", 'gm'), (m) => {
            const words = m[2].split(' ').map((w, i) => (
                i > 0 && rx("^\\p{Lu}[\\p{Ll}'’-]*$", '').test(w) && !names.has(w) && !CALENDAR.test(w) ? lcfirst(w) : w
            ));
            return m[1] + words.join(' ');
        }, t);
    }

    leadingEmoji(t) {
        return this.replace(20, rx('^((?:#{1,6} |[-*] |\\d+\\. )?)' + EMOJI + '\\s*', 'gm'), (m) => m[1], t);
    }

    repeatedLabels(t) {
        return this.replace(19, rx('^([-*] )\\*\\*([^*\\n]{2,40}?):?\\*\\*:?\\s+((?:the )?\\2\\b)', 'gim'), (m) => m[1] + ucfirst(m[3]), t);
    }

    weak(t, others) {
        if (others || count(t, rx('\\*\\*[^*\\n]+\\*\\*', 'g')) > 2) {
            t = this.replace(19, rx('\\*\\*([^*\\n]+)\\*\\*', 'g'), (m) => m[1], t);
        }
        if (count(t, rx('^(?:-{3,}|\\*{3,}|_{3,})$', 'gm')) > 1) {
            t = this.replace(20, rx('^(?:-{3,}|\\*{3,}|_{3,})\\n?$', 'gm'), () => '', t);
        }
        if (others) {
            t = this.replace(20, rx('[ \\t]*' + EMOJI, 'g'), () => '', t);
            t = this.replace(10, rx(`\\b((?:is|are|was|were) )(${this.rules.hyphens})(?=[.,;!?]|\\s+and\\b|\\s*$)`, 'gim'), (m) => m[1] + m[2].replace('-', ' '), t);
        }
        if (!this.keepDashes && (others || count(t, rx('—|\\s–\\s|\\s--\\s', 'g')) > 1)) {
            t = t.split('\n').map((line) => this.dashes(line)).join('\n');
        }
        return t;
    }

    dashes(line) {
        if (!/[—–]|\s--\s/u.test(line) || /^\s*(?:[—–]|\||-{3,}$)/u.test(line)) return line;
        line = this.replace(8, rx('(?<=[\\p{L}\\d])–(?=[\\p{L}\\d])|(?<=\\d)\\s?[—–]\\s?(?=\\d)', 'g'), () => '-', line);

        const m = /^(#{1,6} .+?|[-*] (?:\S+ ){0,3}\S+?)\s*(?:—|\s–|\s--)\s*(\S.*)$/u.exec(line);
        if (m && !/[—–]/u.test(m[2])) {
            const next = m[1] + ': ' + m[2];
            this.log(8, line, next);
            return next;
        }
        let out = '';
        for (const sentence of line.split(/((?<=[.!?])\s+(?![—–-]))/u)) {
            const parts = sentence.split(/\s*—\s*|\s+–\s+|\s+--\s+/u);
            if (parts.length < 2 || parts.some((p) => trim(p) === '')) {
                out += sentence;
                continue;
            }
            let next;
            if (parts.length === 2) {
                next = join(parts[0], parts[1]);
            } else if (parts.length === 3) {
                const [a, b, c] = parts;
                next = /[,;!?]/u.test(b) ? `${a} (${b}) ${c}` : `${a}, ${b}, ${c}`;
            } else {
                next = parts.join(', ');
            }
            this.log(8, sentence, next);
            out += next;
        }
        return out;
    }

    /* ---------- voice ---------- */

    readVoice() {
        const words = count(this.sample, WORD);
        if (words < 20) return null;
        const short = count(this.sample, rx("\\b\\p{L}+n['’]t\\b", 'gi'));
        const long = count(this.sample, rx('\\b(?:do|does|did|is|are|was|were|has|have|had|could|would|should|can|will) ?not\\b', 'gi'));
        return {
            words,
            sentence: this.averageSentence(this.sample),
            dashes: /—|\s–\s|\s--\s/u.test(this.sample),
            curly: /[“”]/u.test(this.sample),
            contractions: short > 0 && long === 0 ? 'short' : (long > 0 && short === 0 ? 'long' : 'mixed'),
        };
    }

    averageSentence(text) {
        const sentences = trim(text).split(/(?<=[.!?])\s+|\n+/u).filter((s) => /\p{L}/u.test(s));
        return sentences.length ? Math.round(count(text, WORD) / sentences.length) : 0;
    }

    matchContractions(t, voice) {
        const want = voice ? voice.contractions : '';
        if (want !== 'short' && want !== 'long') return t;
        this.vault = [];
        t = this.protect(this.protect(t, CODE, 'C'), QUOTE, 'Q');
        const verbs = 'do|does|did|is|are|was|were|has|have|had|could|would|should';
        if (want === 'short') {
            t = this.replace(0, rx(`\\b(${verbs}) not\\b(?! only| just)`, 'gi'), (m) => m[1] + "n't", t);
            t = this.replace(0, rx('\\b(c)an ?not\\b(?! only| just)', 'gi'), (m) => m[1] + "an't", t);
            t = this.replace(0, rx('\\b(w)ill not\\b', 'gi'), (m) => m[1] + "on't", t);
        } else {
            t = this.replace(0, rx("\\b(c)an['’]t\\b(?=\\s)", 'gi'), (m) => m[1] + 'annot', t);
            t = this.replace(0, rx("\\b(w)on['’]t\\b(?=\\s)", 'gi'), (m) => m[1] + 'ill not', t);
            t = this.replace(0, rx(`\\b(${verbs})n['’]t\\b(?= (?!(?:you|we|they|he|she|it|I)\\b))`, 'g'), (m) => m[1] + ' not', t);
        }
        return this.restore(t, 'QC');
    }

    /* ---------- human mode ---------- */

    natural(text, voice) {
        this.vault = [];
        let t = this.protect(this.protect(text, CODE, 'C'), QUOTE, 'Q');
        t = this.strips('human_strip', this.deletes('human_delete', t));
        t = this.swaps('human_swap', [27], t);
        // People write plainly already, so sentences are rebuilt only where there are signs of AI writing.
        const signs = this.edits.filter((c) => c.pattern > 0).length + this.flags(this.restore(t, 'QC'), true).length;
        if (signs > 0) {
            t = Brain.rewrite(this, t);
            if (this.type !== 'reference') t = this.swaps('human_words', [27], t);
        }
        if (this.type !== 'reference') {
            for (const [from, to] of Object.entries(this.rules.human_open)) {
                t = this.replace(28, rx(SENTENCE_START + from + '(?= \\p{L})', 'gim'), () => to, t);
            }
            t = this.plainHowever(t);
            if (!this.fullForms && (!voice || voice.contractions !== 'long')) t = this.contract(t);
        }
        if (!this.keepDashes) t = t.split('\n').map((line) => this.dashes(line)).join('\n');
        t = t.split('\n').map((line) => this.breakLong(line)).join('\n');
        return this.restore(t, 'QC');
    }

    plainHowever(t) {
        const next = 'the|it|this|that|they|we|you|he|she|a|an|these|those|there|many|some|most|our|their|its|his|her|your|not|if|when|with|in|for|on|as|while|although|because|some|no|one|even|what|how|at|by|from|to';
        return this.replace(28, rx(SENTENCE_START + `However, ((?:${next})\\b)`, 'gm'), (m) => 'But ' + lcfirst(m[1]), t);
    }

    contract(t) {
        const verbs = 'do|does|did|is|are|was|were|has|have|had|could|would|should';
        t = this.replace(29, rx(`\\b(${verbs}) not\\b(?! only| just)`, 'gi'), (m) => m[1] + "n't", t);
        t = this.replace(29, rx('\\b(c)an ?not\\b(?! only| just)', 'gi'), (m) => m[1] + "an't", t);
        t = this.replace(29, rx('\\b(w)ill not\\b', 'gi'), (m) => m[1] + "on't", t);
        const free = '(?<!what )(?<!where )(?<!how )(?<!who )(?<!why )(?<!when )(?<!as )(?<!than )(?<!whatever )(?<!wherever )';
        const after = '(?= (?!(?:and|or|but|nor|today|now|because|if|when|that)\\b)\\p{Ll})';
        t = this.replace(29, rx(`${free}\\b(it|there) is${after}`, 'gi'), (m) => m[1] + "'s", t);
        t = this.replace(29, rx(SENTENCE_START + '(That) is(?= (?:a|an|the|why|how|what|where|not|because)\\b)', 'gm'), (m) => m[1] + "'s", t);
        t = this.replace(29, rx(`${free}\\b(we|you|they) are${after}`, 'gi'), (m) => m[1] + "'re", t);
        t = this.replace(29, rx(`${free}\\bI am${after}`, 'g'), () => "I'm", t);
        t = this.replace(29, rx('\\b(I|we|you|they) will(?= \\p{Ll})', 'gi'), (m) => m[1] + "'ll", t);
        return this.replace(29, rx('\\b(I|we|you|they) have(?= (?:been|already|seen|made|done|never|always|become|found|learned|used|\\p{Ll}{3,}ed)\\b)', 'gi'), (m) => m[1] + "'ve", t);
    }

    breakLong(line) {
        if (/^\s*(?:#|>|\||[-*] |\p{Nd}+\. )/u.test(line)) return line;
        let out = '';
        for (const sentence of line.split(/((?<=[.!?])\s+)/u)) {
            const next = this.splitSentence(sentence);
            if (next !== sentence) this.log(30, sentence, next);
            out += next;
        }
        return out;
    }

    splitSentence(s) {
        const subject = '(?:it|they|we|you|he|she|I|there|this|these|those)';
        const open = rx('^\\W*(?:when|if|while|because|since|although|though|once|unless|whether|not|whereas|what|how)\\b', 'i');
        if (count(s, WORD) < 20 || open.test(s)) return s;
        for (const m of s.matchAll(rx(`, (and|but|so) (?=${subject}\\b)|; (?=${subject}\\b)|, which means (?:that )?`, 'g'))) {
            const left = s.slice(0, m.index);
            const right = s.slice(m.index + m[0].length);
            if (count(left, WORD) < 7 || count(right, WORD) < 6 || left.split('(').length !== left.split(')').length) continue;
            if (m[0].includes('which')) return `${left}. That means ${right}`;
            return m[1] === 'but' || m[1] === 'so' ? `${left}. ${ucfirst(m[1])} ${right}` : `${left}. ${ucfirst(right)}`;
        }
        return s;
    }

    tips(text) {
        const plain = text.replace(CODE, ' ').replace(QUOTE, ' ');
        const tips = this.find(0, rx('(?<![\\w-])(?:' + alt(this.rules.vague) + ')(?![\\w-])', 'gi'), plain).map((hit) => ['vague', hit.text]);
        let run = [];
        for (const s of this.sentences(plain)) {
            const n = count(s, WORD);
            if (n > 30) tips.push(['long', trim(s)]);
            run = n >= 6 && run.length && Math.abs(n - count(run[0], WORD)) <= 2 ? [...run, s] : [s];
            if (run.length === 4) {
                tips.push(['even', trim(run[0])]);
                run = [];
            }
        }
        if (count(plain, WORD) >= 60) {
            if (!rx('\\d|(?<=[\\p{Ll},;] )\\p{Lu}\\p{L}+', '').test(plain)) tips.push(['detail', '']);
            if (this.type === 'personal' && !rx('\\b(?:I|we|my|our|me|us)\\b', 'i').test(plain)) tips.push(['self', '']);
        }
        return tips.slice(0, 10);
    }

    metrics(text) {
        const lengths = this.sentences(text).map((s) => count(s, WORD));
        const words = lengths.reduce((a, b) => a + b, 0);
        if (!lengths.length || !words) return { variety: 0, ease: 0 };
        const mean = words / lengths.length;
        const spread = Math.sqrt(lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / lengths.length);
        const letters = text.match(/[A-Za-z]+/g) || [];
        let syllables = 0;
        for (const word of letters) syllables += Math.max(1, count(word.replace(/(?<=[^aeiouyl])e$/i, ''), /[aeiouy]+/gi));
        const ease = 206.835 - 1.015 * mean - 84.6 * syllables / Math.max(1, letters.length);
        return { variety: Math.round(spread), ease: Math.round(Math.max(0, Math.min(100, ease))) };
    }

    sentences(text) {
        return trim(text).split(/(?<=[.!?])\s+|\n+/u).filter((s) => count(s, WORD) > 0);
    }

    inSample(phrase) {
        return this.sample !== '' && this.sample.toLowerCase().includes(phrase.toLowerCase());
    }

    /* ---------- flags ---------- */

    flags(text, keepDashes = this.keepDashes) {
        let found = [];
        for (const [n, list] of entries(this.rules.flag)) {
            for (const p of list) {
                const start = /^(?:,|\(\?<)/.test(p) ? '' : '(?<![\\w-])';
                // Safari has no (?-i:...), so the capital after "cited in" is checked by hand.
                const outlet = p.includes(OUTLET);
                let hits = this.find(n, rx(start + '(?:' + apos(p.replace(OUTLET, '')) + ')(?![\\w-])', 'gi'), text);
                if (outlet) hits = hits.filter((f) => /^ (?:the |The )?[A-Z]/.test(text.slice(f.end)));
                found.push(...hits);
            }
        }
        const item = '\\p{L}[\\w-]*(?: [\\w-]+)?';
        const triads = this.find(6, rx(`\\b${item}, ${item},? and ${item}(?=[.!?;,])`, 'g'), text);
        if (triads.length > 1) found.push(...triads);
        const word = "((?!(?:The|A|An)\\b)\\p{Lu}[\\w']*)\\b[^.!?\\n]*[.!?]";
        found.push(
            ...this.find(2, rx('(?:(?<=[.!?] )|^)No [a-z][^.!?,\\n]{1,60}\\.(?: No [a-z][^.!?,\\n]{1,60}\\.)+', 'gm'), text),
            ...this.find(6, rx('\\b(?:An?|Every|Some) [\\w-]+ (\\w+) [^.!?\\n]*\\. (?:An?|Every|Some) [\\w-]+ \\1 [^.!?\\n]*\\. (?:An?|Every|Some) [\\w-]+ \\1 [^.!?\\n]*\\.', 'g'), text),
            ...this.find(7, rx(`(?:^|(?<=[.!?]\\s))${word}\\s+\\1\\b[^.!?\\n]*[.!?]\\s+\\1\\b[^.!?\\n]*[.!?]`, 'gm'), text),
            ...this.find(20, rx("^#{1,6} (?:\\p{Lu}[\\w'’-]*[ \\t]+){2,}\\p{Lu}[\\w'’-]*$", 'gm'), text),
            ...this.find(24, rx("^#{1,6} [^\\n]+\\n+(?:[\\w']+ ){1,4}[\\w']+\\.(?=\\n\\n)", 'gm'), text),
            ...this.repeatedLines(text),
            ...(this.type === 'reply' ? this.lateDecision(text) : []),
        );
        const dashes = this.find(8, rx('—', 'g'), text);
        if (!keepDashes && dashes.length > 1) found.push(...dashes);
        if (this.type === 'reference') {
            found = found.filter((f) => f.pattern !== 11 && f.text.toLowerCase() !== 'robust');
        }

        const skip = this.protectedRanges(text);
        found.sort((a, b) => a.start - b.start || b.end - a.end);
        const kept = [];
        let end = 0;
        for (const f of found) {
            if (skip.some(([from, to]) => f.start >= from && f.start < to)) continue;
            if (f.start >= end && !((f.pattern === 12 || f.pattern === 16) && this.inSample(f.text))) {
                kept.push(f);
                end = f.end;
            }
        }
        const edited = this.edits.some((c) => c.pattern > 0 && c.pattern < 27);
        return kept.some((f) => ![8, 11, 14].includes(f.pattern)) || edited ? kept : [];
    }

    repeatedLines(text) {
        const counts = new Map();
        for (const line of text.split('\n')) {
            if (/^\p{Lu}[^|`]{3,80}[.!]$/u.test(line)) counts.set(line, (counts.get(line) || 0) + 1);
        }
        const found = [];
        for (const [line, n] of counts) {
            if (n > 1) found.push(...this.find(2, new RegExp('^' + line.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '$', 'gmu'), text));
        }
        return found;
    }

    lateDecision(text) {
        const regex = apos("[^.!?\\n]*\\b(?:I'd rather|I would rather|I'd prefer|let's|I'll|I will|I suggest|I recommend|we should|my vote|fine to (?:keep|merge|ship)|go ahead)\\b[^.!?\\n]*[.!?]");
        const m = rx(regex, 'i').exec(text);
        if (!m) return [];
        const hit = m[0].replace(/^[ \t\n\r\0\x0B]+/, '');
        const start = m.index + m[0].length - hit.length;
        return count(text.slice(0, m.index), WORD) < 40 ? [] : [{ pattern: 26, start, end: m.index + m[0].length, text: hit }];
    }

    find(pattern, regex, text) {
        return [...text.matchAll(regex)].map((m) => {
            const lead = /^[, \n]*/.exec(m[0])[0].length;
            const hit = m[0].replace(/^[, \n]+|[, \n]+$/g, '');
            return { pattern, start: m.index + lead, end: m.index + lead + hit.length, text: hit };
        });
    }

    protectedRanges(text) {
        return [CODE, QUOTE].flatMap((regex) => [...text.matchAll(regex)])
            .filter((m) => m[0].length < text.length)
            .map((m) => [m.index, m.index + m[0].length]);
    }

    /* ---------- helpers ---------- */

    replace(pattern, regex, fn, text, logOnce = false) {
        let logged = false;
        return text.replace(regex, (...args) => {
            // matchAll-style array: hit and groups, without the offset and source.
            const at = args.findIndex((a) => typeof a === 'number');
            const m = args.slice(0, at);
            const next = fn(m, text.slice(0, args[at]));
            if (next === null || next === m[0]) return m[0];
            if (!logOnce || !logged) {
                this.log(pattern, m[0], next);
                logged = true;
            }
            return next;
        });
    }

    log(pattern, before, after) {
        this.edits.push({ pattern, before: trim(this.restore(before, 'QC')), after: trim(this.restore(after, 'QC')) });
    }
}

Humanizer.TYPES = ['general', 'personal', 'reference', 'informal', 'reply'];

const OPEN = '';
const CLOSE = '';
const SENTENCE_START = '(?:^[ \\t]*|(?<=[.!?]\\s)|(?<=[.!?]["\')]\\s)|(?<=[-*]\\s))';
const EMOJI = '(?:[\\x{1F000}-\\x{1FAFF}\\x{2600}-\\x{2712}\\x{2719}-\\x{27BF}\\x{2B50}\\x{2B55}][\\x{FE0F}\\x{200D}]*)+';
const PREDICATE = '\\b(?:is|are|was|were|be|been|looks?|looked|very|so|truly|absolutely|simply|most|more)\\s$';
const NOT_A_NOUN = 'and|but|or|for|in|as|to|that|because|when|from|with|at|on|if|by|is|are|was|were|than|today|now|here|too|enough';
const CALENDAR = /^(?:January|February|March|April|May|June|July|August|September|October|November|December|(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day|I)$/;
const OUTLET = '(?-i:(?= (?:the |The )?[A-Z]))';
const CODE = rx('\\A---\\n.*?\\n---(?=\\n|\\z)|```.*?(?:```|\\z)|`[^`\\n]+`|^\\|[^\\n]*\\|[ \\t]*$|^\\$ [^\\n]+$|(?<=\\])\\([^)\\s]+\\)'
    + '|https?:\\/\\/[^\\s<>)\\]]+|<\\/?[a-zA-Z][^<>\\n]*>|\\b[\\w.+-]+@[\\w-]+\\.\\w+(?:\\.\\w+)*|\\b[A-Za-z]:\\\\[^\\s"]+|(?<![\\w\\/])\\.{0,2}\\/[\\w.-]+\\/[\\w.\\/-]+', 'gms');
const QUOTE = rx('"[^"\\n]{1,400}"|“[^”\\n]{1,400}”', 'g');
const WORD = rx("[\\p{L}\\d][\\p{L}\\d'’-]*", 'g');

/** Builds a RegExp from a PHP pattern. PHP's \w, \d and \b know Unicode; JavaScript's do not. */
function rx(source, flags) {
    const cache = rx.cache || (rx.cache = new Map());
    const key = flags + '/' + source;
    let regex = cache.get(key);
    if (!regex) {
        const w = '\\p{L}\\p{N}_';
        let out = '';
        let inClass = false;
        for (let i = 0; i < source.length; i++) {
            const c = source[i];
            if (c !== '\\') {
                if (c === '[') inClass = true;
                if (c === ']') inClass = false;
                out += c;
                continue;
            }
            const next = source[++i];
            if (next === 'w') out += inClass ? w : `[${w}]`;
            else if (next === 'd') out += '\\p{Nd}';
            else if (next === 'b') out += `(?:(?<=[${w}])(?![${w}])|(?<![${w}])(?=[${w}]))`;
            else if (next === 'A') out += '(?<![\\s\\S])';
            else if (next === 'z') out += '(?![\\s\\S])';
            else if (next === 'x') out += '\\u';
            else out += '\\' + next;
        }
        regex = new RegExp(out, flags + 'u');
        cache.set(key, regex);
    }
    regex.lastIndex = 0;
    return regex;
}

function entries(map) {
    return Object.entries(map).map(([n, list]) => [Number(n), list]);
}

function count(text, regex) {
    return (text.match(regex) || []).length;
}

function trim(s) {
    return s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

function apos(pattern) {
    return pattern.split("'").join("['’]");
}

function alt(list) {
    return apos(list.join('|'));
}

function atSentenceStart(before) {
    return /(?:^|\n|[.!?:]["')]?\s+|[-*]\s+)$/u.test(before);
}

function articleFor(old, next) {
    const vowel = /^(?:[aeiou]|hour|honest)/i.test(next) && !/^(?:uni|use|one\b|eu)/i.test(next);
    return likeCase(old, vowel ? 'an' : 'a');
}

function likeCase(old, next) {
    return /^\p{Lu}/u.test(old) ? ucfirst(next) : next;
}

function ucfirst(s) {
    const [head = ''] = s;
    return head.toUpperCase() + s.slice(head.length);
}

function lcfirst(s) {
    const [head = ''] = s;
    return head.toLowerCase() + s.slice(head.length);
}

function join(a, b) {
    if (/[.!?:;,]$/u.test(a)) return `${a} ${b}`;
    const subordinate = rx('^\\W*(?:when|if|while|because|since|although|though|with|after|before|once|as|from|to|in|for)\\b', 'i');
    const clause = rx(apos("^(?:it|it's|this is|that's|that is|they|they're|we|we're|you|you're|I|I'm|he|she|there's|there are)\\b"), 'i');
    return clause.test(b) && !subordinate.test(a) ? `${a}. ${ucfirst(b)}` : `${a}, ${b}`;
}
