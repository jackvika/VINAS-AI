// Fourteen open textbooks (CC BY, and four under CC BY-NC-SA), searched in the browser: word scores find the likely passages, and
// the reader (static/judge.js) chooses among them. Every passage is read together with its chapter and section titles.
const Book = (() => {
    const ALL = ['introduction-business', 'principles-management', 'organizational-behavior', 'principles-marketing', 'principles-economics-3e', 'business-ethics', 'entrepreneurship', 'introductory-business-statistics-2e', 'accounting-principles', 'project-management', 'principles-financial-accounting', 'principles-managerial-accounting', 'principles-finance-2e', 'business-law-i-essentials-2e'];
    const STOP = new Set('a an the of in on at to for from by with and or but is are was were be do does did has have can will what which who whom that this these when where why how many much it its as about into their they you i we our explain describe define examine discuss some main business'.split(' '));
    // What a section sets out to teach, told to the student.
    const GOAL = /^(?:understand|discuss|explain|describe|identify|define|compare|analy[sz]e|summari[sz]e|learn|know|list|outline|distinguish|recogni[sz]e|evaluate|differentiate|apply|assess|examine|calculate|compute|perform|determine|prepare|demonstrate|interpret|illustrate|record|relate|contrast|state)\b(?=.{10,170}$)[^.]*\.?$/i;
    const books = new Map();
    const waiting = new Map();
    let pages = [];
    let passages = [];
    // For each word: the number of a passage, how often the word is in it, and so on in turn.
    let posts = new Map();
    let total = 0;
    // How often each word is used, for mending spelling.
    const used = new Map();

    function stem(word) {
        let w = word.toLowerCase().replace(/['’]s$/, '');
        if (w.length > 4) w = w.replace(/ies$/, 'y').replace(/(?:ations?|ings?|ments?|ness|edly|ed|es|ly|s)$/, '');
        return w.length > 4 ? w.replace(/e$/, '') : w;
    }

    const terms = (t) => (t.toLowerCase().replace(/\b(non|pre|co|re|sub|inter|multi|over|under)[- ](?=\p{Ll})/gu, '$1').match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

    /** Takes a book apart into passages of about a hundred words, each with its titles. */
    function take(book) {
        const out = { pages: [], passages: [] };
        book.modules.forEach((was, at) => {
            const m = { ...was, title: topicOf(was.title) };
            const lines = [];
            let section = '';
            let cur = [];
            let size = 0;
            const flush = () => {
                if (cur.length) out.passages.push({ at, book: book.id, title: `${m.in} > ${m.title}${section ? ` > ${section}` : ''}`, text: cur.join(' ') });
                cur = [];
                size = 0;
            };
            for (const [name, kind, text] of m.text) {
                // The learning goals are questions, or tasks at the head of a section; they answer nothing. The steps of a list inside a section stay.
                if (text.endsWith('?') || /^learning (?:outcomes|objectives)/i.test(name) || (GOAL.test(text) && !(kind === 'i' && name))) continue;
                const n = text.split(' ').length;
                if (name !== section || size + n > 110) flush();
                if (name !== section) {
                    section = name;
                    if (name) lines.push(`== ${name} ==`);
                }
                cur.push(text);
                size += n;
                lines.push(text);
            }
            flush();
            out.pages.push({ title: m.title, text: lines.join('\n'), url: book.base + m.slug, from: `${book.title}, ${book.by}`, licence: book.licence, chapter: m.in, book: book.id });
        });
        return out;
    }

    /** "Describe the Role of Cash" is a heading for a student's task; the topic is the role of cash. */
    const topicOf = (t) => {
        const cut = t.replace(/^(?:(?:understand|discuss|explain|describe|identify|define|compare|analy[sz]e|summari[sz]e|distinguish|recogni[sz]e|evaluate|differentiate|apply|assess|examine|calculate|compute|perform|determine|prepare|demonstrate|interpret|illustrate|record)(?:,? and |, )?)+\s+(?:between\s+)?(?:the\s+|an?\s+)?/i, '');
        return cut.length > 3 && cut !== t ? cut[0].toUpperCase() + cut.slice(1) : t;
    };

    function add(book) {
        const got = take(book);
        const first = pages.length;
        pages = pages.concat(got.pages);
        for (const p of got.passages) {
            const t = terms(`${p.title} ${p.text}`);
            for (const w of p.text.toLowerCase().match(/[a-z]{4,}/g) || []) used.set(w, (used.get(w) || 0) + 1);
            const have = new Map();
            for (const w of t) have.set(w, (have.get(w) || 0) + 1);
            const n = passages.push({ ...p, at: p.at + first, size: t.length }) - 1;
            for (const [w, c] of have) {
                if (!posts.has(w)) posts.set(w, []);
                posts.get(w).push(n, c);
            }
            total += t.length;
        }
        books.set(book.id, book.title);
    }

    function use(some) {
        books.clear();
        pages = [];
        passages = [];
        posts = new Map();
        total = 0;
        some.forEach(add);
    }

    function one(id) {
        if (books.has(id)) return Promise.resolve(true);
        if (!waiting.has(id)) {
            waiting.set(id, fetch(`static/books/${id}.json`, { credentials: 'same-origin' }).then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            }).then((b) => {
                add(b);
                return true;
            }).catch(() => {
                waiting.delete(id);
                return false;
            }));
        }
        return waiting.get(id);
    }

    /** Gets books, all of them or the ones named. */
    async function load(ids = ALL) {
        if (!/^https?:$/.test(location.protocol)) return books.size > 0;
        const got = await Promise.all(ids.filter((x) => ALL.includes(x)).map(one));
        return got.some(Boolean);
    }

    /** The likeliest passages by words alone, in the books named or in all that are here. */
    function likely(question, most, ids) {
        const scores = new Float64Array(passages.length);
        const mean = total / Math.max(1, passages.length);
        for (const w of new Set(terms(question))) {
            const list = posts.get(w);
            if (!list) continue;
            const df = list.length / 2;
            const idf = Math.log(1 + (passages.length - df + 0.5) / (df + 0.5));
            for (let i = 0; i < list.length; i += 2) scores[list[i]] += idf * 2.2 * list[i + 1] / (list[i + 1] + 1.2 * (0.25 + 0.75 * passages[list[i]].size / mean));
        }
        const some = [];
        scores.forEach((v, i) => { if (v > 0 && (!ids || ids.includes(passages[i].book))) some.push(i); });
        return some.sort((x, y) => scores[y] - scores[x]).slice(0, most).map((i) => passages[i]);
    }

    /** The sections that answer a question, best first, or none when the reader is not there or thinks little of them. */
    async function find(question, most = 2, least = 0.5, ids = null) {
        if ((ids && !ids.length) || typeof Judge !== 'object' || !Judge.ready() || !await load(ids || ALL)) return [];
        const some = likely(question, ids ? 20 : 26, ids);
        if (!some.length) return [];
        const p = await Judge.score(question, some.map((x) => `${x.title}: ${x.text}`));
        if (!p) return [];
        const best = new Map();
        some.forEach((x, i) => { if (p[i] >= least) best.set(x.at, Math.max(best.get(x.at) || 0, p[i])); });
        return [...best].sort((x, y) => y[1] - x[1]).slice(0, most).map(([at, chance]) => ({ ...pages[at], chance }));
    }

    return { ALL, load, find, take, use, used, likely };
})();
