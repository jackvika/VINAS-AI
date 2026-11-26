// Measures the site as a visitor sees it: the real page stands in a frame, gets each question, and what it shows is marked.
// Started by tests/evaluate.py, which also keeps what Wikipedia said, so that two runs see the same sources.
(async () => {
    const wants = new URLSearchParams(location.search);
    const what = (wants.get('what') || 'parse,quality').split(',');
    const held = wants.get('set') === 'held';
    const only = wants.get('only') ? new RegExp(wants.get('only'), 'i') : null;
    const now = document.getElementById('now');
    const say = (text) => {
        now.textContent = text;
        fetch('/progress', { method: 'POST', body: text }).catch(() => {});
    };
    const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });
    const json = async (path) => (await fetch(path)).json();

    // ---- The page in the frame ----

    const frame = document.getElementById('site');
    const site = frame.contentWindow;
    if (site.document.readyState !== 'complete' || !site.document.getElementById('ask')) await new Promise((done) => { frame.addEventListener('load', done, { once: true }); });
    const by = (id) => site.document.getElementById(id);
    const until = async (test, ms) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (test()) return true;
            await sleep(50);
        }
        return false;
    };
    const door = site.document.createElement('script');
    door.src = '/tests/expose.js';
    await new Promise((done, fail) => {
        door.onload = done;
        door.onerror = fail;
        site.document.head.append(door);
    });
    const { Ask, Parse, Judge, Book } = site.VINAS;

    // What Wikipedia said is kept, and everything read is remembered to see which sentence stood before which.
    const flat = (text) => site.VINAS.Ask.british(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const read = new Map();
    const direct = site.fetch.bind(site);
    let asked = 0;
    site.fetch = async (url, options) => {
        if (!/wikipedia\.org/.test(String(url))) return direct(url, options);
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(url)));
        const key = [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('');
        const kept = await fetch(`/cache/${key}`);
        let body = kept.ok ? await kept.text() : null;
        if (body === null) {
            for (let tries = 0; ; tries++) {
                const r = await direct(url, { ...options, signal: AbortSignal.timeout(20000) });
                if (r.status === 429 && tries < 6) {
                    await sleep(5000 * (tries + 1));
                    continue;
                }
                if (!r.ok) return r;
                body = await r.text();
                break;
            }
            asked++;
            await sleep(120);
            await fetch(`/cache/${key}`, { method: 'PUT', body });
        }
        try {
            for (const page of (JSON.parse(body).query || {}).pages || []) if (page.extract) read.set(page.title, flat(page.extract));
        } catch { /* not a page */ }
        return new site.Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    await until(() => by('subject').options.length > 5, 15000);
    say('Loading the reader and the books');
    const reader = await Judge.load();
    await Book.load();
    for (const name of await json('/books')) {
        const book = await json(`../static/books/${name}`);
        for (const m of book.modules) read.set(`${name} ${m.title} ${read.size}`, flat(m.text.map((t) => t[2]).join(' ')));
    }
    const bba = await json('../static/bba.json');

    /** Asks the page and gives back what it shows. */
    const ask = async (question, lang = 'en') => {
        by('question').value = question;
        by('lang').value = lang;
        by('subject').value = '';
        by('size').selectedIndex = 0;
        for (let tries = 0; tries < 3; tries++) {
            by('ask').requestSubmit();
            await sleep(30);
            await until(() => !by('ask').querySelector('button.main').disabled, 180000);
            if (!/could not be reached|asks for a pause|could not answer/.test(by('ask-note').textContent)) break;
            await sleep(8000);
        }
        // The page keeps the topic for a follow-up question; each question here stands alone.
        const shown = !by('answer').hidden;
        const out = { understood: by('understood') ? by('understood').textContent : '', note: by('ask-note').textContent, text: shown ? by('answer-text').value : '', sentences: [], made: [], gap: '', unsure: !shown };
        if (!shown) return out;
        if (/not sure: no right answer/i.test(`${out.note} ${out.text.slice(0, 400)}`)) out.unsure = true;
        out.gap = [out.note, ...(out.text.match(/^.*(?:No sure answer was found for|Not found in sources)[^\n]*$/gim) || [])].join(' ');
        let h3 = '';
        let h4 = '';
        let block = 0;
        for (const node of by('answer-body').querySelectorAll('h3, h4, p, li, .prepared')) {
            // What is folded away was not given as an answer.
            if (node.closest('details')) continue;
            if (node.matches('.prepared') || node.closest('.prepared')) {
                if (node.matches('.prepared')) out.made.push(node.textContent);
                continue;
            }
            if (node.tagName === 'H3') [h3, h4] = [node.textContent, ''];
            else if (node.tagName === 'H4') h4 = node.textContent;
            else {
                if (node.tagName === 'P' && !node.querySelector('sup')) {
                    out.made.push(node.textContent);
                    continue;
                }
                const copy = node.cloneNode(true);
                copy.querySelectorAll('sup').forEach((x) => x.remove());
                const text = copy.textContent.replace(/\s+/g, ' ').trim();
                const list = node.tagName === 'LI' ? [text] : Ask.sentencesOf(text);
                block++;
                for (const s of list.length ? list : [text]) out.sentences.push({ text: s, head: h3, sub: h4, item: node.tagName === 'LI', block });
            }
        }
        out.words = out.sentences.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
        return out;
    };

    const rate = (good, all) => (all ? Math.round(1000 * good / all) / 10 : null);
    const result = { when: new Date().toISOString(), reader, set: wants.get('set') || 'working' };

    // ---- How questions are read ----

    const name = (t) => ` ${String(t || '').toLowerCase()} `.replace(/['’`"“”]/g, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/ (?:the|a|an) /g, ' ').replace(/isation/g, 'ization').replace(/ising/g, 'izing').replace(/labell/g, 'label')
        .trim().split(' ').map((w) => (w.length > 4 ? w.replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : w)).join(' ');

    let mend = null;
    const speller = async () => {
        const counts = new Map(Book.used);
        for (const c of bba.courses) for (const u of c.units) for (const t of u.topics) for (const w of t.toLowerCase().match(/[a-z]{4,}/g) || []) counts.set(w, (counts.get(w) || 0) + 1);
        for (const w of (await (await fetch('../static/vendor/vocab.txt')).text()).split('\n')) if (/^[a-z]{4,}$/.test(w.trim()) && !counts.has(w.trim())) counts.set(w.trim(), 1);
        return Parse.speller(counts);
    };
    /** The subject as the page guessed it before there was a structured query (copied from static/ask.js at 086472c). */
    let topics = null;
    const guessed = (question) => {
        const t = (x) => [...new Set(Ask.coreOf({ topics: [x], q: x }))];
        if (!topics) {
            topics = { list: [], df: new Map() };
            for (const c of bba.courses) if (c.books.length) for (const x of [c.title, ...c.units.flatMap((u) => [u.title, ...u.topics])]) topics.list.push([new Set(t(x)), c]);
            for (const [set] of topics.list) for (const w of set) topics.df.set(w, (topics.df.get(w) || 0) + 1);
        }
        const q = t(Ask.understand(question).topics[0] || question);
        if (!q.length || q.length > 8) return '';
        const idf = (w) => Math.log(1 + topics.list.length / (1 + (topics.df.get(w) || 0)));
        const all = q.reduce((n, w) => n + idf(w), 0);
        let best = '';
        let points = 0;
        for (const [set, c] of topics.list) {
            const both = q.filter((w) => set.has(w));
            if (!both.length) continue;
            const hit = both.reduce((n, w) => n + idf(w), 0);
            const v = hit / all + 0.5 * hit / [...set].reduce((n, w) => n + idf(w), 0) + (/^Semester [1-3]/.test(c.group) ? 0.04 : 0);
            if (hit / all > 0.75 && v > points) [best, points] = [c.title, v];
        }
        return points > 1.1 ? best : '';
    };
    const ASPECT = { meaning: 'definition', elements: 'types', techniques: 'types', methods: 'types', roles: 'functions' };
    /** "objectives of FERA", as one part: the old parser left a single question whole. */
    const lone = (topic) => {
        const m = /^(?:the )?(?:(?:various|different|main|salient) )?(definition|meaning|concept|features|characteristics?|nature|scope|importance|significance|objectives|types|kinds|process|steps|stages|principles|functions|role|advantages|merits|benefits|disadvantages|limitations|factors|elements|methods) (?:of|in) (?:the )?(.{2,80})$/i.exec(topic || '');
        const to = { meaning: 'definition', concept: 'default', characteristic: 'features', characteristics: 'features', nature: 'features', significance: 'importance', kinds: 'types', steps: 'process', stages: 'process', role: 'functions', merits: 'advantages', benefits: 'advantages', disadvantages: 'limitations', elements: 'types', methods: 'types' };
        return m && m[1].toLowerCase() !== 'concept' ? { topic: m[2], facet: to[m[1].toLowerCase()] || m[1].toLowerCase() } : null;
    };
    /** The structured query. Before the parser gave one, what it did give is put in the same form. */
    const query = (q) => {
        if (typeof Parse.query === 'function') return Parse.query(q, { known: mend });
        const plan = /\p{Script=Devanagari}/u.test(q) ? { q, parts: [] } : Parse.plan(q, mend, '');
        const told = Ask.wish(q);
        const sense = Ask.understand(plan.q || q);
        const whole = (topic) => ['definition', 'features', 'importance'].map((facet) => ({ topic, facet }));
        const parts = plan.parts.length ? plan.parts.flatMap((p) => (p.compare ? [{ topic: p.head.replace(/^Difference between /, ''), facet: 'comparison' }]
            : p.aspect ? [{ topic: p.topic, facet: ASPECT[p.aspect[0]] || p.aspect[0] }]
                : p.statement ? [{ topic: p.topic, facet: 'statement' }]
                    : /^(?:what (?:is|are)|define)\b/i.test(p.q) ? [{ topic: p.topic, facet: 'definition' }] : whole(p.topic)))
            : sense.kind !== 'compare' && lone(sense.topics[0]) ? [lone(sense.topics[0])]
            : sense.kind === 'compare' ? [{ topic: sense.topics.join(' and '), facet: 'comparison' }] : sense.kind === 'define' ? [{ topic: sense.topics[0], facet: 'definition' }] : whole(sense.topics[0]);
        const marks = /[([]?\s*(?:for\s+)?(\d{1,2})\s*(?:marks?|अंक)\s*[)\]]?/i.exec(q);
        return { parts: parts.map((p) => ({ ...p, weight: 1 })), command: sense.kind === 'compare' ? 'compare' : sense.kind === 'define' && parts.length === 1 ? 'define' : sense.kind === 'list' ? 'list' : 'explain', marks: marks ? Number(marks[1]) : null, words: told.words || 400, subject: guessed(q), language: /\p{Script=Devanagari}/u.test(q) ? 'hi' : 'en', alternatives: [] };
    };
    const WORDS = [[2, 50], [3, 80], [5, 180], [6, 220], [7.5, 280], [10, 400], [12, 480], [15, 600], [16, 640], [20, 800]];
    const wordsFor = (marks) => {
        if (marks === null) return 400;
        const k = WORDS.findIndex(([m]) => m >= marks);
        if (k < 0) return 800;
        if (k === 0) return 50;
        const [[a, x], [b, y]] = [WORDS[k - 1], WORDS[k]];
        return Math.round(x + (y - x) * (marks - a) / (b - a));
    };

    if (what.includes('parse')) {
        say('Reading questions');
        mend = await speller();
        if (Parse.teach) Parse.teach({ bba, glossary: await json('../static/glossary.json'), statements: await json('../static/statements.json') });
        // The past papers count with the rest, and by themselves under their tag.
        const kept = held ? await json('held_back.json') : null;
        const cases = held ? [...kept.parse, ...kept.past_papers.filter((x) => x.want)] : (await json('parse_cases.json')).cases;
        const fields = { topic: 0, facets: 0, command: 0, marks: 0, words: 0, subject: 0, language: 0, weights: 0, whole: 0 };
        let weighted = 0;
        const tags = {};
        const bad = [];
        for (const c of cases) {
            let got;
            try { got = query(c.q); } catch (error) { got = { parts: [], command: '', marks: null, words: 0, subject: '', language: '', alternatives: [], error: error.message }; }
            const ways = [c.want.parts, ...(c.want.otherwise || [])];
            const named = (p) => (p.topics || [p.topic]).map(name);
            const topicOf = (list) => list.map((p) => name(p.topic));
            const mine = [...new Set(topicOf(got.parts))];
            const okTopic = ways.some((w) => w.every((p) => named(p).some((t) => mine.includes(t))) && mine.every((t) => w.some((p) => named(p).includes(t))));
            const bag = (list) => list.map((p) => p.facet).sort().join();
            const okFacet = ways.some((w) => bag(w) === bag(got.parts));
            /** The same parts, each once. */
            const same = (w, list, weigh) => {
                const left = [...list];
                for (const p of w) {
                    const k = left.findIndex((g) => g.facet === p.facet && named(p).includes(name(g.topic)) && (!weigh || Math.abs((g.weight === undefined ? 1 : g.weight) - (p.weight === undefined ? 1 : p.weight)) < 0.01));
                    if (k < 0) return false;
                    left.splice(k, 1);
                }
                return !left.length;
            };
            const weigh = c.want.parts.some((p) => p.weight !== undefined);
            const okParts = ways.some((w) => same(w, got.parts, false));
            const okWeight = !weigh || ways.some((w) => same(w, got.parts, true));
            const ok = { topic: okTopic, facets: okFacet, command: c.want.command.includes(got.command), marks: got.marks === c.want.marks, words: Math.abs(got.words - wordsFor(c.want.marks)) < 2, subject: c.want.subject.includes(got.subject), language: got.language === c.want.language };
            const okAlt = !c.want.alternative || (got.alternatives || []).some((a) => same(c.want.alternative, a.parts || [], false));
            const okWith = !c.want.with || c.want.with.every((x) => (got.with || []).includes(x));
            const whole = okParts && okWeight && okAlt && okWith && ok.command && ok.marks && ok.words && ok.subject && ok.language;
            for (const k of Object.keys(ok)) if (ok[k]) fields[k]++;
            if (weigh) {
                weighted++;
                if (okWeight) fields.weights++;
            }
            if (whole) fields.whole++;
            for (const t of c.tags) {
                tags[t] = tags[t] || [0, 0, 0];
                tags[t][1]++;
                if (whole) tags[t][0]++;
                if (okTopic) tags[t][2]++;
            }
            if (!whole) bad.push({ q: c.q, tags: c.tags, wrong: [...Object.keys(ok).filter((k) => !ok[k]), ...(okParts ? [] : ['parts']), ...(okWeight ? [] : ['weights']), ...(okAlt ? [] : ['alternative']), ...(okWith ? [] : ['with'])], got: { ...got, original: undefined } });
        }
        result.parse = { questions: cases.length, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, rate(v, k === 'weights' ? weighted : cases.length)])), tags: Object.fromEntries(Object.entries(tags).map(([k, [a, b, t]]) => [k, `whole ${a}/${b}, topic ${t}/${b}`])), wrong: held ? undefined : bad };
        say(`Questions read: topic ${result.parse.topic}%, whole ${result.parse.whole}%`);
    }

    if (what.includes('read')) {
        // How some questions are read, one on each line.
        mend = await speller();
        Parse.teach({ bba, glossary: await json('../static/glossary.json'), statements: await json('../static/statements.json') });
        result.answers = {};
        for (const q of (wants.get('q') || '').split(/\r?\n/).filter(Boolean)) {
            const r = query(q);
            result.answers[q] = `${q}
   ${r.parts.map((p) => `${p.topic}: ${p.facet}${p.weight === 1 ? '' : ` x${p.weight}`}${p.known ? '' : ' ?'}`).join('; ')}
   ${r.subject || '(no subject)'}, ${r.command}, ${r.marks} marks, ${r.words} words, ${r.language}, confidence ${r.confidence}${r.course ? '' : ', not of the course'}${r.with.length ? `, with ${r.with}` : ''}${r.fixed.length ? `, spelling ${r.fixed.map((x) => x.join(' to '))}` : ''}${r.alternatives.map((a) => `
   or (${a.why}) ${a.parts.map((p) => `${p.topic}: ${p.facet}`).join('; ')}`).join('')}`;
        }
    }

    if (what.includes('page')) {
        // What a visitor can do with the line above an answer, and with the picker.
        const checks = {};
        const done = async () => { await sleep(30); await until(() => !by('ask').querySelector('button.main').disabled, 180000); };
        const line = () => by('understood').querySelector('.query').textContent;
        const chips = () => [...by('understood').querySelectorAll('.part')];
        const pressed = async (text) => { [...by('understood').querySelectorAll('button')].find((x) => x.textContent === text).click(); await done(); };
        say('The line above an answer');
        await ask('Q.2 Define planing. Explain its types and importance. (10M)');
        checks['the line'] = line() === 'Understood as: Planning: definition, types, importance · Principles and Practices of Management · 10 marks (~400 words)';
        checks['spelling is told'] = /Spelling read as: planning/.test(by('understood').textContent);
        checks['labelled'] = /^Prepared by VINAS/.test(by('understood').textContent);
        const copy = by('answer-text').value;
        checks['in the copy'] = copy.includes(`Prepared by VINAS. ${line()}`) && copy.includes('Study notes with sources. Write the answer in your own words for exams and assignments.');
        checks['study notes on the page'] = /Study notes with sources/.test(by('answer').textContent);
        chips()[2].click();
        await pressed('Remove');
        checks['a part is removed'] = chips().length === 2 && /Planning: definition, types ·/.test(line());
        chips()[1].click();
        by('understood').querySelector('.edit select').value = 'advantages';
        await pressed('Change');
        checks['a part is changed'] = /Planning: definition, advantages ·/.test(line()) && by('answer-text').value.includes('Advantages of planning');
        await ask('Define recruitment and explain its sources OR Discuss the methods of training.');
        const other = by('understood').querySelector('.mean .chip');
        checks['the other question is offered'] = Boolean(other) && /training/i.test(other.textContent);
        other.click();
        await done();
        checks['the other question is answered'] = /Training: types/.test(line()) && Boolean(by('understood').querySelector('.mean .chip'));
        await ask('"Motivation makes everything simpler for those who hold it." Discuss.');
        checks['not sure is told'] = Boolean(by('understood').querySelector('.low'));
        by('semester').value = 'Semester 2';
        by('semester').dispatchEvent(new site.Event('change'));
        const open = [...by('subject').querySelectorAll('optgroup')].filter((x) => !x.hidden);
        checks['the semester narrows the subjects'] = open.length === 1 && open[0].label === 'Semester 2';
        by('subject').value = 'CC202';
        by('subject').dispatchEvent(new site.Event('change'));
        checks['the subject is remembered'] = site.localStorage.getItem('vinas-subject') === 'CC202' && site.localStorage.getItem('vinas-semester') === 'Semester 2';
        site.localStorage.clear();
        by('semester').value = '';
        by('semester').dispatchEvent(new site.Event('change'));
        await ask('What is photosynthesis?');
        checks['other questions as before'] = /Understood as a definition\. Topic: photosynthesis/.test(by('understood').textContent) && !by('answer').hidden;
        checks['nothing from outside is HTML'] = !by('understood').querySelector('img, script') && (await (async () => { await ask('Explain <img src=x onerror=alert(1)> planning'); return !by('answer').querySelector('img'); })());
        await ask('Distinguish between recruitment and selection. (10 marks)');
        const label = 'Prepared by VINAS, not quoted from a source';
        checks['a prepared table'] = Boolean(by('answer-body').querySelector('.prepared table')) && by('answer-text').value.includes(`${label}. Comparison of recruitment and selection:`) && by('answer-body').querySelector('.prepared .made').textContent === label;
        await ask('Explain the levels of management with the help of a neat diagram.');
        checks['a prepared diagram'] = Boolean(by('answer-body').querySelector('.prepared svg.pyramid')) && by('answer-text').value.includes(`${label}. Diagram, Levels of management`);
        const also = [...by('answer-body').querySelectorAll('.prepared .chip')].find((x) => x.textContent === 'managerial skills');
        checks['also mention'] = Boolean(also) && by('answer-text').value.includes('Also mention for extra marks: managerial skills');
        also.click();
        await done();
        checks['a link asks its topic'] = /^Understood as: Managerial skills/.test(line());
        await ask('Explain grapevine communication with diagram.');
        checks['no diagram is told'] = /No prepared diagram is available/.test(by('answer-text').value);
        result.page = checks;
        result.answers = { page: Object.entries(checks).map(([k, v]) => `${v ? 'ok  ' : 'FAIL'}  ${k}`).join('\n') };
    }

    // ---- What answers cover ----

    const LINKED = /^(?:this|these|that|those|such|thus|however|therefore|unlike|also|it|they|he|she|his|her|its|their|hence|because of this|as a result|in contrast|on the other hand|similarly|moreover|furthermore|in addition|additionally|for example|for instance|instead|then|consequently|conversely|but|and|so|yet|another|both of these|finally|second|third)\b/i;
    const POINTS_BACK = /\b(?:this|these|such)\s+(?!(?:as|is|are|was|were|an?|that|can|may|will|means?|has|have|would|could|should|includes?|requires?)\b)[a-z]+/i;
    const SIGNPOST = /\b(?:we (?:now )?turn (?:now )?to|we turn now|we now|in this (?:chapter|section|module|unit|lesson|text|book)|as (?:we will|we'll|you will|you'll) see|as (?:discussed|mentioned|noted|described|seen|explained|we saw|we have seen) (?:earlier|above|before|previously|in)|learning (?:objectives?|outcomes?)|(?:figure|exhibit|table) \d+|see (?:chapter|section|figure|table|exhibit)|next section|previous (?:section|chapter)|later in (?:this|the) (?:chapter|section|book)|(?:this|the) (?:chapter|section|module) (?:will|is|covers|looks|discusses|examines|explores|begins)|(?:is|are|as) (?:shown|listed|described|discussed|explained|given|summarized|presented|illustrated|outlined) (?:below|above|in (?:figure|table|exhibit))|the following (?:section|paragraph|chapter|discussion|are|is|list|table)|let(?:'|’)?s (?:look|turn|consider|examine|explore)|let us (?:look|turn|consider|examine|explore)|we (?:will|shall) (?:look|discuss|examine|explore|consider|turn|learn|focus|see|describe))\b/i;
    const STOP = new Set('the a an of to in on for and or is are was were be been being as by with at from that this these those it its their they them he she his her which who whom what when where how not no but if than then so such can may will would should could has have had do does did also into more most other some any each all both one two there about over under between through during within without'.split(' '));
    const grams = (text) => new Set((text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(?:ations?|ings?|ments?|ed|es|s)$/, '')));
    const alike = (a, b) => {
        const [x, y] = [grams(a), grams(b)];
        const both = [...x].filter((w) => y.has(w)).length;
        return both / Math.max(1, x.size + y.size - both);
    };
    const plain = (t) => t.replace(/isation/gi, 'ization').replace(/([a-z])ise(d|s|r|rs)?\b/gi, '$1ize$2').replace(/([a-z])ising\b/gi, '$1izing').replace(/behaviour/gi, 'behavior').replace(/labour/gi, 'labor').replace(/neighbour/gi, 'neighbor').replace(/favour/gi, 'favor').replace(/fulfill/gi, 'fulfil').replace(/centre/gi, 'center').replace(/colour/gi, 'color').replace(/honour/gi, 'honor').replace(/analys(e|ed|es|ing)\b/gi, 'analyz$1').replace(/(model|label|travel|counsel|level)l(ed|ing)/gi, '$1$2');
    /** True when the sentence before this one in its source is the one shown before it. */
    const follows = (before, s) => {
        if (!before) return false;
        const [x, y] = [flat(before.text), flat(s.text)];
        for (const text of read.values()) {
            for (let at = text.indexOf(y); at > 0; at = text.indexOf(y, at + 1)) if (text.slice(Math.max(0, at - 60), at).endsWith(x.slice(-40))) return true;
        }
        return false;
    };
    const has = (group, text) => group.some((w) => new RegExp(/^\\b|^\(/.test(w) ? w : `(?:^|[^\\p{L}])${w}`, 'iu').test(text));

    const mark = (c, got) => {
        const shown = got.unsure && !got.sentences.length ? [] : got.sentences.map((s) => ({ ...s, plain: plain(s.text), heads: plain(`${s.head} ${s.sub}`) }));
        // Each group has its word in the sentence or in its heading, and at least one in the sentence itself.
        const met = (p) => shown.some((s) => {
            const here = p.all.map((g) => has(g, s.plain));
            return here.some(Boolean) && p.all.every((g, i) => here[i] || (p.all.length > 1 && has(g, s.heads)));
        });
        const points = c.points.map((p) => ({ name: p.name, met: met(p) }));
        const on = new RegExp(plain(c.on), 'i');
        const off = c.off ? new RegExp(c.off, 'i') : null;
        // A sentence that leans on the one before it, and is shown with it, has its topic from there.
        const leans = (s, i) => (LINKED.test(s.text) || POINTS_BACK.test(s.text.split(/,/)[0])) && i > 0 && on.test(shown[i - 1].plain) && follows(shown[i - 1], s);
        const named = (s) => { const m = /^([^.:–—]{3,70}?)\s*(?:\s[-–—]\s|:\s)/.exec(s.text); return Boolean(m) && s.sub && [...grams(m[1])].some((w) => grams(s.sub).has(w)); };
        const offTopic = shown.filter((s, i) => (off && off.test(s.plain)) || !(named(s) || on.test(s.plain) || (s.item && on.test(s.heads)) || leans(s, i)));
        const facet = shown.filter((s) => c.facet_off.some((f) => new RegExp(f.under, 'i').test(`${s.head} ${s.sub}`) && new RegExp(f.phrases, 'i').test(s.plain)));
        const dangling = shown.filter((s, i) => !s.item && !named(s) && (LINKED.test(s.text) || POINTS_BACK.test(s.text.split(/,/)[0].split(/\s+/).slice(0, 9).join(' '))) && !follows(shown[i - 1], s));
        const signposts = shown.filter((s) => SIGNPOST.test(s.text));
        let pairs = 0;
        const repeats = [];
        for (let i = 0; i < shown.length; i++) for (let k = i + 1; k < shown.length; k++) {
            pairs++;
            if (alike(shown[i].text, shown[k].text) >= 0.6) repeats.push([shown[i].text, shown[k].text]);
        }
        const missing = points.filter((p) => !p.met);
        const gap = plain(got.gap).toLowerCase();
        const honest = missing.filter((p) => got.unsure || (gap && [...grams(plain(p.name))].some((w) => gap.includes(w))));
        const out = { q: c.q, tags: c.tags, words: got.words || 0, unsure: got.unsure, sentences: shown.length, coverage: rate(points.length - missing.length, points.length), missing: missing.map((p) => p.name), offTopic: offTopic.map((s) => s.text), facet: facet.map((s) => s.text), dangling: dangling.map((s) => s.text), signposts: signposts.map((s) => s.text), repeats, pairs, honest: honest.length };
        if (c.rubric) {
            const total = c.rubric.reduce((n, r) => n + r.marks, 0);
            const lost = [];
            let sum = 0;
            for (const r of c.rubric) {
                const n = r.points.filter((x) => points.find((p) => p.name === x).met).length;
                sum += r.marks * n / r.points.length;
                if (n < r.points.length) lost.push([r.marks * (1 - n / r.points.length), r.points.length > 1 ? `${r.points.length - n} of ${r.points.length} named points (${r.points.filter((x) => !points.find((p) => p.name === x).met).slice(0, 4).join(', ')}...)` : r.points[0]]);
            }
            // Half a mark for each sentence that is off topic, about another facet or a signpost, a quarter for each that dangles or repeats.
            const wrong = new Set([...offTopic, ...facet, ...signposts].map((s) => s.text)).size;
            const cut = Math.min(0.3 * total, 0.5 * wrong + 0.25 * (dangling.length + repeats.length));
            if (cut) lost.push([cut, `${wrong} off-topic, wrong-facet or signpost and ${dangling.length + repeats.length} dangling or repeated sentences`]);
            out.mark = Math.max(0, Math.round(2 * (sum - cut)) / 2);
            out.of = total;
            out.lost = lost.sort((a, b) => b[0] - a[0]).slice(0, 4).map(([n, t]) => `-${Math.round(10 * n) / 10} ${t}`).join('; ') || 'nothing';
        }
        return out;
    };

    if (what.includes('quality')) {
        let cases = held ? (await json('held_back.json')).quality : (await json('answer_quality.json')).cases;
        if (wants.get('set') === 'hindi') {
            // Each Hindi question has the key points of an English one.
            const english = new Map(cases.map((c) => [c.q, c]));
            cases = (await json('hindi_cases.json')).cases.map((c) => ({ ...english.get(c.as), q: c.q }));
        }
        if (only) cases = cases.filter((c) => only.test(c.q));
        const rows = [];
        result.answers = {};
        for (const [i, c] of cases.entries()) {
            say(`Answer ${i + 1} of ${cases.length}: ${c.q.slice(0, 70)}`);
            const got = await ask(c.q);
            const row = { ...mark(c, got), understood: got.understood, note: got.note };
            rows.push(row);
            if (!held) result.answers[c.q] = got.text || got.note;
        }
        const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
        const sentences = sum((r) => r.sentences);
        const all = cases.reduce((n, c) => n + c.points.length, 0);
        const missed = sum((r) => r.missing.length);
        const marked = rows.filter((r) => r.mark !== undefined);
        result.quality = {
            questions: rows.length, unsure: rows.filter((r) => r.unsure).length, sentences, words: sum((r) => r.words),
            coverage: rate(all - missed, all),
            offTopic: rate(sum((r) => r.offTopic.length), sentences), facetMismatch: rate(sum((r) => r.facet.length), sentences),
            repetition: rate(sum((r) => r.repeats.length), sum((r) => r.pairs)), repeatedPairs: sum((r) => r.repeats.length), dangling: rate(sum((r) => r.dangling.length), sentences), signposts: rate(sum((r) => r.signposts.length), sentences),
            gapHonesty: rate(sum((r) => r.honest), missed),
            marks: marked.length ? `${sum((r) => r.mark || 0)} of ${sum((r) => r.of || 0)}` : null, marksPercent: rate(sum((r) => r.mark || 0), sum((r) => r.of || 0)),
            rows: held ? rows.map(({ q, coverage, unsure, missing, understood }) => ({ q, coverage, unsure, missing, understood })) : rows,
        };
    }

    if (what.includes('ask')) {
        const got = await ask(wants.get('q'));
        result.answers = { [wants.get('q')]: `${got.understood}
${got.note}

${got.text}` };
    }

    // ---- Short questions of general knowledge ----

    if (what.includes('general')) {
        const cases = (await json('general_cases.json')).cases;
        let good = 0;
        let silent = 0;
        const rows = [];
        for (const [i, [q, lang, want]] of cases.entries()) {
            say(`General ${i + 1} of ${cases.length}: ${q.slice(0, 60)}`);
            const got = await ask(q, lang);
            const found = new RegExp(want, 'i').test(got.sentences.map((s) => s.text).join(' '));
            if (found && !got.unsure) good++;
            else if (!got.unsure) silent++;
            if (!found || got.unsure) rows.push(`${got.unsure ? 'unsure' : 'WRONG'} | ${q} | ${got.sentences.map((s) => s.text).join(' ').slice(0, 160)}`);
        }
        result.general = { questions: cases.length, right: good, wrongWithoutWarning: silent, rows };
    }

    // ---- SQuAD: the right sentence among all those of the article ----

    if (what.includes('squad')) {
        const data = await json('/squad.json');
        const tops = { bm25: [0, 0, 0], reader: [0, 0, 0], site: [0, 0, 0] };
        let n = 0;
        for (const [i, article] of data.data.entries()) {
            say(`SQuAD article ${i + 1} of ${data.data.length}`);
            const paras = article.paragraphs.map((p) => p.context.replace(/\s+/g, ' ').trim());
            const page = { title: article.title.replace(/_/g, ' '), text: paras.join('\n'), url: article.title, order: 0, pageid: i };
            const every = article.paragraphs.flatMap((p, k) => p.qas.map((x) => ({ q: x.question.trim(), k, answers: x.answers.map((y) => y.text) })));
            // Ten for each article, spread evenly.
            for (let j = 0; j < 10 && j < every.length; j++) {
                const { q, k, answers } = every[Math.floor((j + 0.5) * every.length / 10)];
                const about = Ask.understand(q);
                const ranked = Ask.rank(about, [page]);
                const before = new Map(ranked.all.map((s) => [s, s.score]));
                await Ask.judge(about, ranked);
                const right = (s) => paras[k].includes(s.text) && answers.some((x) => s.text.includes(x));
                const top = (key) => [...ranked.all].sort((a, b) => key(b) - key(a)).slice(0, 5).findIndex(right);
                n++;
                for (const [id, key] of [['bm25', (s) => before.get(s)], ['reader', (s) => (s.judged === undefined ? -1 : s.judged)], ['site', (s) => s.score]]) {
                    const at = top(key);
                    [1, 3, 5].forEach((m, x) => { if (at >= 0 && at < m) tops[id][x]++; });
                }
            }
        }
        result.squad = { questions: n, ...Object.fromEntries(Object.entries(tops).map(([k, v]) => [k, v.map((x) => rate(x, n))])) };
    }

    result.askedWikipedia = asked;
    await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
    now.textContent = 'Done';
})().catch((error) => fetch('/result', { method: 'POST', body: JSON.stringify({ failed: String(error && error.stack || error) }) }));
