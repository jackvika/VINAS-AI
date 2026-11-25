// Reads a question the way an examiner means it, before anything is looked up: Hinglish and short forms are written out,
// spelling is mended, and a question that asks several things is taken apart, with "it" and "its" replaced by what they mean.
const Parse = (() => {
    // Short forms of the course. Only in capitals, so that "it" or "mis" in a sentence is left alone.
    const SHORT = {
        HRM: 'human resource management', HRD: 'human resource development', MIS: 'management information system', ERP: 'enterprise resource planning', CRM: 'customer relationship management', SCM: 'supply chain management',
        MBO: 'management by objectives', MBE: 'management by exception', PLC: 'product life cycle', BEP: 'break-even point', CVP: 'cost-volume-profit analysis', EOQ: 'economic order quantity', JIT: 'just-in-time', TQM: 'total quality management',
        CSR: 'corporate social responsibility', GDP: 'gross domestic product', GNP: 'gross national product', NNP: 'net national product', NPV: 'net present value', IRR: 'internal rate of return', WACC: 'weighted average cost of capital',
        PERT: 'program evaluation and review technique', CPM: 'critical path method', WBS: 'work breakdown structure', IMC: 'integrated marketing communications', FDI: 'foreign direct investment', WTO: 'World Trade Organization', GST: 'goods and services tax',
        SEBI: 'Securities and Exchange Board of India', RBI: 'Reserve Bank of India', IMF: 'International Monetary Fund', MSME: 'micro, small and medium enterprises', SSI: 'small-scale industry', KPI: 'key performance indicator', ROI: 'return on investment', USP: 'unique selling proposition',
        STP: 'segmentation, targeting and positioning', NPD: 'new product development', IPR: 'intellectual property rights', EXIM: 'export and import', BRS: 'bank reconciliation statement', GAAP: 'generally accepted accounting principles', IFRS: 'International Financial Reporting Standards',
        FIFO: 'first in, first out inventory method', LIFO: 'last in, first out inventory method', LPG: 'liberalisation, privatisation and globalisation', NGO: 'non-governmental organization', MNC: 'multinational corporation', BPO: 'business process outsourcing', ESG: 'environmental, social and governance', SBU: 'strategic business unit',
    };
    // Short forms that mean something else outside an Indian course, so they count only within a subject.
    const INDIA = {
        FEMA: 'Foreign Exchange Management Act', FERA: 'Foreign Exchange Regulation Act', MRTP: 'Monopolies and Restrictive Trade Practices Act', CCI: 'Competition Commission of India', NABARD: 'National Bank for Agriculture and Rural Development', SIDBI: 'Small Industries Development Bank of India',
        IDBI: 'IDBI Bank', EPCG: 'export promotion capital goods scheme', SEZ: 'special economic zone', NITI: 'NITI Aayog', CGST: 'goods and services tax in India', SGST: 'goods and services tax in India', IGST: 'goods and services tax in India', RTI: 'Right to Information Act', IRDA: 'Insurance Regulatory and Development Authority', TDS: 'tax deducted at source', PPP: 'public–private partnership',
    };
    // Words of Indian courses for what the books call by another name.
    const SAME = [
        [/\biso[- ]?product curves?\b|\bequal product curves?\b/gi, 'isoquant'], [/\bdepartmentation\b/gi, 'departmentalization'], [/\bspan (?:of )?(?:management|supervision)\b/gi, 'span of control'], [/\bintermediary management\b|\bmiddle level management\b/gi, 'middle management'],
        [/\bjoint stock compan(?:y|ies)\b/gi, 'corporation'], [/\bsole trad(?:er|ing concerns?|ers|ing)\b/gi, 'sole proprietorship'], [/\bcritical incidence\b/gi, 'critical incident'], [/\bneed hierarchy theory\b/gi, 'hierarchy of needs'],
        [/\btwo[- ]fact(?:or|ory) theory\b|\bmotivation[- ]hygiene theory\b/gi, 'two-factor theory'], [/\bbreak ?even\b/gi, 'break-even'], [/\btrading and profit (?:and|&) loss account\b|\bprofit (?:and|&) loss account\b/gi, 'income statement'], [/\bposition statement\b/gi, 'balance sheet'],
        [/\bdouble account system\b/gi, 'double-entry bookkeeping'], [/\bdouble entry system\b/gi, 'double-entry bookkeeping'], [/\bbooks? of original entry\b/gi, 'journal'], [/\barithmetic average\b/gi, 'arithmetic mean'], [/\bauthority level\b/gi, 'levels of authority'],
        [/\bnon[- ]verbal\b/gi, 'nonverbal'], [/\bco-ordination\b/gi, 'coordination'], [/\bindifference schedule\b/gi, 'indifference curve'], [/\bper capita income\b/gi, 'per capita income'], [/\bgrape ?vine\b/gi, 'grapevine communication'],
    ];
    // What can be asked of a topic: [how it is said, how the sources say it].
    const ASPECTS = [
        ['features', /^(?:(?:main|key|essential|basic|important|chief|salient|various|different|the)\s+)*(?:features?|characteristics?|qualit(?:y|ies)|attributes?|essentials?|traits?|nature|requisites?)$/i, 'characteristics'],
        ['types', /^(?:(?:main|key|basic|important|various|different|the)\s+)*(?:types?|kinds?|forms?|classifications?|categor(?:y|ies)|bases|styles?)$/i, 'types'],
        ['process', /^(?:(?:main|basic|various|different|the)\s+)*(?:process|steps?|stages?|procedure|phases|steps involved)$/i, 'steps'],
        ['importance', /^(?:(?:the|main)\s+)*(?:importance|significance|need|needs|necessity|utility|uses?|value|relevance)$/i, 'importance'],
        ['advantages', /^(?:(?:main|various|the)\s+)*(?:advantages?|merits?|benefits?|pros)$/i, 'advantages'],
        ['limitations', /^(?:(?:main|various|the)\s+)*(?:disadvantages?|demerits?|limitations?|drawbacks?|cons|weaknesses)$/i, 'disadvantages'],
        ['functions', /^(?:(?:main|major|key|various|different|the)\s+)*functions?$/i, 'functions'],
        ['objectives', /^(?:(?:main|major|key|various|different|the)\s+)*(?:objectives?|aims?|goals?|purposes?)$/i, 'objectives'],
        ['principles', /^(?:(?:main|major|key|basic|various|different|the)\s+)*principles?$/i, 'principles'],
        ['factors', /^(?:(?:main|major|key|various|different|the)\s+)*(?:factors?|determinants?|causes?|reasons?)$/i, 'factors'],
        ['elements', /^(?:(?:main|major|key|various|different|the)\s+)*(?:elements?|components?|parts?|constituents?|ingredients?)$/i, 'elements'],
        ['techniques', /^(?:(?:main|major|key|various|different|the)\s+)*(?:techniques?|methods?|tools?|approaches|measures|tools and techniques|methods and techniques)$/i, 'methods'],
        ['scope', /^(?:the\s+)*scope$/i, 'scope'],
        ['roles', /^(?:(?:main|major|key|various|different|the)\s+)*(?:roles?|responsibilit(?:y|ies)|duties)$/i, 'role'],
        ['meaning', /^(?:the\s+)*(?:meaning|concept|definition|term|terms?)$/i, 'meaning'],
    ];
    const ASPECT_WORD = '(?:features?|characteristics?|qualit(?:y|ies)|essentials?|nature|types?|kinds?|forms|classifications?|process|steps(?: involved)?|stages|procedure|importance|significance|need|necessity|uses|advantages|merits|benefits|disadvantages|demerits|limitations|drawbacks|functions|objectives|principles|factors|determinants|causes|elements|components|tools|techniques|methods|scope|roles?|responsibilities|duties|meaning|concept|definition)';
    const ROMAN = [
        [/^(.{2,80}?)\s+(?:aur|or|and|&)\s+(.{2,80}?)\s+(?:me|mein|main|mai|ke (?:beech|bich)(?: me| mein)?)\s+(?:kya\s+)?(?:antar|difference|farak|fark|bhed|differ\w*)\b.*$/i, 'Difference between $1 and $2'],
        [/^(.{2,80}?)\s+(?:ke|ki|ka|k)\s+(?:kitne\s+)?(?:types?|prakar|kinds?|bhed)\b(?!\s+of).*$/i, 'What are the types of $1'],
        [/^(.{2,80}?)\s+(?:ke|ki|ka|k)\s+(?:visheshta(?:ye|yen|e|en)?|features?|lakshan|characteristics?)\b(?!\s+of).*$/i, 'What are the features of $1'],
        [/^(.{2,80}?)\s+(?:ke|ki|ka|k)\s+(?:fay?de|faide|labh|advantages?|benefits?|merits?)\b(?!\s+of).*$/i, 'What are the advantages of $1'],
        [/^(.{2,80}?)\s+(?:ke|ki|ka|k)\s+(?:nuksan|nuqsan|haani|hani|disadvantages?|demerits?|limitations?)\b(?!\s+of).*$/i, 'What are the disadvantages of $1'],
        [/^(.{2,80}?)\s+(?:ka|ki|ke|k)\s+(?:mahatva|mahatwa|importance|zarurat|jarurat|need)\b(?!\s+of).*$/i, 'Explain the importance of $1'],
        [/^(.{2,80}?)\s+(?:ka|ki|ke|k)\s+(?:process|steps?|charan|prakriya|procedure)\b(?!\s+of).*$/i, 'What are the steps in $1'],
        [/^(.{2,80}?)\s+(?:ke|ki|ka|k)\s+(?:functions?|karya)\b(?!\s+of).*$/i, 'What are the functions of $1'],
        [/^(.{2,80}?)\s+(?:ke|ki|ka|k)\s+(?:principles?|siddhant|sidhant)\b(?!\s+of).*$/i, 'What are the principles of $1'],
        [/^(.{2,80}?)\s+(?:ke|ki|ka|k)\s+(?:objectives?|uddeshya|udeshya)\b(?!\s+of).*$/i, 'What are the objectives of $1'],
        [/^(.{2,80}?)\s+(?:ka|ki|ke|k)\s+(?:matlab|arth|meaning|paribhasha|definition)\b(?!\s+of).*$/i, 'What is $1'],
        [/^(.{2,80}?)\s+(?:ke bare (?:me|mein|main)|ko)\s+(?:.*\b)?(?:batao|bataiye|bata|samjhao|samjhaiye|samjha|likho|likhiye|explain)\b.*$/i, 'Explain $1'],
        [/^(?:kya (?:hai|hota hai|hoti hai)|kise kehte (?:hai|hain))\s+(.{2,80})$/i, 'What is $1'],
        [/^(.{2,80}?)\s+(?:kya|kise|kisko)\s+(?:hai|hain|he|hota|hoti|hote|kehte|kahte)\b.*$/i, 'What is $1'],
        [/^(.{2,80}?)\s+(?:kyun|kyu|kyon|kyo)\s+(?:zaruri|jaruri|zaroori|jaroori|important|mahatvapurn)\b.*$/i, 'Why is $1 important'],
        [/^(.{2,80}?)\s+(?:kaise)\s+(?:kaam|kam|work)\b.*$/i, 'How does $1 work'],
        [/^(.{2,80}?)\s+(?:samjhao|samjhaiye|samjhaao|batao|bataiye|explain karo|explain kijiye|explain kare|likho|likhiye|define karo|discuss karo)$/i, 'Explain $1'],
    ];
    const tidy = (t) => t.replace(/\s+/g, ' ').replace(/\s+([?.,;])/g, '$1').trim();
    const bare = (t) => tidy(t).replace(/^(?:the|an?|term|terms|concept of|word)\s+/i, '').replace(/^["“'‘]+|["”'’]+$/g, '').replace(/[?.!,;:]+$/, '').trim();

    /** Hinglish to English, for the patterns that students use. Anything else is left as it is. */
    function english(q) {
        const s = tidy(q).replace(/[?.!।]+$/, '');
        if (/\p{Script=Devanagari}/u.test(s)) return q;
        for (const [pattern, to] of ROMAN) if (pattern.test(s)) return s.replace(pattern, to);
        return q;
    }

    function spell(q, known) {
        if (!known) return { q, fixed: [] };
        const fixed = [];
        const out = q.replace(/\p{L}{5,}/gu, (w) => {
            // A name or a short form is not a mistake.
            if (/^\p{Lu}{2,}$/u.test(w)) return w;
            const better = known(w.toLowerCase());
            if (!better) return w;
            fixed.push([w, better]);
            return w[0] === w[0].toUpperCase() ? better[0].toUpperCase() + better.slice(1) : better;
        });
        return { q: out, fixed };
    }

    /** Makes a speller from words and how often each is used. */
    function speller(counts) {
        const byLength = new Map();
        for (const [w, n] of counts) {
            if (w.length < 5 || n < 8) continue;
            const key = `${w[0]}${w.length}`;
            if (!byLength.has(key)) byLength.set(key, []);
            byLength.get(key).push([w, n]);
        }
        const near = (a, b, most) => {
            // Optimal string alignment, stopped as soon as it is too far.
            let two = null;
            let row = [...Array(b.length + 1).keys()];
            for (let i = 1; i <= a.length; i++) {
                const next = [i];
                let least = i;
                for (let j = 1; j <= b.length; j++) {
                    let v = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                    if (two && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, two[j - 2] + 1);
                    next.push(v);
                    least = Math.min(least, v);
                }
                if (least > most) return most + 1;
                two = row;
                row = next;
            }
            return row[b.length];
        };
        return (w) => {
            if (counts.has(w) || counts.has(w.replace(/(?:e?s|ing|ed|ly)$/, '')) || counts.has(`${w}s`) || counts.has(w.replace(/is(e|ed|es|ing|ation|ations)$/, 'iz$1')) || counts.has(w.replace(/our/, 'or')) || counts.has(w.replace(/([a-z])\1(ing|ed)$/, '$1$2')) || counts.has(w.replace(/re$/, 'er'))) return '';
            const most = w.length >= 8 ? 2 : 1;
            let best = '';
            let points = -1;
            for (let n = w.length - most; n <= w.length + most; n++) {
                for (const [x, c] of byLength.get(`${w[0]}${n}`) || []) {
                    const d = near(w, x, most);
                    if (d > most) continue;
                    const v = Math.log(c) - 5 * d;
                    if (d === 1 || c >= 25) if (v > points || !best) { best = x; points = v; }
                }
            }
            return best;
        };
    }

    const aspectOf = (t) => ASPECTS.find(([, pattern]) => pattern.test(t.replace(/^its\s+|^their\s+/i, '').trim()));

    /** One thing asked of one topic, as a question that the rest of the site reads well. */
    function ask(aspect, topic, word = '') {
        const t = bare(topic);
        if (!aspect || aspect[0] === 'meaning') return `What is ${t}`;
        if (aspect[0] === 'importance') return `Explain the importance of ${t}`;
        if (aspect[0] === 'process') return `What are the steps in ${/process$/i.test(t) ? `the ${t}` : t}`;
        if (aspect[0] === 'scope') return `Explain the scope of ${t}`;
        if (aspect[0] === 'roles') return `Explain the role of ${t}`;
        const own = /^(?:causes|reasons|determinants|stages|styles|bases|responsibilities|duties|tools|techniques|approaches|goals|aims|components)$/i.exec(word.split(' ').pop() || '');
        return `What are the ${own ? own[0].toLowerCase() : aspect[2]} of ${t}`;
    }
    const heading = (aspect, topic) => {
        const t = bare(topic);
        const word = { features: 'Characteristics', types: 'Types', process: 'Process', importance: 'Importance', advantages: 'Advantages', limitations: 'Limitations', functions: 'Functions', objectives: 'Objectives', principles: 'Principles', factors: 'Factors', elements: 'Elements', techniques: 'Methods', scope: 'Scope', roles: 'Role' }[aspect && aspect[0]];
        return word ? (aspect[0] === 'process' ? `${word} of ${t.replace(/\s+process$/i, '')}` : `${word} of ${t}`) : `Meaning of ${t}`;
    };
    const VERB = '(?:explain|describe|discuss|define|state|examine|analy[sz]e|evaluate|outline|mention|list|enumerate|elaborate(?: on| upon)?|write(?: (?:an?|the))?(?: short| brief| detailed)?(?: notes?| essay| answer)?(?: on| about)?|give|comment(?: on)?|illustrate|highlight|identify|narrate|elucidate|throw light on|bring out|what (?:is|are)|what do you (?:mean|understand) by|what is meant by)';

    /** The clauses of a question, each with its verb. */
    function clauses(q) {
        const s = tidy(q).replace(/^(?:q(?:uestion)?\.?\s*)?\d{1,2}\s*[.)]\s*/i, '');
        const out = [];
        for (const sentence of s.split(/(?<=[?.!।])\s+(?=\S)|;\s*/)) {
            const t = sentence.trim();
            if (!t) continue;
            // "Define planning and explain the steps" are two things to do.
            const parts = t.split(new RegExp(`,?\\s+(?:and|also|then|&)\\s+(?:also\\s+)?(?=(?:briefly |critically |also )?${VERB}\\b)`, 'i'));
            out.push(...parts.map((x) => x.trim().replace(/[?.!।]+$/, '')).filter(Boolean));
        }
        return out;
    }

    function plan(question, known) {
        const first = english(question);
        let q = tidy(first);
        const notes = [];
        if (first !== question && tidy(question).replace(/[?.!।]+$/, '') !== tidy(first)) notes.push('Hinglish');
        const mended = spell(q, known);
        q = mended.q;
        const whole = { q, notes, fixed: mended.fixed, parts: [], statement: '' };
        if (/\p{Script=Devanagari}/u.test(q)) return whole;
        // "(5 marks)" and "in 200 words" belong to the whole, not to its last part.
        const size = [];
        const keep = (m) => { size.push(m); return ' '; };
        let s = q.replace(/[([]?\s*(?:for\s+)?\d{1,2}\s*marks?\s*[)\]]?/gi, keep).replace(/[([]?\s*(?:in|within|about|around)?\s*\d{2,4}(?:\s*(?:-|–|to)\s*\d{2,4})?\s*words?\s*[)\]]?/gi, keep);
        s = tidy(s);
        // A statement to explain: “Management is the art of getting things done.” Discuss.
        const said = /["“”«]([^"“”»]{15,220})["“”»]/.exec(s);
        const quoted = said || /^([A-Z][^?]{20,200}[.])\s*(?:Comment|Discuss|Explain|Elucidate|Do you agree|Justify|Examine|Critically)\b[^.]*\.?$/.exec(s);
        if (quoted && words(quoted[1]) > 4) {
            whole.statement = bare(quoted[1]);
            const rest = tidy(s.replace(quoted[0] === s ? quoted[1] : quoted[0], ' ')).replace(/^(?:[.,:–-]+\s*)+/, '');
            const subject = /^(?:the\s+)?(.{2,60}?)\s+(?:is|are|was|has|have|does|do|can|may|must|should|encourages?|involves?|means|begins?|implies|requires?|plays?|helps?|differs?)\b/i.exec(whole.statement);
            const topic = subject ? bare(subject[1]).replace(/^(?:all|every|no)\s+/i, '') : whole.statement;
            whole.topic = topic;
            const more = clauses(rest).map((c) => clause(c, topic)).flat().filter((x) => x.aspect && x.aspect[0] !== 'meaning');
            whole.parts = [{ q: `What is ${topic}`, head: `Meaning of ${topic}` }, { q: `Explain ${whole.statement}`, head: 'The statement explained', statement: whole.statement, topic }, ...more].slice(0, 4);
            return whole;
        }
        let topic = '';
        const parts = [];
        for (const c of clauses(s)) {
            const got = clause(c, topic);
            for (const x of got) if (x.topic) topic = topic || x.topic;
            parts.push(...got);
        }
        const asked = parts.filter((x, i) => x.q && parts.findIndex((y) => y.q.toLowerCase() === x.q.toLowerCase()) === i);
        // One thing: only written better. Several: one after the other.
        if (asked.length > 1) whole.parts = asked.slice(0, 4);
        else if (asked.length === 1 && asked[0].better) whole.q = tidy(`${asked[0].q} ${size.join(' ')}`);
        whole.topic = topic;
        return whole;
    }

    const words = (t) => t.split(/\s+/).filter(Boolean).length;

    /** What one clause asks: for each aspect a question of its own. */
    function clause(c, last) {
        let t = tidy(c).replace(/^(?:also|then|and|briefly|critically|in (?:detail|brief),?)\s+/i, '').replace(/\s+(?:in (?:detail|brief|short)|briefly|clearly|critically)$/i, '').replace(/^(explain|describe|discuss|define|state)\s+(?:clearly|briefly|in detail|the term|the terms)\s+/i, '$1 ');
        const its = /\b(?:its|their|the same|thereof)\b/i;
        // "How does it differ from planning?", "How planning differ from forecasting?"
        const differ = /^(?:how|in what way)\s+(?:(?:does|do|is|are|did|can)\s+)?(.{1,60}?)\s+(?:is\s+|are\s+)?(?:differs?|different|differentiated|distinguished)\s+(?:from|than|with)\s+(?:that of\s+)?(?:the\s+)?(.{2,80})$/i.exec(t)
            || /^(?:comparative (?:evaluation|study|analysis)|comparison|compare and contrast|differentiate|distinguish|differentiation|distinction|differences?|compare)\s+(?:of|between)?\s*(.{2,80}?)\s+(?:and|&|with|from|vs\.?)\s+(.{2,80})$/i.exec(t)
            || /^(?:what (?:is|are) the )?(?:main |basic |major )?(?:differences?|distinctions?)\s+between\s+(.{2,80}?)\s+(?:and|&)\s+(.{2,80})$/i.exec(t);
        if (differ) {
            const one = /^(?:it|they|this|these)$/i.test(bare(differ[1])) && last ? last : bare(differ[1]);
            const two = bare(differ[2]);
            // "formal and informal communication": both are kinds of communication.
            const last_ = two.split(' ').slice(1).join(' ');
            const whole = words(one) === 1 && words(two) === 2 && /(?:al|ic|ive|ed|ing|ary|ory|ous|able|ible|fixed|variable|direct|indirect|micro|macro|gross|net|internal|external|total|average)$/i.test(one) && !/(?:ing|ed)$/i.test(one) ? `${one} ${last_}` : one;
            return [{ q: `Difference between ${whole} and ${two}`, head: `Difference between ${whole} and ${two}`, topic: whole, compare: true, better: true }];
        }
        // "Define management", "What do you mean by directing?", "What is departmentation?"
        const what = /^(?:define|what do you (?:mean|understand) by|what is meant by|what (?:is|are)(?! the\b)|meaning of|explain the (?:meaning|concept|term) of|give the meaning of|definition of)\s+(?:the (?:term|terms|concept of|word)\s+)?(.{2,90})$/i.exec(t);
        if (what && !new RegExp(`^${ASPECT_WORD}\\s+of\\b`, 'i').test(what[1])) {
            const name = bare(what[1]);
            const both = /^(?:meaning|concept|definition)\s+(?:and|&)\s+(.+?)\s+of\s+(.+)$/i.exec(name);
            if (!both) {
                // "What is X and its uses", "Define index number and mention its uses"
                const tail = /^(.{2,60}?)\s+(?:and|along with|with)\s+(?:its|their)\s+(.{3,60})$/i.exec(name);
                if (tail) return [{ q: ask(null, tail[1]), head: heading(null, tail[1]), topic: bare(tail[1]), better: true }, ...several(tail[2], tail[1])];
                if (/^(?:it|they|this)$/i.test(name) && last) return [];
                return [{ q: ask(null, name), head: heading(null, name), topic: name, better: /^what do you|^what is meant|^define/i.test(t) }];
            }
            return [{ q: ask(null, both[2]), head: heading(null, both[2]), topic: bare(both[2]), better: true }, ...several(both[1], both[2])];
        }
        const rest = bare(t.replace(new RegExp(`^(?:please\\s+)?(?:${VERB})\\s+`, 'i'), '').replace(/^(?:me |about |on )/i, '').replace(/^(?:the|an?)\s+/i, ''));
        // "its importance and limitations", "some other characteristics of it"
        if (last && (its.test(rest) || aspectOf(rest) || /\bof it$/i.test(rest) || /^(?:various|different|main|some other|other)\s+\w+$/i.test(rest))) {
            const list = several(rest.replace(/\b(?:its|their)\s+/gi, '').replace(/\s+of (?:it|the same)$/i, '').replace(/^some other\s+|^other\s+/i, ''), last);
            if (list.length) return list;
        }
        // "process and importance of MBO", "features of good organizational structure", "steps involved in planning process"
        const of = new RegExp(`^((?:(?:various|different|main|major|important|essential|basic|key|good|briefly|the)\\s+)*${ASPECT_WORD}(?:(?:\\s*,\\s*|\\s+and\\s+|\\s*/\\s*|\\s*&\\s*|\\s*,\\s*and\\s+)(?:the\\s+|various\\s+|different\\s+|main\\s+)?${ASPECT_WORD})*)\\s+(?:of|in|for|involved in|affecting|affect|determining|to|behind)\\s+(.{2,90})$`, 'i').exec(rest);
        if (of) {
            const list = several(of[1], of[2]);
            if (list.length) return list;
        }
        // "different planning techniques", "various types of decisions"
        const tail = new RegExp(`^(?:the\\s+)?(?:various|different|main|important|major)\\s+(.{2,50}?)\\s+(techniques|methods|tools|principles|functions|objectives|types|forms|stages|steps|factors)$`, 'i').exec(rest);
        if (tail) return several(tail[2], tail[1]);
        // Only a name: "Unity of Command."
        if (!/^(?:what|why|how|when|where|who|which|whose|is|are|does|do|can|should)\b/i.test(t)) return rest && words(rest) <= 14 ? [{ q: `Explain ${rest}`, head: rest[0].toUpperCase() + rest.slice(1), topic: rest, better: t === rest || /^(?:give|write|bring|throw|narrate|elucidate|highlight)/i.test(t) }] : [{ q: t, head: rest, topic: last }];
        let full = t;
        // "Why direction is said to be ..." with a topic named before.
        if (last) full = full.replace(/\b(?:it|they)\b/i, last).replace(/\b(?:its|their)\b/i, `${last}'s`);
        return [{ q: full, head: full[0].toUpperCase() + full.slice(1), topic: last || '' }];
    }

    /** "process and importance", asked of a topic. */
    function several(list, topic) {
        const name = bare(topic);
        const out = [];
        for (const word of list.split(/\s*,\s*(?:and\s+)?|\s+and\s+|\s*&\s*|\s*\/\s*/)) {
            const aspect = aspectOf(bare(word));
            if (aspect) out.push({ q: ask(aspect, name, bare(word)), head: heading(aspect, name), topic: name, aspect, better: true });
        }
        return out;
    }

    /** Short forms written out: "MBO" becomes "management by objectives (MBO)". */
    function long(q, course = false) {
        let out = q.replace(/\b([A-Za-z]) [-–] ?(?=[a-z])/g, '$1-').replace(/\b[A-Z]{3,6}\b/g, (w) => (course && INDIA[w]) || SHORT[w] || w);
        for (const [pattern, to] of SAME) out = out.replace(pattern, to);
        return out;
    }

    /** A sum to work out from figures, which this site does not do. */
    function sum(q) {
        return /^(?:from the following|calculate|compute|find(?: out)?|prepare|solve|draw|determine|journali[sz]e|pass|ascertain|you are required|the following (?:data|information|particulars|figures))\b/i.test(q.trim()) && (q.match(/\d[\d,.]*/g) || []).length >= 5;
    }

    return { INDIA, SHORT, sum, clauses, english, long, plan, speller, spell };
})();
