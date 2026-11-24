// Answers a question with what Wikipedia says. There is no AI here: it reads the question, finds and ranks sentences,
// puts them in order, and always names its sources.
const Ask = (() => {
    const STOP = new Set(('a an the of in on at to for from by with and or but is are was were be been being am do does did has have had can could will would shall should may might must not no what which '
        + 'who whom whose that this these those when where why how many much it its as about into than then there their they them you your i me my we our us please tell explain describe define write give '
        + 'list name mean means meaning definition short long note notes answer question detail details brief example examples between difference differences compare comparison vs versus '
        + 'क्या है हैं था थी थे कौन कब कहाँ कहां कैसे क्यों किसे किस का की के को में से पर और या एक यह वह ये वे होता होती होते बताओ बताइए समझाओ समझाइए परिभाषा अर्थ मतलब').split(' '));
    const LISTY = /\b(?:types?|kinds?|levels?|stages?|steps?|parts?|components?|functions?|features?|characteristics|advantages?|disadvantages?|benefits?|uses?|causes?|effects?|principles?|elements?|examples?|methods?|examples|symptoms?|objectives?|roles?|factors?|limitations?)\b/i;
    const HOSTS = { en: 'https://en.wikipedia.org', simple: 'https://simple.wikipedia.org', hi: 'https://hi.wikipedia.org' };
    const SIZES = { short: 3, medium: 7, long: 14 };
    const SKIP = /^(?:see also|references|notes|further reading|external links|bibliography|citations|sources|footnotes|gallery|works cited|इन्हें भी देखें|सन्दर्भ|संदर्भ|बाहरी कड़ियाँ)$/i;

    function stem(word) {
        let w = word.toLowerCase().replace(/['’]s$/, '');
        if (w.length > 4) w = w.replace(/ies$/, 'y').replace(/(?:ations?|ings?|ments?|ness|edly|ed|es|ly|s)$/, '');
        return w.length > 4 ? w.replace(/e$/, '') : w;
    }

    const words = (text) => text.match(/[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*/gu) || [];
    const terms = (text) => words(text).flatMap((w) => w.split('-')).map((w) => w.toLowerCase()).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

    /** What a question asks for, and the topic to look up. */
    function understand(question) {
        const q = question.replace(/\s+/g, ' ').trim().replace(/[?.!।\s]+$/, '');
        const versus = /\b(?:differences?|compare|comparison|distinguish|contrast)\b(?:\s+(?:is|are|between|of|the))*\s+(.{2,80}?)\s+(?:and|with|vs\.?|versus|from|to)\s+(.{2,80})$/i.exec(q) || /^(.{2,60}?)\s+(?:vs\.?|versus)\s+(.{2,60})$/i.exec(q);
        if (versus) return { kind: 'compare', topics: [versus[1], versus[2]].map((t) => t.replace(/^(?:the|a|an)\s+/i, '').trim()), q };
        const topic = q
            .replace(/^(?:please\s+)?(?:what|who|whom|which|where|when|why|how)\b(?:\s+(?:is|are|was|were|do|does|did|can|could|should|would|has|have|many|much|long|old|far|to|the|a|an|invented|discovered|founded|wrote)\b)*\s*/i, '')
            .replace(/^(?:please\s+)?(?:explain|describe|define|discuss|tell me(?: about)?|write(?: an?)?(?: short| brief)?(?: note| notes| answer)?(?: on| about)?|give(?: me)?(?: an?)?(?: short)?(?: note)?(?: on| about)?|(?:you|do you) mean by|(?:the )?meaning of|(?:the )?definition of|list(?: of)?(?: the)?)\s+/i, '')
            .replace(/^(?:you |do you )?mean by\s+/i, '').replace(/^(?:the|an?)\s+/i, '').replace(/\b(?:mean|means|work|works|happen|happens|occur|occurs)$/i, '').trim();
        // "Who invented the telephone" is told in an article on the invention.
        const made = /^who\s+(invented|discovered|founded|wrote|built|painted|designed)\s+(?:the\s+)?(.+)$/i.exec(q);
        if (made) return { kind: 'who', topics: [{ invented: `Invention of the ${made[2]}`, discovered: `Discovery of ${made[2]}`, founded: `Founding of ${made[2]}` }[made[1].toLowerCase()] || made[2], made[2]], q };
        const hindi = /\p{Script=Devanagari}/u.test(q);
        if (hindi) return { kind: /क्यों/.test(q) ? 'why' : /कब/.test(q) ? 'when' : /कितन/.test(q) ? 'number' : 'define', topics: [words(q).filter((w) => !STOP.has(w)).join(' ') || q], q };
        // "the capital of France": one fact about one thing.
        const fact = /^(?:what|who|which|where)\s+(?:is|are|was|were)\s+the\s+(.{2,40}?)\s+of\s+(?:the\s+)?(.{2,60})$/i.exec(q);
        if (fact && !LISTY.test(q)) return { kind: 'fact', topics: [`${fact[1]} of ${fact[2]}`, fact[2]], q };
        const kind = LISTY.test(q) ? 'list'
            : /^(?:what|who)\s+(?:is|are|was|were|do you mean)\b|^define\b|meaning of|definition of/i.test(q) ? 'define'
                : /^when\b|\b(?:in )?(?:which|what) year\b/i.test(q) ? 'when'
                    : /^how (?:many|much|long|old|far|tall|big|fast|high|deep)\b/i.test(q) ? 'number'
                        : /^why\b/i.test(q) ? 'why' : 'explain';
        // "levels of management": the article is called Management.
        const base = kind === 'list' ? / (?:of|in|for) (?:the |an? )?(.{3,60})$/i.exec(topic) : null;
        return { kind, topics: [topic || q, ...(base ? [base[1]] : [])], q };
    }

    /** Plain arithmetic, read by hand so that nothing is ever run as code. Returns null for anything else. */
    function calculate(text) {
        const s = text.replace(/^\s*(?:what is|calculate|solve|compute|how much is)\s+/i, '').replace(/[?=\s]+$/, '').replace(/×/g, '*').replace(/(\d)\s*x(?=\s*[\d(])/gi, '$1*').replace(/÷/g, '/').replace(/−/g, '-').replace(/(\d),(?=\d{2,3}(?:\D|$))/g, '$1')
            .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*/gi, '($1/100)*');
        if (s.length > 100 || !/^[\d\s.+\-*/^()]+$/.test(s) || !/[\d)]\s*[+\-*/^]\s*[\d(.-]/.test(s)) return null;
        const t = s.match(/\d+(?:\.\d+)?|[+\-*/^()]/g) || [];
        let i = 0;
        const power = () => {
            let v;
            if (t[i] === '-') {
                i++;
                return -power();
            }
            if (t[i] === '(') {
                i++;
                v = sum();
                if (t[i++] !== ')') throw new Error('bracket');
            } else if (/^\d/.test(t[i] || '')) v = Number(t[i++]);
            else throw new Error('number');
            if (t[i] !== '^') return v;
            i++;
            return v ** power();
        };
        const product = () => {
            let v = power();
            while (t[i] === '*' || t[i] === '/') v = t[i++] === '*' ? v * power() : v / power();
            return v;
        };
        const sum = () => {
            let v = product();
            while (t[i] === '+' || t[i] === '-') v = t[i++] === '+' ? v + product() : v - product();
            return v;
        };
        try {
            const v = sum();
            return i === t.length && Number.isFinite(v) ? { sum: s.trim(), value: Number(v.toPrecision(12)) } : null;
        } catch {
            return null;
        }
    }

    const SHORT = /(?:^|[\s(])(?:Mr|Mrs|Ms|Dr|St|vs|etc|e\.g|i\.e|c|ca|No|Inc|Ltd|Co|U\.S|U\.K|approx|[A-Z])\.$/;

    function sentencesOf(text) {
        const out = [];
        let held = '';
        for (const part of text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?।]["”')\]]?)\s+(?=["“(]?[\p{Lu}\p{Lo}\d])/u)) {
            held = held ? `${held} ${part}` : part;
            if (SHORT.test(held)) continue;
            out.push(held);
            held = '';
        }
        if (held) out.push(held);
        return out.filter((s) => words(s).length >= 5 && words(s).length <= 70 && /[.!?।]["”')\]]?$/.test(s) && !/\\displaystyle|\{\\/.test(s));
    }

    /** An article as sentences and list lines, each with its section. */
    function read(page) {
        const out = [];
        let section = '';
        let skip = false;
        let intro = null;
        for (const raw of page.text.split('\n')) {
            const line = raw.trim();
            const head = /^(={2,6})\s*(.+?)\s*\1$/.exec(line);
            if (head) {
                section = head[2];
                intro = null;
                if (head[1].length === 2) skip = SKIP.test(section);
                continue;
            }
            if (skip || !line || /\\displaystyle|\{\\/.test(line)) continue;
            const whole = sentencesOf(line);
            for (const text of whole) out.push({ text, section, place: out.length, page, item: false });
            if (/:$/.test(line) && words(line).length < 40) {
                intro = line;
            } else if (!whole.length && words(line).length >= 1 && words(line).length <= 40 && (intro || section)) {
                out.push({ text: line, section, place: out.length, page, item: true, intro });
            }
        }
        return out;
    }

    /** Scores every line against the question: BM25, with bonuses for the section, the place and the kind of answer. */
    function rank(asked, pages) {
        const all = pages.flatMap(read);
        const wanted = [...new Set(terms(asked.q))];
        const seen = new Map();
        for (const s of all) {
            s.terms = terms(s.text);
            for (const w of new Set(s.terms)) seen.set(w, (seen.get(w) || 0) + 1);
        }
        const mean = all.reduce((n, s) => n + s.terms.length, 0) / Math.max(1, all.length);
        const weight = (w) => Math.log(1 + (all.length - (seen.get(w) || 0) + 0.5) / ((seen.get(w) || 0) + 0.5));
        const titles = new Map(pages.map((p) => [p, new Set(terms(p.title))]));
        for (const s of all) {
            const have = new Map();
            for (const w of s.terms) have.set(w, (have.get(w) || 0) + 1);
            const head = new Set(terms(s.section));
            let score = 0;
            s.hits = 0;
            s.lead = !s.section;
            s.inHead = wanted.some((w) => head.has(w) && !titles.get(s.page).has(w));
            for (const w of wanted) {
                const n = have.get(w) || 0;
                if (n) s.hits++;
                score += weight(w) * (2.2 * n) / (n + 1.2 * (0.25 + 0.75 * s.terms.length / Math.max(1, mean)));
                if (head.has(w)) score += 0.9 * weight(w);
                if (titles.get(s.page).has(w)) score += 0.3;
            }
            if (s.place === 0) score += asked.kind === 'define' || asked.kind === 'compare' ? 7 : ['who', 'when', 'number', 'fact'].includes(asked.kind) ? 1 : 3;
            else if (!s.section) score += 1.5 / (1 + s.place / 3);
            if (asked.kind === 'when' && /\b(?:1\d{3}|20\d{2})\b/.test(s.text)) score += 2;
            if (asked.kind === 'number' && /\d/.test(s.text)) score += 2;
            if (asked.kind === 'why' && /\b(?:because|due to|since|caused?|causes|reasons?|results?|therefore|leads? to|led to)\b/i.test(s.text)) score += 2;
            if (asked.kind === 'who' && /\b(?:invent(?:ed|or|s)|discover(?:ed|er)|patent(?:ed)?|credited|founded|founder|wrote|written by|built by|designed by|first)\b/i.test(s.text) && /(?<=[\p{Ll},] )\p{Lu}\p{Ll}+/u.test(s.text)) score += 2.5;
            if (wanted.length > 1 && s.hits === wanted.length) score += asked.kind === 'fact' ? 5 : 1.5;
            if (asked.kind === 'compare' && !s.lead) score -= 4;
            if (/^(?:this is an? |the following is |below is )/i.test(s.text)) score -= 6;
            if (asked.kind === 'list' && (s.inHead || /\b(?:includ(?:e|es|ing)|such as|consists? of|divided into|classified|types|three|four|five|two|several)\b/i.test(s.text))) score += 1.5;
            if (s.item) score -= asked.kind === 'list' && s.inHead ? 0.5 : 6;
            // "This process..." points at a sentence that may not be shown.
            if (/^(?:this|these|those|such|he|she|they|it|however|also|for example|in addition|therefore|thus)\b/i.test(s.text) && s.place > 0) score -= 0.8;
            s.score = score * [1.3, 1, 0.85][Math.min(2, s.page.order)];
        }
        return { all, wanted };
    }

    /** Takes the best lines that say different things, and puts them back in reading order. */
    function choose(ranked, size) {
        const chosen = [];
        for (const s of [...ranked.all].sort((x, y) => y.score - x.score)) {
            if (chosen.length >= size) break;
            if (s.score <= 0 || (ranked.wanted.length && s.hits === 0 && s.place > 0 && !s.inHead)) continue;
            const mine = new Set(s.terms);
            const twin = !s.item && chosen.some((c) => [...new Set(c.terms)].filter((w) => mine.has(w)).length / Math.max(1, Math.min(new Set(c.terms).size, mine.size)) > 0.7);
            if (!twin) chosen.push(s);
        }
        const best = [...chosen].sort((x, y) => y.score - x.score)[0];
        chosen.sort((x, y) => (y.page === best.page) - (x.page === best.page) || x.page.order - y.page.order || x.place - y.place);
        const said = new Set(chosen.flatMap((s) => [...s.terms, ...terms(s.page.title), ...terms(s.section)]));
        return { chosen, cover: ranked.wanted.length ? ranked.wanted.filter((w) => said.has(w)).length / ranked.wanted.length : 0, wanted: ranked.wanted.length };
    }

    /** True when the chosen sentences hold the kind of thing that was asked for. */
    function sure(asked, got) {
        const any = (re, all = false) => got.chosen.some((s) => re.test(s.text) && (!all || s.hits >= Math.min(2, got.wanted)));
        if (got.cover < 0.6) return false;
        if (asked.kind === 'why') return any(/\b(?:because|due to|since|caused?|causes|reasons?|results? (?:from|in|of)|therefore|leads? to|led to|owing to)\b|क्योंकि|कारण/i, true);
        if (asked.kind === 'when') return any(/\b(?:1\d{3}|20\d{2})\b|[०-९]{4}/, true);
        if (asked.kind === 'number') return any(/\d|[०-९]/, true);
        if (asked.kind === 'who') return any(/\b(?:invent|discover|patent|credit|found|wr[io]t|buil[td]|paint|design)\p{L}*\b/iu, true);
        if (asked.kind === 'fact') return got.chosen.some((s) => s.hits >= got.wanted);
        return true;
    }

    async function get(lang, params) {
        const url = `${HOSTS[lang]}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
        const ask = () => fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) });
        // A connection that drops once is worth one more try.
        const r = await ask().catch(() => ask());
        if (r.status === 429) throw Object.assign(new Error('Wikipedia asks for a pause. Try again in a minute.'), { plain: true });
        if (!r.ok) throw Object.assign(new Error('Wikipedia could not answer. Try again.'), { plain: true });
        return r.json();
    }

    async function search(lang, query, n) {
        const found = await get(lang, { action: 'query', list: 'search', srsearch: query.slice(0, 250), srlimit: String(n), srprop: '' });
        return (found && found.query && Array.isArray(found.query.search) ? found.query.search : []).filter((x) => x && Number.isInteger(x.pageid) && typeof x.title === 'string');
    }

    /** How well a title fits: its words should be in the question, and the question's words in it. */
    function fit(title, wanted) {
        const mine = [...new Set(terms(title.replace(/\(.*?\)/g, '')))];
        if (!mine.length) return 0;
        const both = mine.filter((w) => wanted.has(w)).length;
        return 0.6 * both / mine.length + 0.4 * both / Math.max(1, wanted.size);
    }

    /** The titles worth reading, best first. Each search gives a little for its order. */
    function pickTitles(searches, asked) {
        const wanted = new Set(terms(asked.kind === 'compare' ? asked.topics.join(' ') : `${asked.topics.join(' ')} ${asked.q}`));
        const table = new Map();
        searches.forEach((list, k) => list.forEach((x, i) => {
            // A short name such as TCP is better known to the search than to the titles.
            const points = asked.kind === 'compare' ? 1 / (i + 1) + 0.3 * fit(x.title, wanted) : fit(x.title, wanted) + 0.5 / (i + 1) - 0.1 * k - (/^(?:list|index|outline|glossary|timeline) of\b/i.test(x.title) && asked.kind !== 'number' ? 0.4 : 0);
            const old = table.get(x.pageid);
            // Found by two searches is a little better than by one.
            table.set(x.pageid, { pageid: x.pageid, title: x.title, points: old ? Math.max(old.points, points + 0.12) : points });
        }));
        const sorted = [...table.values()].sort((x, y) => y.points - x.points);
        return asked.kind === 'compare' ? sorted : sorted.filter((x) => x.points > sorted[0].points - 0.45);
    }

    /** Reads articles whole, as plain text. Pages that only list other pages are left out. */
    async function articles(lang, titles, most) {
        const pages = await Promise.all(titles.slice(0, 3).map(async (x) => {
            const d = await get(lang, { action: 'query', prop: 'extracts|pageprops', explaintext: '1', exsectionformat: 'wiki', redirects: '1', ppprop: 'disambiguation', pageids: String(x.pageid) });
            const p = d && d.query && Array.isArray(d.query.pages) ? d.query.pages[0] : null;
            if (!p || typeof p.extract !== 'string' || !p.extract.trim() || (p.pageprops && 'disambiguation' in p.pageprops)) return null;
            const title = String(p.title);
            return { title, text: p.extract.slice(0, 300000), url: `${HOSTS[lang]}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` };
        }));
        return pages.filter(Boolean).slice(0, most).map((p, order) => ({ ...p, order }));
    }

    async function answer(question, lang, size) {
        const asked = understand(question);
        if (asked.kind === 'compare') {
            const parts = [];
            for (const topic of asked.topics) {
                const pages = await articles(lang, pickTitles([await search(lang, topic, 4)], { kind: 'compare', topics: [topic], q: topic }), 1);
                const ranked = rank({ kind: 'compare', q: topic }, pages);
                if (!ranked.all.length) continue;
                const got = choose(ranked, Math.max(3, Math.round(size / 2)));
                if (got.chosen.length) parts.push({ head: pages[0].title, ...got });
            }
            return { asked, parts, sure: parts.length > 1 };
        }
        const queries = [...new Set([...asked.topics, asked.q].map((t) => t.toLowerCase()))].slice(0, 3);
        // A reason is seldom in an article named after the words of the question, so the whole question leads.
        if (asked.kind === 'why' || asked.kind === 'number') queries.reverse();
        const searches = [];
        for (const q of queries) searches.push(await search(lang, q, 5));
        if (!searches.some((x) => x.length)) return { asked, parts: [] };
        const merged = await articles(lang, pickTitles(searches, asked), 3);
        const ranked = rank(asked, merged);
        if (!ranked.all.length) return { asked, parts: [] };
        const got = choose(ranked, size);
        return { asked, parts: got.chosen.length ? [{ head: '', ...got }] : [], sure: sure(asked, got) };
    }

    return { SIZES, answer, calculate, choose, pickTitles, rank, read, sentencesOf, sure, understand };
})();

(() => {
    const box = document.getElementById('ask');
    if (!box) return;
    const by = (id) => document.getElementById(id);
    const button = box.querySelector('button.main');
    const el = (tag, text) => {
        const node = document.createElement(tag);
        if (text) node.textContent = text;
        return node;
    };

    /** Builds the answer from text nodes only, so nothing from outside can become a tag. */
    function show(question, result) {
        const sources = [];
        const lines = [`# ${question}`, ''];
        const body = by('answer-body');
        body.replaceChildren();
        by('answer-title').textContent = question;
        for (const part of result.parts) {
            if (part.head) {
                body.append(el('h3', part.head));
                lines.push(`## ${part.head}`, '');
            }
            let section = null;
            let home = null;
            for (const s of part.chosen) {
                let n = sources.findIndex((x) => x.url === s.page.url) + 1;
                if (!n) n = sources.push(s.page);
                if (section !== s.section + s.page.url) {
                    section = s.section + s.page.url;
                    home = null;
                    if (s.section) {
                        body.append(el('h4', s.section));
                        lines.push(`### ${s.section}`, '');
                    }
                }
                const kind = s.item ? 'UL' : 'P';
                if (!home || home.tagName !== kind) {
                    home = el(kind);
                    body.append(home);
                    lines.push('');
                }
                const spot = s.item ? el('li') : home;
                spot.append(`${s.text} `, el('sup', `[${n}]`), ' ');
                if (s.item) {
                    home.append(spot);
                    lines.push(`- ${s.text} [${n}]`);
                } else if (home.childNodes.length > 3) lines[lines.length - 1] += ` ${s.text} [${n}]`;
                else lines.push(`${s.text} [${n}]`);
            }
            lines.push('');
        }
        by('sources').replaceChildren(...sources.map((s) => {
            const item = el('li');
            const link = el('a', `${s.title}, Wikipedia`);
            link.href = s.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            item.append(link);
            return item;
        }));
        const day = new Date().toLocaleDateString('en-GB', { dateStyle: 'long' });
        by('answer-text').value = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n\n## Sources\n\n${sources.map((s, i) => `${i + 1}. ${s.title}. Wikipedia. ${s.url} (read ${day})`).join('\n')}\n\nText from Wikipedia, licensed CC BY-SA 4.0.\n`;
        by('ask-note').textContent = result.sure ? '' : result.asked.kind === 'compare' ? 'Only one of the two was found.'
            : 'Not sure: these sentences are about the topic but may not answer the question. Check the sources, or ask it another way.';
        by('answer').hidden = false;
        by('answer').scrollIntoView();
    }

    box.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (button.disabled) return;
        const question = by('question').value.replace(/\s+/g, ' ').trim();
        by('answer').hidden = true;
        by('sum').hidden = true;
        by('ask-note').textContent = '';
        if (question.length < 2) {
            by('ask-note').textContent = 'Type a question first.';
            return;
        }
        const done = Ask.calculate(question);
        if (done) {
            by('sum').textContent = `${done.sum} = ${done.value.toLocaleString('en-IN', { maximumFractionDigits: 10 })}`;
            by('sum').hidden = false;
            return;
        }
        button.disabled = true;
        button.textContent = 'Searching Wikipedia...';
        try {
            const result = await Ask.answer(question, by('lang').value, Ask.SIZES[by('size').value] || 7);
            if (result.parts.length) show(question, result);
            else by('ask-note').textContent = 'Nothing was found for this question. Use the main words of the topic, and check the spelling.';
        } catch (error) {
            by('ask-note').textContent = error.plain ? error.message : 'Wikipedia could not be reached. Check your connection and try again.';
        } finally {
            button.disabled = false;
            button.textContent = 'Find the answer';
        }
    });
})();
