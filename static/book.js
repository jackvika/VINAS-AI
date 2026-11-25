// OpenStax "Introduction to Business" (CC BY 4.0), searched in the browser: word scores find the likely passages, and the
// reader (static/judge.js) chooses among them. Every passage is read together with its chapter and section titles.
const Book = (() => {
    const STOP = new Set('a an the of in on at to for from by with and or but is are was were be do does did has have can will what which who whom that this these when where why how many much it its as about into their they you i we our explain describe define examine discuss some main business'.split(' '));
    let data = null;
    let loading = null;

    function stem(word) {
        let w = word.toLowerCase().replace(/['’]s$/, '');
        if (w.length > 4) w = w.replace(/ies$/, 'y').replace(/(?:ations?|ings?|ments?|ness|edly|ed|es|ly|s)$/, '');
        return w.length > 4 ? w.replace(/e$/, '') : w;
    }

    const terms = (t) => (t.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

    /** Takes the book apart into passages of about a hundred words, each with its titles. */
    function index(book) {
        const passages = [];
        const pages = book.modules.map((m, at) => {
            const lines = [];
            let section = '';
            let cur = [];
            let size = 0;
            const flush = () => {
                if (cur.length) passages.push({ at, title: `${m.in} > ${m.title}${section ? ` > ${section}` : ''}`, text: cur.join(' ') });
                cur = [];
                size = 0;
            };
            for (const [name, kind, text] of m.text) {
                // The learning goals are questions; they answer nothing.
                if (text.endsWith('?') || /^learning (?:outcomes|objectives)/i.test(name)) continue;
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
            return { title: m.title, text: lines.join('\n'), url: book.base + m.slug, from: `${book.title}, ${book.by}`, licence: book.licence, chapter: m.in };
        });
        const seen = new Map();
        for (const p of passages) {
            const t = terms(`${p.title} ${p.text}`);
            p.have = new Map();
            for (const w of t) p.have.set(w, (p.have.get(w) || 0) + 1);
            for (const w of p.have.keys()) seen.set(w, (seen.get(w) || 0) + 1);
            p.size = t.length;
        }
        return { pages, passages, seen, mean: passages.reduce((n, p) => n + p.size, 0) / Math.max(1, passages.length) };
    }

    function load() {
        if (data) return Promise.resolve(true);
        if (!/^https?:$/.test(location.protocol)) return Promise.resolve(false);
        if (!loading) {
            loading = fetch('static/book.json', { credentials: 'same-origin' }).then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            }).then((b) => {
                data = index(b);
                return true;
            }).catch(() => {
                loading = null;
                return false;
            });
        }
        return loading;
    }

    /** The likeliest passages by words alone. */
    function likely(question, most) {
        const wanted = [...new Set(terms(question))];
        const n = data.passages.length;
        return data.passages.map((p) => ({ p, score: wanted.reduce((v, w) => {
            const c = p.have.get(w);
            const df = data.seen.get(w) || 0;
            return c ? v + Math.log(1 + (n - df + 0.5) / (df + 0.5)) * 2.2 * c / (c + 1.2 * (0.25 + 0.75 * p.size / data.mean)) : v;
        }, 0) })).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, most).map((x) => x.p);
    }

    /** The sections that answer a question, best first, or none when the reader is not there or thinks little of them. */
    async function find(question, most = 2, least = 0.5) {
        if (typeof Judge !== 'object' || !Judge.ready() || !await load()) return [];
        const some = likely(question, 20);
        const p = await Judge.score(question, some.map((x) => `${x.title}: ${x.text}`));
        if (!p) return [];
        const best = new Map();
        some.forEach((x, i) => { if (p[i] >= least) best.set(x.at, Math.max(best.get(x.at) || 0, p[i])); });
        return [...best].sort((x, y) => y[1] - x[1]).slice(0, most).map(([at, chance]) => ({ ...data.pages[at], chance }));
    }

    return { load, find, index, use: (b) => { data = index(b); }, likely };
})();
