// Judges what the AI writer wrote. A draft that loses or invents a fact is thrown away.
// No check can see every change of meaning, so the page also shows the original beside the result.
const Checker = (() => {
    const NUMBER_WORDS = new Set(('two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty '
        + 'sixty seventy eighty ninety hundred hundreds thousand thousands million millions billion billions trillion dozen dozens half quarter percent').split(' '));
    const NEGATION = /\b(?:not|no|never|none|nobody|nothing|neither|nor|cannot|without|hardly|rarely|seldom)\b|n['’]t\b/gi;
    const STOP = new Set(('a an the and or but nor so yet if because as while when where which who whom whose that this these those to of in on at by for from with about into over under '
        + 'between through during before after above below is are was were be been being am has have had do does did can could will would shall should may might must not no it its he his she her '
        + 'they their them we our us you your i my me what how why than then there here also too just only even still all each every both any some such very more most much many lot way make makes '
        + 'made get gets help helps use uses used one thing things people really well like '
        // Filler of formal writing. Losing it loses no meaning.
        + 'consequently furthermore moreover nevertheless nonetheless additionally therefore thus hence however ultimately overall firstly secondly essential important crucial vital key '
        + 'imperative significant significantly associated increased increasingly increase levels level prolonged utilize utilizes utilization facilitate numerous various several multitude plethora '
        + 'ensure ensuring provide provides providing provided enable enables enabled offer offers offering order effective effectively particular particularly certain able necessary need needs '
        + 'establish establishing fostering foster promote promoting implement implementing manner serves serve stands stand testament located heart approximately frequently often become '
        + 'becomes role plays play factor factors aspect aspects consider consideration opportunity experience individual individuals').split(' '));
    // Words people swap for each other, so a plain rewrite is not mistaken for a lost idea.
    const SAME = [
        'important crucial vital essential key pivotal matter big major significant', 'use utilize employ', 'show demonstrate reveal prove', 'improve enhance better boost', 'start begin commence',
        'buy purchase', 'need require', 'change transform revolutionize alter shift', 'problem challenge issue', 'reduce mitigate cut lower lessen', 'company business firm organization',
        'person individual', 'build construct create make develop', 'quick rapid fast', 'hard difficult challenging tough', 'connect link associate relate', 'world globe global worldwide',
        'choose pick select opt', 'keep maintain retain stay remain', 'health wellbeing healthy', 'worker employee staff', 'job work task', 'money cost price financial', 'climb ascend', 'top summit',
        'famous iconic renowned', 'danger risk threat', 'bad harmful detrimental negative hurt damage', 'good beneficial positive great', 'learn discover find', 'share spread', 'talk communicate communication',
        'goal objective aim', 'customer client', 'give provide offer', 'year annual annually', 'visitor tourist', 'doctor physician', 'child kid', 'student learner', 'car vehicle', 'house home', 'view scenery',
        'depression depressed', 'anxiety anxious', 'nation country', 'warm hot heat', 'act action', 'skill ability', 'smart clever intelligent', 'early soon', 'find detect identify spot', 'study research', 'sad depression depressed', 'worried anxiety anxious', 'mindful careful wisely carefully', 'boundary limit', 'platform tool site app',
        'criticism criticize hate hated critic', 'landmark sight', 'earth planet world globe', 'sea ocean', 'weather storm', 'severe bad', 'team cooperation collaboration together', 'future tomorrow',
        'government leader', 'energy power', 'clean renewable', 'locate sit', 'attract draw', 'construct built build', 'ingenuity creativity invention', 'issue problem', 'motivate motivation',
        'productive productivity', 'balance mix', 'student learner', 'prioritize priority', 'speed fast', 'law rule regulation regulatory',
    ];
    const GROUP = new Map(SAME.flatMap((row, i) => row.split(' ').map((w) => [stem(w), `=${i}`])));

    function stem(word) {
        let w = word.toLowerCase().replace(/['’]s$/, '');
        if (w.length > 4) w = w.replace(/(?:ies)$/, 'y').replace(/(?:ations?|ings?|ments?|ness|ably|edly|ed|es|ly|s|al)$/, '');
        return w.length > 4 ? w.replace(/(?:e|y|i)$/, '') : w;
    }

    const words = (text) => text.match(/[\p{L}\d][\p{L}\d'’-]*/gu) || [];
    const numbers = (text) => (text.match(/\d[\d.,:]*\d|\d/g) || []).map((n) => n.replace(/,/g, ''));

    function ideas(text) {
        const out = new Set();
        for (const w of words(text)) {
            const low = w.toLowerCase();
            if (low.length < 3 || STOP.has(low) || /^\d/.test(low)) continue;
            const s = stem(low);
            out.add(GROUP.get(s) || s);
        }
        return out;
    }

    /** How much of a stays, in order, in b: 1 is a copy. */
    function similarity(a, b) {
        const x = words(a).map((w) => w.toLowerCase());
        const y = words(b).map((w) => w.toLowerCase());
        if (!x.length) return 1;
        let row = new Uint16Array(y.length + 1);
        for (const w of x) {
            const next = new Uint16Array(y.length + 1);
            for (let j = 1; j <= y.length; j++) next[j] = w === y[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]);
            row = next;
        }
        return row[y.length] / x.length;
    }

    /** Removes what models put around an answer: "Here is the rewritten text:", quotation marks, leftover tags. */
    function clean(draft, source) {
        let t = draft.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/<\|[^|]*\|>/g, '').trim();
        t = t.replace(/^(?:sure|certainly|of course|okay)[,!.][^\n]{0,80}\n+/i, '').replace(/^(?:here(?:['’]s| is| are)\b[^\n:]{0,80}|rewritten(?: text)?|rewrite|output|answer):\s*/i, '').trim();
        if (/^["“][\s\S]*["”]$/.test(t) && !/^["“]/.test(source)) t = t.slice(1, -1).trim();
        if (!/^\s*(?:[-*#]|\d+\.)/m.test(source)) t = t.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\s*\n+\s*/g, ' ');
        return t.trim();
    }

    function count(list) {
        const m = new Map();
        for (const x of list) m.set(x, (m.get(x) || 0) + 1);
        return m;
    }

    /** Proper names that are not merely the first word of a sentence. */
    function names(text) {
        return [...text.matchAll(/(?<=[\p{L}\d,;)]\s)\p{Lu}[\p{L}\d]*(?:['’-]\p{L}+)*/gu)].map((m) => m[0].replace(/['’]s$/u, '')).filter((n) => !/^I(?:['’]|$)/.test(n));
    }

    /**
     * @param {{limit?: number, strict?: boolean}} options limit: the most that may stay unchanged
     * @returns {{ok: boolean, score: number, why: string}}
     */
    function judge(source, draft, options = {}) {
        const no = (why) => ({ ok: false, score: -9, why });
        if (draft === '') return no('empty');
        const a = words(source);
        const b = words(draft);
        const size = b.length / Math.max(1, a.length);
        if (size < (options.least ?? 0.55)) return no('too short');
        const extra = options.extra || '';
        if (b.length > 1.35 * a.length + words(extra).length) return no('too long');
        if (/[.!?]["”')]?$/.test(source) && !/[.!?]["”')]?$/.test(draft)) return no('cut off');
        if (/\b(?:as an ai|language model|rewritten|rewrite this|plain, natural english|original text)\b/i.test(draft) && !/\b(?:as an ai|language model|rewrit|original text)/i.test(source)) return no('talks about itself');

        const both = `${source}\n${extra}`;
        const numbersBefore = count(numbers(source));
        const numbersKnown = count(numbers(both));
        const numbersAfter = count(numbers(draft));
        for (const n of numbersBefore.keys()) if (!numbersAfter.has(n)) return no(`lost ${n}`);
        for (const n of numbersAfter.keys()) if (!numbersKnown.has(n)) return no(`invented ${n}`);
        const spelled = (text) => new Set(words(text).flatMap((w) => w.toLowerCase().split('-')).filter((w) => NUMBER_WORDS.has(w)));
        const spelledBefore = spelled(source);
        const spelledAfter = spelled(draft);
        for (const n of spelledBefore) if (!spelledAfter.has(n)) return no(`lost ${n}`);
        const spelledKnown = spelled(both);
        for (const n of spelledAfter) if (!spelledKnown.has(n)) return no(`invented ${n}`);
        for (const mark of ['%', '$', '€', '£', '₹']) {
            if (source.includes(mark) && !draft.includes(mark)) return no(`changed ${mark}`);
            if (draft.includes(mark) && !both.includes(mark)) return no(`changed ${mark}`);
        }

        const inDraft = draft.toLowerCase();
        const inSource = source.toLowerCase();
        const inBoth = both.toLowerCase();
        // "AI-powered tools" may become "tools powered by AI".
        for (const n of names(source)) if (!n.toLowerCase().split('-').every((part) => inDraft.includes(part))) return no(`lost ${n}`);
        for (const n of names(draft)) if (!inBoth.includes(n.toLowerCase())) return no(`invented ${n}`);
        for (const q of source.match(/"[^"\n]{1,400}"|“[^”\n]{1,400}”/g) || []) if (!draft.includes(q.slice(1, -1))) return no('changed a quotation');
        for (const u of source.match(/https?:\/\/[^\s<>)\]]+|[\w.+-]{1,64}@[\w-]+\.[\w.]+/g) || []) if (!draft.includes(u)) return no('lost a link');

        const list = b.map((w) => w.toLowerCase());
        const runs = new Map();
        for (let i = 0; i + 4 <= list.length; i++) {
            const run = list.slice(i, i + 4).join(' ');
            runs.set(run, (runs.get(run) || 0) + 1);
            if (runs.get(run) > 2) return no('repeats itself');
        }
        for (let i = 0; i + 1 < list.length; i++) if (list[i] === list[i + 1] && !/^(?:that|had|very|so|no|bye)$/.test(list[i])) return no('repeats a word');
        // "rising sea levels, rising sea levels", unless the writer's own text says it twice
        const threes = new Set();
        for (let i = 0; i + 3 <= list.length; i++) {
            const run = list.slice(i, i + 3);
            const key = run.join(' ');
            if (run.filter((w) => !STOP.has(w)).length > 1 && threes.has(key) && inSource.split(key).length < 3) return no('repeats a phrase');
            threes.add(key);
        }
        const parts = draft.split(/[,.;]| and /).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 8);
        if (new Set(parts).size < parts.length) return no('repeats a phrase');

        const wanted = ideas(source);
        const got = ideas(draft);
        const kept = wanted.size ? [...wanted].filter((x) => got.has(x)).length / wanted.size : 1;
        const known = ideas(both);
        const added = got.size ? [...got].filter((x) => !known.has(x)).length / got.size : 0;
        if (kept < (options.keep ?? 0.4)) return no('lost too much meaning');
        if (added > (options.add ?? 0.6)) return no('added too much');
        // "not just" and "do not hesitate" say yes.
        const yes = /\bnot (?:just|only|merely|simply)\b|n['’]t (?:just|only|merely|simply)\b|\b(?:do not|don['’]t) hesitate\b|\bno (?:later|sooner|earlier|less|fewer|more) than\b|\bno doubt\b|\bnot to mention\b/gi;
        const negBefore = (source.replace(yes, '').match(NEGATION) || []).length;
        // "minimal equipment" may become "you don't need much equipment".
        const little = /\b(?:minimal|little|few|less|fewer|low|easy|easily|simple|accessible|affordable|free|reduced?|avoid)\b/i.test(source)
            ? /(?:\b(?:do|does|did|will|can)(?: not|n['’]t)|\bcannot|\bnot)(?: \p{L}+){0,2} (?:need|require|take|cost|have to|much|many)\b|\bwithout (?:much|any|many)\b|\bno (?:need|special)\b/giu : /(?!)/g;
        const negAfter = (draft.replace(yes, '').replace(little, '').match(NEGATION) || []).length;
        const negExtra = (extra.match(NEGATION) || []).length;
        if (negAfter < negBefore - 1 || negAfter > negBefore + 1 + negExtra || (negBefore > 0 && negAfter === 0) || (negBefore === 0 && negAfter > negExtra)) return no('changed a yes to a no');
        if (/\bone of the\b/i.test(source) && !/\b(?:one of|among)\b/i.test(draft) && /\bthe (?:most|best|biggest|\p{L}+est)\b/iu.test(draft)) return no('claims too much');
        // "The structure was" must not become "They were": the reader would look for someone else.
        const opener = /^(they|he|she|it)\b/i.exec(draft);
        // "It was a pleasure to" points at nothing, and after a label the subject is known.
        const empty = /^it(?: is|['’]s| was| has been) (?:an? |the |also |often |important|essential|necessary|possible|easy|hard|clear|good|great|best|worth|time)/i.test(draft);
        if (opener && !empty && !options.item && !new RegExp(`\\b${opener[1]}\\b`, 'i').test(source)) return no('lost its subject');
        // "all ages" is not "almost any age"
        for (const w of ['almost', 'nearly', 'mostly', 'always', 'never', 'every', 'everyone', 'only']) {
            const said = new RegExp(`\\b${w}\\b`, 'i');
            const same = { every: /\b(?:every|each|all|any|rest|throughout|dail|annual|year|whole|entire|\w+ly)/i, everyone: /\b(?:everyone|everybody|all|every|any)/i, always: /\b(?:always|all|every|constant)/i, only: /\b(?:only|just|sole|solely|merely|simply|limited|exclusively)\b/i, never: NEGATION }[w];
            if (said.test(draft) && !said.test(both) && !(same && new RegExp(same.source, 'i').test(both))) return no('changed how much');
        }
        const self = /\b(?:I|my|me|we|our|us)\b/;
        if (self.test(draft) && !self.test(both) && options.strict) return no('speaks as someone');

        const same = similarity(source, draft);
        if (same > (options.limit ?? 0.85)) return { ok: false, score: 0, why: 'barely changed' };
        let score = 2 * Math.min(kept, 0.9) - 0.7 * same - added - 0.4 * Math.abs(1 - size);
        if (self.test(draft) && !self.test(source)) score -= 0.25;
        if (/\b(?:you|your)\b/i.test(draft) && !/\b(?:you|your)\b/i.test(source)) score -= 0.05;
        return { ok: true, score, why: '' };
    }

    const RULE = 0.9;         // how many sentences have to be new
    const CLOSE = 0.75;       // a sentence that keeps more of its words in order is not new
    const sentencesOf = (text) => text.split(/(?<=[.!?]["”')]?)\s+(?=["“(]?[\p{Lu}\d])|\n+/u).map((s) => s.trim()).filter((s) => words(s).length >= 5);

    /** True for sentences that are mostly names, such as a list of job titles. Those cannot be put in other words. */
    function fixed(s) {
        const list = words(s);
        return list.filter((w) => /^\p{Lu}/u.test(w) || /\d/.test(w)).length > list.length / 2 || /^["“].*["”]$/.test(s);
    }

    /** @returns {{share: number, total: number, close: string[]}} how many sentences are new, and those that are not */
    function changed(original, current) {
        const before = sentencesOf(original);
        const after = sentencesOf(current).filter((s) => !fixed(s));
        const close = after.filter((s) => before.some((o) => similarity(s, o) > CLOSE || similarity(o, s) > 0.9));
        return { share: after.length ? 1 - close.length / after.length : 1, total: after.length, close };
    }

    /** Puts the text of a list together again. */
    function settle(piece) {
        piece.text = piece.items.map((x) => x.prefix + x.body + x.end).join('');
    }

    /** Takes "[1] ..." lines apart. Returns null unless every item is there once. */
    function readItems(reply, n) {
        const found = new Map();
        for (const m of reply.matchAll(/^\s*\[(\d+)\]\s*(.+?)\s*$/gm)) {
            if (found.has(Number(m[1]))) return null;
            found.set(Number(m[1]), m[2]);
        }
        return found.size === n && [...found.keys()].every((k) => k >= 1 && k <= n) ? Array.from({ length: n }, (_, i) => found.get(i + 1)) : null;
    }

    /** The first three words most versions share, when a list keeps saying the same thing. */
    function sameness(bodies) {
        if (bodies.length < 4) return '';
        const seen = count(bodies.flatMap((b) => [...new Set(words(b).slice(0, 5).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w) && w.length > 4))]));
        const worst = [...seen].sort((x, y) => y[1] - x[1])[0];
        return worst && worst[1] > Math.max(2, bodies.length / 3) ? worst[0] : '';
    }

    /** Splits text into pieces for the writer. Headings, lists, tables, code and short lines stay as they are. */
    function pieces(text, most = 32) {
        const out = [];
        let fence = false;
        let front = false;
        // Neighbouring points, with or without blank lines between them, are written together so that they do not all sound alike.
        const asItem = (line) => {
            const m = /^(\s*(?:[-*•+] |\d+[.)] )?)((?:\*\*)?\p{Lu}[^.:!?*\n]{1,45}:(?:\*\*)? +)?(\S.*)$/u.exec(line);
            if (!m || (!m[1].trim() && !m[2]) || /[`<>{}|]|\]\(|https?:/.test(line) || words(m[3]).length < 6 || /^(?:subject|to|from|cc|date|re|ps|note)\b/i.test(m[2] || '')) return null;
            return { prefix: m[1] + (m[2] || ''), label: (m[2] || '').replace(/[*:]/g, '').trim(), body: m[3] };
        };
        let run = null;
        text.split('\n').forEach((line, i) => {
            const bare = line.trim();
            if (bare === '---' && (i === 0 || front)) front = !front;
            const inCode = fence || front;
            if (bare.startsWith('```')) fence = !fence;
            if (!inCode && !fence) {
                const item = asItem(line);
                if (item && (!run || run.size < 150)) {
                    if (!run) {
                        run = { items: [], write: true, end: '', size: 0 };
                        out.push(run);
                    }
                    item.end = '\n';
                    run.items.push(item);
                    run.size += words(item.body).length;
                    return;
                }
                if (run && bare === '') {
                    run.items.at(-1).end += `${line}\n`;
                    return;
                }
                run = item ? { items: [{ ...item, end: '\n' }], write: true, end: '', size: words(item.body).length } : null;
                if (run) {
                    out.push(run);
                    return;
                }
            } else {
                run = null;
            }
            const fixed = inCode || fence || /^(?:```|---|#|>|\||[-*•+] |\d+[.)] |\$ |<|\t| {4})/.test(line) || /[`<>{}]|\]\(/.test(line)
                || words(bare).length < 9 || !/[.!?]["”')]?$/.test(bare) || (bare.match(/[A-Za-z]/g) || []).length < bare.length * 0.6;
            if (fixed) {
                out.push({ text: line, write: false, end: '\n' });
                return;
            }
            let part = '';
            const sentences = bare.split(/(?<=[.!?]["”')]?)\s+(?=["“(]?\p{Lu}|\d)/u);
            const flush = (end) => {
                if (part) out.push({ text: part, write: words(part).length >= 9, end });
                part = '';
            };
            for (const s of sentences) {
                if (part && words(part).length + words(s).length > most) flush(' ');
                part = part ? `${part} ${s}` : s;
            }
            flush('\n');
        });
        const last = out.at(-1);
        if (last && last.items) last.items.at(-1).end = last.items.at(-1).end.slice(0, -1);
        else if (last) last.end = '';
        for (const p of out) if (p.items) settle(p);
        return out;
    }

    /** What a rewrite has to repeat exactly, for the writer's instructions. */
    function mustKeep(text) {
        const spelled = words(text).filter((w) => NUMBER_WORDS.has(w.toLowerCase()));
        const list = [...(text.match(/[$€£₹]?\d[\d.,:]*\d%?|[$€£₹]?\d%?/g) || []), ...spelled, ...names(text)];
        return [...new Set(list)].slice(0, 12);
    }

    /** True where a text already says a note. */
    function tells(text, note) {
        const wanted = ideas(note);
        const got = ideas(text);
        const kept = wanted.size ? [...wanted].filter((x) => got.has(x)).length / wanted.size : 1;
        return kept >= 0.6 && numbers(note).every((n) => numbers(text).includes(n));
    }

    return { RULE, changed, clean, fixed, judge, mustKeep, pieces, readItems, sameness, settle, similarity, tells };
})();
