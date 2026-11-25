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
        ['features', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:features?|characteristics?|qualit(?:y|ies)|attributes?|essentials?|traits?|nature|requisites?)$/i, 'characteristics'],
        ['types', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:types?|kinds?|forms?|classifications?|categor(?:y|ies)|bases|styles?)$/i, 'types'],
        ['process', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:process|steps?|stages?|procedure|phases|steps involved)$/i, 'steps'],
        ['importance', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:importance|significance|need|needs|necessity|utility|uses?|value|relevance)$/i, 'importance'],
        ['advantages', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:advantages?|merits?|benefits?|pros)$/i, 'advantages'],
        ['limitations', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:disadvantages?|demerits?|limitations?|drawbacks?|cons|weaknesses)$/i, 'disadvantages'],
        ['functions', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*functions?$/i, 'functions'],
        ['objectives', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:objectives?|aims?|goals?|purposes?)$/i, 'objectives'],
        ['principles', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*principles?$/i, 'principles'],
        ['factors', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:factors?|determinants?|causes?|reasons?)$/i, 'factors'],
        ['elements', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:elements?|components?|parts?|constituents?|ingredients?)$/i, 'elements'],
        ['techniques', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:techniques?|methods?|tools?|approaches|measures|tools and techniques|methods and techniques)$/i, 'methods'],
        ['scope', /^(?:(?:main|the)\s+)*scope$/i, 'scope'],
        ['roles', /^(?:(?:main|major|key|chief|basic|essential|important|salient|distinct|distinctive|various|different|several|many|some|four|five|six|seven|the|good)\s+)*(?:roles?|responsibilit(?:y|ies)|duties)$/i, 'role'],
        ['meaning', /^(?:(?:main|the)\s+)*(?:meaning|concept|definition|term|terms?)$/i, 'meaning'],
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
        const mend = (w) => {
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
        mend.has = (w) => counts.has(w);
        return mend;
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

    /** "its advantages?", "iske types batao": about what was asked before. */
    function follow(q, before) {
        if (!before) return q;
        const s = tidy(q).replace(/^(?:and|ok(?:ay)?|now|then|also|aur|ab|achha|accha)[, ]+/i, '');
        const roman = /^(?:iske|uske|iski|uski|iska|uska|inke|unke|isko|usko)\s+(.{2,80})$/i.exec(s);
        if (roman) return `${before} ${/^(?:isko|usko)/i.test(s) ? 'ko' : 'ke'} ${roman[1]}`;
        const its = new RegExp(`^((?:(?:what (?:is|are)|explain|describe|discuss|give|state|list|mention|write|tell me)\\s+)?)(?:its|their)\\s+(${ASPECT_WORD}(?:\\s+and\\s+(?:its\\s+)?${ASPECT_WORD})*)\\s*\\??$`, 'i').exec(s);
        if (its) return `${its[1].trim() || 'Explain'} ${/^what/i.test(its[1]) ? 'the ' : 'the '}${its[2].replace(/\bits\s+/gi, '')} of ${before}`;
        const only = new RegExp(`^(?:the\\s+)?(${ASPECT_WORD})\\s*\\??$`, 'i').exec(s);
        if (only) return `Explain the ${only[1]} of ${before}`;
        if (/^(?:why|how|when|where|what|who|is|does|can)\b.{0,40}\b(?:it|they|this|that)\b/i.test(s) && words(s) < 9) return s.replace(/\b(?:it|they|this|that)\b/i, before);
        if (/^(?:explain|describe|define|tell me(?: more)?(?: about)?|more (?:about|on))\s+(?:it|this|that|them)\b/i.test(s)) return `Explain ${before}`;
        return q;
    }

    function plan(question, known, before = '') {
        const meant = follow(question, before);
        const first = english(meant);
        let q = tidy(first);
        const notes = [];
        if (first !== question && tidy(question).replace(/[?.!।]+$/, '') !== tidy(first)) notes.push('Read as');
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

    // ---- One structured query ----
    // Everything below turns a question into one object: its parts, each a topic with a facet and a weight, the command, the marks and the words.

    const MARKS = [[2, 50], [3, 80], [5, 180], [6, 220], [7.5, 280], [10, 400], [12, 480], [15, 600], [16, 640], [20, 800]];
    /** How many words an answer for so many marks has. */
    function wordsFor(marks) {
        if (!marks) return 400;
        const k = MARKS.findIndex(([m]) => m >= marks);
        if (k < 0) return 800;
        if (k === 0) return 50;
        const [[a, x], [b, y]] = [MARKS[k - 1], MARKS[k]];
        return Math.round(x + (y - x) * (marks - a) / (b - a));
    }

    const ADJ = '(?:(?:any|the|its|their|all|main|major|key|chief|basic|important|salient|distinct|distinctive|distinguishing|various|different|several|many|some|other|essential|fundamental|principal|general|common|primary|specific|modern|internal|external|two|three|four|five|six|seven|eight|ten|\\d{1,2}|good)\\s+)*';
    const FACET = [
        ['definition', 'meanings?|definitions?|concepts?'], ['features', 'features?|characteristics?|nature|qualit(?:y|ies)|attributes?|essentials?|traits?|requisites?|essential (?:features|elements|characteristics)'], ['scope', 'scope'],
        ['importance', 'importance|significance|needs?|necessity|utility|uses|value|relevance|rationale'], ['objectives', 'objectives?|aims?|purposes?|goals?'],
        ['types', 'types?|kinds?|classifications?|forms?|categor(?:y|ies)|styles?|bases|basis|methods|techniques?|tools?(?: and techniques)?|sources?|elements?|components?|parts|constituents?|ingredients?|instruments?|approaches|measures|dimensions'],
        ['process', 'process|steps?(?: involved)?|stages?|procedure|phases?'], ['principles', 'principles?'], ['functions', 'functions?|roles?|responsibilities|duties|tasks?'],
        ['advantages', 'advantages?|merits?|benefits?|pros|strengths?'], ['limitations', 'disadvantages?|demerits?|limitations?|drawbacks?|cons|weaknesses|shortcomings?|criticisms?|problems?|barriers?|obstacles?|exceptions?'], ['factors', 'factors?|determinants?|causes?|reasons?'], ['effects', 'effects?|impacts?|consequences?|implications?'],
    ].map(([name, w]) => [name, w, new RegExp(`^${ADJ}(?:${w})$`, 'i')]);
    const FWORD = `(?:${FACET.map((f) => f[1]).join('|')})`;
    const FLIST = `${ADJ}${FWORD}(?:(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+(?:also\\s+)?|\\s*&\\s*|\\s*/\\s*|\\s+as well as\\s+)${ADJ}${FWORD})*`;
    const facetOf = (t) => (FACET.find((f) => f[2].test(t.trim())) || [''])[0];
    /** The word for a facet, as it was asked: "bases", "methods". */
    const wordOf = (t) => t.trim().replace(new RegExp(`^${ADJ}`, 'i'), '').toLowerCase();
    const pieces2 = (t) => t.split(/\s*,\s*(?:and\s+)?|\s+and\s+(?:also\s+)?|\s*&\s*|\s*\/\s*|\s+as well as\s+/i);
    const facetsOf = (t) => t.split(/\s*,\s*(?:and\s+)?|\s+and\s+(?:also\s+)?|\s*&\s*|\s*\/\s*|\s+as well as\s+/i).map(facetOf);
    const OF = new RegExp(`^(${FLIST})\\s+(?:of|in|for|to study|to|affecting|influencing|determining|that (?:affect|influence|determine)|which (?:affect|influence|determine)|involved in|behind|responsible for|used in|used for|underlying)\\s+(.{2,140})$`, 'i');
    const DO = '(?:explain|describe|discuss|define|state|examine|analy[sz]e|evaluate|outline|mention|list(?: out)?|enumerate|elaborate(?: on| upon)?|write|give|comment(?: on| upon)?|illustrate|highlight|identify|name|point out|narrate|elucidate|throw light on|bring out|differentiate|distinguish|compare|trace|classify|justify|summari[sz]e|suggest|show|draw)';
    const WH = /^(?:what|why|how|when|where|who|which|whose|whom|is|are|does|do|can|should|did|was|were)\b/i;
    const ABOUT = '(?:explain|describe|discuss|define|state|examine|analy[sz]e|evaluate|outline|mention|list(?: out)?|enumerate|elaborate(?: on| upon)?|give(?: (?:an? )?(?:account|idea|outline|overview) of)?|illustrate|highlight|identify|name|point out|narrate|elucidate|throw light on|bring out|trace|classify|summari[sz]e|what (?:is|are|were|was)|comment (?:on|upon)|write(?: (?:an? |the )?(?:(?:short|brief|detailed|critical|explanatory)\\s+)*(?:notes?|essays?|answers?|account|paragraph)(?:s)?(?: on| about| of)?)?)';
    const FILL = /\s*,?\s+(?:with (?:special )?reference to|in (?:the )?(?:context|case|light) of|in (?:the )?(?:indian? (?:context|economy|business|scenario)|india)\b|in (?:an? |the |any |our )?(?:(?:large|modern|big|small|business|today's|present|present-day|current|given|your)\s+)*(?:organi[sz]ations?|enterprises?|firms?|compan(?:y|ies)|business(?: world)?|industry|industries|scenario|times?|world|era|society)\b|for (?:an? |the |any )?(?:(?:large|modern|big|small|business|the success of)\s+)*(?:organi[sz]ations?|enterprises?|firms?|compan(?:y|ies)|business|managers?|survival|success)\b|to (?:an? |the )?(?:organi[sz]ations?|compan(?:y|ies)|business|firms?|managers?)\b|given by|as given by|propounded by|suggested by|in your own words|with the help of|along with).*$/i;
    const CONTEXT = /\s+(?:as (?:an? )?(?:function|element|part|step|tool|aspect|branch|field|managerial function) of|in|under|within|for)\s+(.{3,60})$/i;

    // What is known of topics: filled by teach().
    const bank = { names: new Map(), info: new Map(), natural: {}, senses: {}, hindi: new Map(), words: new Map(), statements: [], titles: new Map(), courses: [], df: new Map(), heads: new Set(), longest: 1 };
    const WHO = [
        [/\bfayol|फेयोल|फेयॉल|फ़ेयोल/i, /\bprincipl|\bsid+hant|सिद्धां?न?्?त/i, "Fayol's 14 principles of management"], [/\bfayol|फेयोल/i, /\bfunctions?\b|\belements\b|\bkarya\b|कार्य/i, "Fayol's functions of management"],
        [/\btaylor/i, /\bprincipl|\bsid+hant/i, "Taylor's principles of scientific management"], [/\btaylor/i, /\bscientific management/i, "Taylor's scientific management"],
        [/\bmaslow|मास्लो/i, /./, "Maslow's hierarchy of needs"], [/\bherzberg/i, /./, "Herzberg's two factor theory"], [/\bmcgregor|theory x\b/i, /./, 'Theory X and Theory Y'], [/\bmintzberg/i, /\brole/i, 'managerial roles'], [/\bporter/i, /\bfive forces/i, "Porter's five forces model"],
    ];
    const one = (w) => (w.length > 3 ? w.replace(/ies$/, 'y').replace(/(ss|sh|ch|x)es$/, '$1').replace(/([^su])s$/, '$1') : w);
    /** A name for comparing: no case, no articles, no plural, one spelling. */
    const norm = (t) => String(t).toLowerCase().replace(/[’`]/g, "'").replace(/'s\b/g, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().split(' ').filter((w) => !/^(?:the|an?)$/.test(w))
        .map((w) => one(w.replace(/isation/, 'ization').replace(/ising$/, 'izing').replace(/ise(d|r|s)?$/, (m, e) => (/^(?:exercise|enterprise|rise|wise|promise|premise|franchise|merchandise|otherwise|supervise|advertise)/.test(w) ? m : `ize${e || ''}`)).replace(/our(s|al|ed|ing)?$/, (m, e) => (/^(?:behaviour|labour|favour|colour|honour|neighbour)/.test(w) ? `or${e || ''}` : m)).replace(/centre/, 'center').replace(/programme/, 'program').replace(/labell/, 'label'))).join(' ');

    /** Takes in the topic list, the statements and the course. */
    function teach({ glossary = null, statements = null, bba = null, headings = null } = {}) {
        const word = (t, n = 1) => { for (const w of norm(t).split(' ')) if (w.length > 3 && /^[a-z]+$/.test(w)) bank.words.set(w, (bank.words.get(w) || 0) + n); };
        if (bba) {
            bank.courses = bba.courses.map((c) => ({ code: c.code, title: c.title, group: c.group, books: c.books }));
            for (const c of bba.courses) {
                bank.titles.set(c.code, c.title);
                if (!c.books.length) continue;
                for (const t of [c.title, ...c.units.flatMap((u) => [u.title, ...u.topics])]) {
                    const set = new Set(norm(t).split(' ').filter((w) => w.length > 2 && !/^(?:and|for|with|its|the|meaning|concept|definition|nature|scope|importance|type|introduction|feature|function|process|method|principle)$/.test(w)));
                    if (!set.size) continue;
                    bank.heads.add(set);
                    set.course = c;
                    for (const w of set) bank.df.set(w, (bank.df.get(w) || 0) + 1);
                    word(t);
                }
            }
        }
        if (glossary) {
            for (const [code, list] of Object.entries(glossary.subjects)) {
                for (const line of list) {
                    const [name, ...also] = line.split('|').map((x) => x.trim());
                    bank.info.set(name, { name, codes: (glossary.also || {})[name] || [code] });
                    for (const x of [name, ...also]) {
                        const k = norm(x);
                        if (!bank.names.has(k)) bank.names.set(k, name);
                        bank.longest = Math.max(bank.longest, k.split(' ').length);
                        word(x, 5);
                    }
                }
            }
            bank.natural = glossary.natural || {};
            bank.senses = glossary.senses || {};
            for (const [name, list] of Object.entries(glossary.hindi || {})) for (const x of list.split('|')) bank.hindi.set(x.trim().toLowerCase(), name);
        }
        for (const t of headings || []) {
            const k = norm(t);
            if (k.split(' ').length < 5 && !bank.names.has(k)) bank.names.set(k, '');
        }
        if (statements) bank.statements = statements.statements.map((s) => ({ ...s, say: s.say.map((x) => new RegExp(x, 'i')) }));
        for (const t of ['explain describe discuss define state examine evaluate enumerate differentiate distinguish between compare importance significance features characteristics advantages disadvantages limitations objectives functions principles process types factors meaning definition concept nature scope advantage merits demerits benefits classification critically determinants techniques methods procedure stages steps']) word(t, 5);
    }

    const known = (t) => bank.names.get(norm(t)) || '';
    /** The longest known topic inside a text. */
    function inside(text) {
        const t = norm(text).split(' ');
        for (let n = Math.min(bank.longest, t.length); n > 0; n--) for (let i = 0; i + n <= t.length; i++) {
            const name = bank.names.get(t.slice(i, i + n).join(' '));
            if (name) return name;
        }
        return '';
    }

    const distance = (a, b, most) => {
        let two = null;
        let row = [...Array(b.length + 1).keys()];
        for (let i = 1; i <= a.length; i++) {
            const next = [i];
            for (let j = 1; j <= b.length; j++) {
                let v = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (two && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, two[j - 2] + 1);
                next.push(v);
            }
            if (Math.min(...next) > most) return most + 1;
            two = row;
            row = next;
        }
        return row[b.length];
    };
    /** Mends spelling, only towards a word of a known topic, and only of a word that is no word. */
    function mendTopics(q, speller_) {
        const fixed = [];
        const out = q.replace(/(?<![\p{L}\p{M}'’])[a-z][a-z]{4,}(?![\p{L}\p{M}])/giu, (w) => {
            if (/^[A-Z]{2,}/.test(w) || !bank.words.size) return w;
            const low = one(norm(w));
            if (!low || bank.words.has(low) || bank.names.has(low) || (speller_ && speller_.has && (speller_.has(w.toLowerCase()) || speller_.has(low)))) return w;
            const most = speller_ && speller_.has ? (w.length >= 8 ? 2 : 1) : w.length >= 7 ? 1 : 0;
            let best = '';
            let points = -Infinity;
            for (const [x, n] of bank.words) {
                if (x[0] !== low[0] || Math.abs(x.length - low.length) > most || x.length < 5) continue;
                const d = distance(low, x, most);
                if (d > most) continue;
                const v = Math.log(n + 1) - 6 * d;
                if (v > points) [best, points] = [x, v];
            }
            if (!best) return w;
            fixed.push([w, best]);
            return w[0] === w[0].toUpperCase() ? best[0].toUpperCase() + best.slice(1) : best;
        });
        return { q: out, fixed };
    }

    /** Marks, words, and what else frames a question, taken off it. */
    function unframe(q) {
        let marks = null;
        let words_ = 0;
        const note = (n) => { if (marks === null && Number(n) > 0 && Number(n) <= 100) marks = Number(n); return ' '; };
        let s = ` ${q.replace(/\s+/g, ' ')} `
            .replace(/[([]\s*\d{1,2}\s*[x×*]\s*\d{1,2}\s*=\s*(\d{1,2})\s*(?:marks?|m)?\s*[)\]]/gi, (m, n) => note(n))
            .replace(/[([]\s*\d{1,2}(?:\s*\+\s*\d{1,2})+\s*=\s*(\d{1,2})\s*(?:marks?|m)?\s*[)\]]/gi, (m, n) => note(n))
            .replace(/[([]\s*(?:max(?:imum)?\.?\s*)?marks?\s*[:=-]?\s*(\d{1,2}(?:\.\d+)?)\s*[)\]]/gi, (m, n) => note(n))
            .replace(/[([]\s*(\d{1,2}(?:\.\d+)?)\s*(?:marks?|m|अंक|ank)\s*(?:each)?\s*[)\]]/gi, (m, n) => note(n))
            .replace(/(?:\b(?:for|of|carrying|carries)\s+)?(?<![\d.])(\d{1,2}(?:\.\d+)?)\s*-?\s*(?:marks?\b|अंकों?|ank\b)(?:\s+each)?/gi, (m, n) => note(n))
            .replace(/(?<=[\s.?])(\d{1,2}(?:\.\d+)?)M\b/g, (m, n) => note(n))
            .replace(/(?<=[\s.?])(\d{1,2}(?:\.\d+)?)\s?m\s*$/i, (m, n) => note(n))
            .replace(/\bb\/w\b/gi, 'between')
            .replace(/[([]?\s*(?:answer\s+)?(?:in|within|about|around|of)?\s*(?:about\s+|not more than\s+)?(\d{2,4})(?:\s*(?:-|–|to)\s*(\d{2,4}))?\s*words?\s*[)\]]?/gi, (m, n, k) => { words_ = Number(k || n); return ' '; })
            .replace(/[([]\s*(?:(?:CO|BL|K|L|PO|BTL|LO|U|R|AN|AP)\s?-?\d(?:\s*[,/&]\s*(?:CO|BL|K|L|PO|BTL|LO)?\s?-?\d)*(?:\s*,\s*)?)+\s*[)\]]/gi, ' ')
            .replace(/(?<=[\s.?])[([]\s*(\d{1,2}(?:\.\d+)?)\s*[)\]](?=\s*(?:$|OR\b|\(?or\)?\b|[([]))/gi, (m, n) => note(n))
            .replace(/(?<=[.?]\s*)(?<![\w.])(\d{1,2})\s*$/, (m, n) => note(n));
        s = s.replace(/\b([47])\s?P['’]?s?\b(?!\.)/g, '$1Ps').replace(/\b(four|seven) p['’]s\b/gi, '$1 Ps');
        s = s.replace(/^(?:\s*(?:(?:unit|section|part|module|group|block)\s*[-–:]?\s*(?:[ivx]{1,4}|[a-f]|\d{1,2})\b\s*[,.:;–-]*|(?:q(?:uestion|ue|ues)?|ques)\s*\.?\s*(?:no\.?)?\s*[-:]?\s*\d{1,2}\s*[.):,-]*|(?:प्रश्न|प्र\.?)\s*(?:संख्या)?\s*[\d०-९]{1,2}\s*[.):]*|\d{1,2}\s*[.):]|\(\s*\d{1,2}\s*\)|\(?\s*(?:[a-h]|[ivx]{1,4})\s*\)|[a-h]\s*\.\s))+/i, ' ');
        s = s.replace(/^\s*(?:(?:attempt|answer|do|solve) (?:any )?(?:one|two|three|four|five|six|all)\b[^:.]{0,40}[:.]|(?:long|short|very short) answer (?:type )?questions?\s*[:.]?)\s*/i, ' ');
        s = s.replace(/(?<=[\s.?:])\((?:[a-h]|[ivx]{1,4})\)\s+/gi, ' ; ');
        return { s: tidy(s.replace(/^[\s;:,.–-]+/, '')), marks, words: words_ };
    }

    /** A topic by its known name, or as it was written. */
    function topicOf(raw, state) {
        let t = tidy(String(raw).replace(/[()[\]]/g, ' ')).replace(/^(?:about|on|regarding|upon|that|of)\s+/i, '').replace(/^(?:the|an?|its)\s+/i, '');
        t = bare(t).replace(/^(?:(?:the|an?|term|tern|terms|concept of|concepts of|idea of|meaning of|method of|topic|word|phrase|process called|theory called|india's|following(?: terms?| concepts?)?:?)\s+)+/i, '').replace(/["“”]|(?<![\p{L}])['‘`’]|['’](?![\p{L}])/gu, (m, at, all) => (/s$/.test(all.slice(0, at)) && /['’]/.test(m) && /s['’]\s/.test(all.slice(Math.max(0, at - 1), at + 2)) ? m : '')).trim();
        for (const [who, what, name] of WHO) if (who.test(t) && what.test(t)) return { topic: name, known: true };
        let hit = known(t);
        let context = '';
        let field = '';
        if (!hit) {
            const was = t;
            t = t.replace(FILL, '').trim() || was;
            if (t !== was) context = was.slice(t.length);
            hit = known(t);
        }
        if (!hit) {
            const m = CONTEXT.exec(t);
            if (m && m.index > 1 && known(t.slice(0, m.index))) {
                field = m[1];
                context = `${m[0]} ${context}`;
                t = t.slice(0, m.index).trim();
                hit = known(t);
            }
        }
        if (!hit) {
            const cut = /^(.{3,60}?)\s+(?:process|concept|procedure|system|approach|technique|structure)$/i.exec(t);
            if (cut && known(cut[1])) hit = known(cut[1]);
            const plainer = /^(?:good|successful|effective|ideal|sound|efficient|modern|an? effective)\s+(.{3,60})$/i.exec(t);
            if (!hit && plainer && known(plainer[1])) hit = known(plainer[1]);
        }
        if (!hit) {
            const cut = /^(?:measuring|calculating|computing|estimating|determining)\s+(.{2,60})$/i.exec(t);
            if (cut) return topicOf(cut[1], state);
        }
        if (!hit) {
            const part = /^(?:it|this|that|them|they|these|the same|same|him)$/i.test(t);
            if (part && state.last) return { topic: state.last, known: state.lastKnown, again: true };
        }
        if (!hit) {
            const name = words(t) > 1 || !/^[A-Z][a-z]/.test(t) ? t : t.toLowerCase();
            return { topic: name[0] === name[0].toUpperCase() && !/^[A-Z][A-Z]/.test(name) && !/\b[A-Z][a-z]+.*\b[A-Z]/.test(name.slice(1)) ? name[0].toLowerCase() + name.slice(1) : name, known: bank.names.has(norm(t)) || false, within: inside(t), context };
        }
        const senses = bank.senses[hit];
        if (senses) {
            const chosen = state.subject && senses.find((x) => x.subject === state.subject);
            const near = senses.find((x) => x.near && new RegExp(`\\b(?:${x.near})`, 'i').test(context));
            const pick = chosen || near || senses[0];
            for (const x of senses) if (x !== pick && (x.subject === state.subject || (x.near && new RegExp(`\\b(?:${x.near})`, 'i').test(`${context} ${chosen ? '' : state.others || ''}`)))) state.senses.push({ from: pick.topic, topic: x.topic, subject: x.subject });
            return { topic: pick.topic, known: true, sense: pick.subject, context, field };
        }
        return { topic: hit, known: true, context, field };
    }

    const DEFAULT = ['definition', 'features', 'importance'];
    /** A topic named without a facet. */
    function whole(t) {
        const natural = bank.natural[t.topic];
        return (natural ? [natural] : DEFAULT).map((facet) => ({ ...t, facet, whole: !natural }));
    }

    /** "recruitment and selection", as two topics when both are known and the two are not one. */
    function topicsOf(raw, state) {
        const t = topicOf(raw, state);
        if (t.known || !/\band\b|,|&/i.test(raw)) return [t];
        // "internal and external environment of business": both are kinds of environment.
        const shared = /^(?:the\s+)?(\p{L}[\p{L}-]+)\s+(?:and|&)\s+(\p{L}[\p{L}-]+)\s+(.{3,60})$/iu.exec(bare(raw).replace(FILL, ''));
        if (shared) {
            const both = [`${shared[1]} ${shared[3]}`, `${shared[2]} ${shared[3]}`].map((x) => known(x) || known(x.replace(/\s+of (?:an? |the )?business$/i, '')));
            if (both.every(Boolean)) return both.map((topic) => ({ topic, known: true }));
        }
        const list = raw.split(/\s*,\s*(?:and\s+)?|\s+and\s+|\s*&\s*/i).map((x) => x.trim()).filter(Boolean);
        if (list.length < 2) return [t];
        const each = list.map((x) => topicOf(x, { ...state, senses: [] }));
        if (each.every((x) => x.known && !x.again)) return each;
        return [t];
    }

    const COMPARE = [
        /^(?:how|in what ways?)\s+(?:(?:does|do|is|are|did|can)\s+)?(.{1,60}?)\s+(?:is\s+|are\s+)?(?:differs?|different|differentiated|distinguished)\s+(?:from|than|with)\s+(?:that of\s+)?(?:the\s+)?(.{2,80})$/i,
        /^(?:critically\s+)?(?:comparative (?:evaluation|study|analysis)|comparison|compare and contrast|differentiate|distinguish|differentiation|distinction|(?:the )?differences?|compare|contrast)\s+(?:of|between)?\s*(.{2,90}?)\s+(?:and|&|with|from|vs\.?|versus)\s+(?:that of\s+)?(.{2,90})$/i,
        new RegExp(`^(?:(?:${DO}|what (?:is|are)|write)\\s+)?(?:the\\s+)?(?:main |basic |major |various |key |four |five )*(?:points? of )?(?:differences?|distinctions?|comparison)\\s+between\\s+(.{2,90}?)\\s+(?:and|&)\\s+(.{2,90})$`, 'i'),
        /^(?:explain |discuss |describe )?(.{2,60}?)\s+(?:vs\.?|versus|v\/s)\s+(.{2,60})$/i,
    ];
    /** Two things set against each other, as one topic. */
    function compared(t, state) {
        for (const pattern of COMPARE) {
            const m = pattern.exec(t);
            if (!m) continue;
            const a = topicOf(m[1], state);
            let right = m[2].replace(/\s+(?:with (?:suitable |the help of )?examples?|giving examples?|on the basis of.*)$/i, '');
            const b = topicOf(right, state);
            let left = a.topic;
            let l = a;
            right = bare(right);
            // "formal and informal communication": both are kinds of communication.
            const [x, y] = [bare(m[1]).split(' '), right.split(' ')];
            if (x.length === 1 && y.length > 1 && !a.again) {
                const full = `${x[0]} ${y.slice(1).join(' ')}`;
                if (known(full) || (!a.known && !known(x[0]) && /(?:al|ic|ive|ed|ary|ory|ous|able|ible|fixed|direct|micro|macro|gross|net|upward|oral|written|primary|secondary)$/i.test(x[0]))) {
                    l = topicOf(full, state);
                    left = l.topic;
                }
            }
            return [{ topic: `${left} and ${b.topic}`, facet: 'comparison', known: l.known || b.known, within: l.within, sides: [left, b.topic], first: l.known ? left : b.known ? b.topic : left }];
        }
        return null;
    }

    /** What one clause asks: a list of topics with facets, and how it is put. */
    function read1(c, state) {
        let t = tidy(c).replace(/^(?:(?:and|also|then|further|besides|moreover|please|kindly|lastly|finally|secondly|hence|so|now)\b,?\s*)+/i, '');
        const out = { parts: [], verb: '', how: '' };
        const weight = /\b(?:briefly|in brief|in short|in a few (?:lines|words))\b/i.test(t) ? 0.5 : /\b(?:in (?:great |full )?detail|detailed|at length|elaborately)\b/i.test(t) ? 1.5 : 1;
        if (/\bcritical(?:ly)?\b|\bevaluate\b|^examine critically|\bcritique\b/i.test(t) && !/^critical (?:path|incident)/i.test(t)) out.how = 'evaluate';
        t = tidy(t.replace(/\b(?:briefly|in brief|in short|in (?:great |full )?detail|at length|elaborately|critically|clearly|fully|suitably|in a few (?:lines|words))\b,?/gi, ' ')).replace(/^about\s+/i, '').replace(/[,;:]+$/, '');
        t = t.replace(new RegExp(`^(${DO})\\s+about\\s+`, 'i'), '$1 ').replace(/^(?:do|can) you (?:explain|describe|define)\s+/i, 'explain ').replace(/^(?:critical (?:analysis|evaluation|appraisal) of)\s+/i, 'evaluate ');
        // "Explain and describe the process"
        t = t.replace(new RegExp(`^(${DO})(?:\\s*,\\s*${DO})*\\s+and\\s+(?=${DO}\\b)`, 'i'), '');
        out.verb = (new RegExp(`^(${DO}|what|why|how)\\b`, 'i').exec(t) || [''])[0].toLowerCase();
        const put = (list) => {
            for (const p of list) out.parts.push({ ...p, weight });
            return out;
        };
        const versus = compared(t, state);
        if (versus) return put(versus);
        const bond = /^(?:(?:explain|discuss|describe|state|examine|bring out|show|establish|write|what is|comment on)\s+)?(?:the\s+)?(?:inter-?)?(?:relations?|relationship|link|linkage|interdependence|connection)\s+(?:between|of)\s+(.{2,60}?)\s+(?:and|&|with|to)\s+(.{2,60})$/i.exec(t) || /^(?:(?:explain|discuss|describe|show)\s+)?how\s+(?:are\s+|is\s+)?(.{2,50}?)\s+(?:and|&)\s+(.{2,50}?)\s+(?:are\s+)?(?:inter-?)?(?:related|linked|connected|dependent)\b/i.exec(t);
        if (bond) {
            const [a, b] = [topicOf(bond[1], state), topicOf(bond[2], state)];
            return put([{ topic: `${a.topic} and ${b.topic}`, facet: 'relationship', known: a.known || b.known, sides: [a.topic, b.topic], first: a.topic }]);
        }
        // A note on something.
        if (/^(?:write|give|prepare)?\s*(?:an?\s+)?(?:(?:short|brief|explanatory|critical|detailed)\s+)*notes?\s+(?:on|about|upon)?\s*:?\s*(?:(?:any (?:one|two|three|four)|the following)(?: of the following)?)?\s*:?$/i.test(t)) {
            state.notes = true;
            out.how = 'short-note';
            return out;
        }
        if (state.notes) return put(topicsOf(t, state).map((x) => ({ ...x, facet: 'short-note' })));
        const note = /^(?:write|give|prepare)?\s*(?:an?\s+)?(?:(?:short|brief|explanatory|critical|detailed)\s+)*notes?\s+(?:on|about|upon)\s*:?\s*(?:any (?:one|two|three|four)(?: of the following)?:?\s*)?(.{2,140})$/i.exec(t);
        if (note) {
            out.how = 'short-note';
            const list = OF.exec(note[1]);
            if (list && !bank.natural[known(note[1])]) return put(facetsOf(list[1]).filter(Boolean).map((facet) => ({ ...topicOf(list[2], state), facet: 'short-note', asked: facet })).slice(0, 1).map((p) => ({ ...p, topic: p.topic, asked: p.asked })));
            return put(topicsOf(note[1], state).map((x) => ({ ...x, facet: 'short-note' })));
        }
        // "Why is it necessary?"
        const why = /^why\s+(?:(?:is|are|do we|does|do)\s+)?(?:an?\s+|the\s+)?(.{2,70}?)\s+(?:is\s+|are\s+)?(?:(?:so|very|considered|regarded as|said to be)\s+)*(?:important|necessary|needed|required|essential|significant|vital|indispensable|need)\b/i.exec(t) || /^why (?:do|does) .{2,40}? need\s+(.{2,60})$/i.exec(t);
        if (why) return put([{ ...topicOf(why[1], state), facet: 'importance' }]);
        // "What do you understand by X?", "Define X"
        const what = /^(?:define|what (?:do|did) you (?:mean|meant|understand|know)(?: by| about| of)?|what (?:is|are) (?:the )?(?:meant by|meaning of|concept of|definition of)|what (?:is|are)(?: meant by)?|who (?:is|are)(?= (?:an?|the) )|give the (?:meaning|definition) of|(?:the )?(?:meaning|definition) of)\s+(.{1,140})$/i.exec(t);
        const asks = what ? what[1].replace(/^(?:the\s+)?(?:concept|meaning|definition|term|terms|tern)\s+(?:of\s+)?/i, '') : '';
        const body = what ? (/\b(?:concept|meaning|definition)\b.*\band\b/i.test(what[1].slice(0, 40)) ? what[1] : asks) : tidy(t.replace(new RegExp(`^(?:${ABOUT})\\s+`, 'i'), '').replace(/^(?:me |about |on )/i, ''));
        const rest = tidy(body).replace(/^(?:the|an?)\s+/i, '').replace(/[?.!,;:]+$/, '');
        const single = (x) => (what ? [{ ...x, facet: 'definition' }] : whole(x));
        // "some other characteristics of it", "its importance and limitations"
        const its = new RegExp(`^(?:its|their|his)\\s+(${FLIST})(?:\\s+(?:of|in|for|to|involved).*)?$`, 'i').exec(rest) || (state.last && new RegExp(`^(${FLIST})(?:\\s+(?:of|involved in|in|for)\\s+(?:it|this|them|the same))?$`, 'i').exec(rest));
        if (its && state.last && facetsOf(its[1]).every(Boolean)) return put(pieces2(its[1]).map((w) => ({ topic: state.last, known: state.lastKnown, again: true, facet: facetOf(w), word: wordOf(w) })));
        // A list that is a topic of its own: levels of management, factors of production.
        const theirs = WHO.filter(([who, how]) => who.test(rest) && how.test(rest)).filter(([who], i, a) => a.findIndex((x) => String(x[0]).slice(0, 8) === String(who).slice(0, 8)) === i);
        if (theirs.length > 1 && !known(rest)) return put(theirs.flatMap(([, , name]) => single({ topic: name, known: true })));
        for (const [who, how, name] of WHO) if (who.test(rest) && how.test(rest) && !new RegExp(`^${ADJ}(?:advantages|disadvantages|limitations|merits|demerits|criticisms?|importance|features|assumptions)\\b`, 'i').test(rest)) return put(single({ topic: name, known: true }));
        const own = known(rest) || known(rest.replace(FILL, '')) || known(rest.replace(new RegExp(`^${ADJ}`, 'i'), '').replace(FILL, ''));
        if (own && bank.natural[own]) return put(single({ topic: own, known: true }));
        // "features and limitations of planning"
        const of = OF.exec(rest);
        if (of && facetsOf(of[1]).every(Boolean)) {
            const concept = /^(?:the\s+)?concept$/i.test(of[1].trim()) && !what && /^(?:explain|discuss|describe|elaborate|write|illustrate)/i.test(t);
            // "features of monopoly and the features of competition": one thing after the other.
            const more = new RegExp(`^(.{2,70}?),?\\s+and\\s+(?:also\\s+)?(?:the\\s+)?((?:${FWORD})(?:\\s+(?:of|in)\\s+.{2,70}))$`, 'i').exec(of[2]);
            const after = /^(.{2,70}?)\s+(?:and|along with|with|as well as)\s+(?:its|their)\s+(.{3,60})$/i.exec(of[2]);
            const end = more ? more[1] : after ? after[1] : of[2];
            const list = topicsOf(end, state);
            const got = [];
            for (const x of list) for (const w of pieces2(of[1])) {
                if (concept) got.push(...whole(x));
                else got.push({ ...x, facet: facetOf(w), word: wordOf(w) });
            }
            if (after) for (const w of pieces2(after[2])) if (facetOf(w)) got.push({ ...list[0], facet: facetOf(w), word: wordOf(w) });
            if (more) {
                const two = OF.exec(more[2]);
                const x = topicOf(two[2], state);
                for (const facet of facetsOf(two[1]).filter(Boolean)) got.push({ ...x, facet });
            }
            return put(got);
        }
        // "motivation and its importance", "management: nature and scope"
        const afterOf = (x) => (facetsOf(x).every(Boolean) ? x : x.replace(/\s+(?:on|upon|in|for|to|over)\s+.*$/i, ''));
        const after = /^(.{2,70}?)(?:\s*,)?\s+(?:and|along with|with|as well as|also)\s+(?:(?:explain|discuss|describe|state)\s+)?(?:its|their)\s+(.{3,70})$/i.exec(rest) || /^(.{2,60}?)\s*[:–]\s*(.{3,70})$/.exec(rest);
        if (after) after[2] = afterOf(after[2]);
        if (after && facetsOf(after[2]).every(Boolean)) {
            const x = topicOf(after[1], state);
            return put([...(what || facetOf('x') ? [{ ...x, facet: 'definition' }] : /:|–/.test(rest) ? [] : [{ ...x, facet: 'definition' }]), ...pieces2(after[2]).map((w) => ({ ...x, facet: facetOf(w), word: wordOf(w) }))]);
        }
        const join = !what && !known(rest) && /^(.{3,70}?)\s+and\s+(.{3,90})$/i.exec(rest);
        if (join) {
            const right = OF.exec(join[2]);
            if (right && facetsOf(right[1]).every(Boolean) && topicOf(right[2], { ...state, senses: [] }).known && topicOf(join[1], { ...state, senses: [] }).known) {
                const l = read1(`explain ${join[1]}`, state);
                const m = read1(`explain ${join[2]}`, state);
                return put([...l.parts, ...m.parts]);
            }
        }
        // "the selection process", "planning techniques"
        if (!what || /^(?:what are)\b/i.test(t)) {
            const tail = new RegExp(`^${ADJ}(.{2,60}?)\\s+(process|procedure|steps|stages|functions|principles|objectives|types|techniques|methods|advantages|limitations|features|characteristics|tools|factors)$`, 'i').exec(rest);
            if (tail && known(tail[1]) && (!known(rest) || known(rest) === known(tail[1]))) return put([{ ...topicOf(tail[1], state), facet: facetOf(tail[2]), word: wordOf(tail[2]) }]);
        }
        if (what || new RegExp(`^${DO}\\b|^what\\b`, 'i').test(t) || !WH.test(t)) {
            if (/^(?:how|why|whether)\b/i.test(rest)) {
                const x = inside(rest);
                return x ? put(whole({ topic: x, known: true })) : put([]);
            }
            // A clause that repeats what was asked before adds nothing.
            if (!rest || /^(?:it|this|that|them|these|reasons?|examples?|suitable examples?|your answer|statement|the statement)$/i.test(rest)) return out;
            const list = topicsOf(rest, state);
            return put(list.flatMap(single));
        }
        // "How is it measured?", after the thing itself was named.
        if (state.last && /^how\b.*\b(?:it|they|them|this|these)\b/i.test(t) && words(t) < 10) return put([{ topic: state.last, known: state.lastKnown, again: true, facet: 'process' }]);
        if (state.last && /^why\b.*\b(?:it|they|this)\b/i.test(t) && words(t) < 12) return put([{ topic: state.last, known: state.lastKnown, again: true, facet: 'importance' }]);
        const held = /^why\s+(?:is|are)\s+(?:the\s+)?(.{2,50}?)\s+(?:considered|regarded|called|said|treated|known)\b/i.exec(t);
        if (held && topicOf(held[1], state).known) return put([{ ...topicOf(held[1], state), facet: 'importance' }]);
        // "How can decentralisation be made effective?"
        out.free = true;
        const x = inside(t);
        if (x) return put([...(/^how\b.*\b(?:done|carried out|conducted|prepared|calculated|measured|made|formed|performed|developed)\b/i.test(t) ? [{ topic: x, known: true, facet: 'process' }] : whole({ topic: x, known: true }))]);
        return put(whole({ topic: bare(t), known: false }));
    }

    // ---- Hindi and Hinglish ----

    const INDIC = [
        ['definition', 'paribhasha|paribhasa|arth|matlab|aashay|avdharna|meaning|definition|परिभाषा|परिभाषाएँ|अर्थ|आशय|अवधारणा|संकल्पना'], ['features', 'visheshta[a-z]*|visheshtayen?|lakshan|prakriti|swabhav|features?|characteristics?|nature|विशेषता|विशेषताएँ|विशेषताएं|विशेषताये|विशेषताओं|लक्षण|लक्षणों|प्रकृति|स्वभाव'],
        ['scope', 'kshetra|scope|क्षेत्र'], ['importance', 'mahatv[a-z]*|mahatw[a-z]*|importance|zaroorat|zarurat|jarurat|aavashyakta|avashyakta|need|significance|महत्व|महत्त्व|महत्ता|आवश्यकता'], ['objectives', 'uddeshy[a-z]*|udeshy[a-z]*|objectives?|lakshya|उद्देश्य|उद्देश्यों|लक्ष्य'],
        ['types', 'prakar|prakaar|types?|kinds?|vargikaran|tatv[a-z]*|srot|sources?|elements?|vidhi[a-z]*|methods?|techniques?|taknik|shailiy[a-z]*|styles?|प्रकार|प्रकारों|वर्गीकरण|तत्व|तत्त्व|तत्वों|स्रोत|विधि|विधियाँ|विधियां|विधियों|तकनीक|तकनीकें|भेद'],
        ['process', 'prakriya|prakriyaa|process|charan|steps?|stages?|procedure|प्रक्रिया|चरण|चरणों|अवस्थाएँ|अवस्थाएं|अवस्थाओं'], ['principles', 'siddhant[a-z]*|sidhant[a-z]*|principles?|सिद्धांत|सिद्धान्त|सिद्धांतों|सिद्धान्तों'], ['functions', 'karya|kaarya|karyon|functions?|bhumika|role|कार्य|कार्यों|भूमिका'],
        ['advantages', 'fay?de|faayde|fayda|faide|labh|laabh|gun|advantages?|benefits?|merits?|लाभ|लाभों|गुण|फायदे|फ़ायदे'], ['limitations', 'nuksan|nuqsan|nuksaan|hani[a-z]*|haani[a-z]*|dosh|seema[a-z]*|sima[a-z]*|apvad|baadha[a-z]*|badha[a-z]*|disadvantages?|limitations?|demerits?|सीमा|सीमाएँ|सीमाएं|सीमाओं|हानि|हानियाँ|हानियां|दोष|दोषों|नुकसान|अपवाद|बाधा|बाधाएँ|बाधाएं|बाधाओं'], ['factors', 'karak|karako[a-z]*|karan|factors?|कारक|कारकों|घटक|घटकों|कारण|कारणों'],
    ].map(([name, w]) => [name, new RegExp(`^(?:${w})$`, 'iu')]);
    const DIFFER = '(?:antar|difference|differences|farak|fark|farq|bhed|अंतर|अन्तर|भेद|फर्क|फ़र्क|भिन्नता|तुलना)';
    const JOIN = '(?:aur|or|and|&|evam|tatha|va|तथा|एवं|एवम्|और|व)';
    const AFTER = /^(?:ke|ki|ka|k|ko|me|mein|main|mai|se|par|की|के|का|को|में|से|पर|kitne|kitni|कितने|कितनी|vibhinn|विभिन्न|mukhya|मुख्य|pramukh|प्रमुख|main|liye|लिए)$/iu;
    const SAYS = /^(?:batao|bataiye|bataye|bataiy|bata|samjhao|samjhaiye|samjhaye|samjha|likho|likhiye|likhe|dijiye|do|karo|kijiye|kare|karen|explain|define|describe|discuss|bare|baare|hai|hain|he|hota|hoti|hote|kya|kise|kisko|kehte|kahte|kahate|aap|samajhte|samjhte|vyakhya|varnan|vivechna|spasht|short|note|tippani|sankshipt|vistar|sahit|udaharan|example|ek|par|on|बताइए|बताइये|बताएं|बताएँ|बताओ|समझाइए|समझाइये|समझाएं|समझाएँ|समझाओ|लिखिए|लिखिये|लिखें|लिखो|दीजिए|दीजिये|कीजिए|कीजिये|करें|करो|वर्णन|विवेचना|विवेचन|व्याख्या|स्पष्ट|है|हैं|क्या|किसे|कहते|होता|होती|होते|आप|समझते|टिप्पणी|संक्षिप्त|संक्षेप|विस्तार|सहित|उदाहरण|एक|परिभाषित|सविस्तार|आलोचनात्मक|मूल्यांकन|पर)$/iu;
    const PRON = /^(?:iske|iski|iska|uske|uski|uska|inke|inki|inka|unke|unki|isko|इसके|इसकी|इसका|उसके|उसकी|उसका|इनके|इनकी|उनके|उनकी)$/iu;
    const DEVA = /\p{Script=Devanagari}/u;
    function languageOf(q) {
        if (DEVA.test(q)) return 'hi';
        const hits = (q.match(/\b(?:batao|bataiye|bataye|samjhao|samjhaiye|samjhaye|likho|likhiye|kijiye|kya hai|kya hain|kya hota|kya hoti|kise kehte|kise kahte|mein|antar|ke|ki|ka|aur|kitne|prakar|hai|hain|iske|iski|uske|paribhasha|mahatva|visheshtaye|uddeshya|prakriya|siddhant|fayde|nuksan|karya|karo)\b/gi) || []).length;
        return hits > 1 || /\b(?:batao|bataiye|bataye|samjhao|samjhaiye|samjhaye|likhiye|kijiye|kya (?:hai|hain|hota|hoti|he)|kise (?:kehte|kahte))\b/i.test(q) ? 'hinglish' : 'en';
    }
    /** A Hindi or Hinglish name as a topic. */
    function indicTopic(list, state) {
        while (list.length && AFTER.test(list[list.length - 1])) list.pop();
        while (list.length && /^(?:हेनरी|henry|henri|डॉ|dr)$/iu.test(list[0])) list.shift();
        const text = list.join(' ').toLowerCase();
        if (!text || list.every((w) => PRON.test(w))) return state.last ? { topic: state.last, known: state.lastKnown, again: true } : null;
        const sure = bank.hindi.get(text);
        if (sure) return { topic: sure, known: true };
        // Word by word, the longest name first.
        const out = [];
        let met = 0;
        for (let i = 0; i < list.length;) {
            let n = Math.min(5, list.length - i);
            for (; n > 0 && !bank.hindi.has(list.slice(i, i + n).join(' ').toLowerCase()); n--);
            if (n) {
                out.push(bank.hindi.get(list.slice(i, i + n).join(' ').toLowerCase()));
                met += n;
                i += n;
            } else {
                if (!AFTER.test(list[i])) out.push(list[i]);
                i++;
            }
        }
        const t = topicOf(out.join(' '), state);
        if (!t.known && t.within && bank.natural[t.within] && words(t.topic) - words(t.within) < 3) return { topic: t.within, known: true };
        return t.known || !met ? t : { ...t, known: out.length === 1 };
    }
    function indic(c, state) {
        const out = { parts: [], verb: 'explain', how: '' };
        const t = tidy(c.replace(/[?.!।,"“”]+/g, ' '));
        const weight = /संक्षेप|\bsankshep|\bbriefly\b/i.test(t) && !/टिप्पणी|tippani/i.test(t) ? 0.5 : /विस्तार|सविस्तार|\bvistar/i.test(t) && !/नियंत्रण का विस्तार|niyantran ka vistar/i.test(t) ? 1.5 : 1;
        if (/टिप्पणी|\btippani\b|\bshort note\b/i.test(t)) out.how = 'short-note';
        if (/आलोचनात्मक|\baalochnatmak|\balochnatmak/i.test(t)) out.how = 'evaluate';
        const put = (list) => {
            for (const p of list) out.parts.push({ ...p, weight });
            return out;
        };
        const versus = new RegExp(`^(.{1,80}?)\\s+${JOIN}\\s+(.{1,80}?)\\s+(?:me|mein|main|mai|ke (?:beech|bich)(?: me| mein)?|में|के बीच(?: में)?|की|ki)\\s+(?:(?:kya|क्या|mukhya|मुख्य)\\s+)?${DIFFER}(?:\\s|$)`, 'iu').exec(t) || new RegExp(`^(.{1,80}?)\\s+${JOIN}\\s+(.{1,80}?)\\s+(?:ka|का)\\s+${DIFFER}(?:\\s|$)`, 'iu').exec(t);
        if (versus) {
            const [a, b] = [indicTopic(versus[1].split(' '), state), indicTopic(versus[2].split(' '), state)];
            if (a && b) return put([{ topic: `${a.topic} and ${b.topic}`, facet: 'comparison', known: a.known || b.known, sides: [a.topic, b.topic], first: a.topic }]);
        }
        const defines = /(?:kya (?:hai|hain|he|hota|hoti)|kise (?:kehte|kahte|kahate)|kya (?:samajhte|samjhte)|क्या (?:है|हैं|होता|होती|समझते)|किसे कहते|क्या आशय|परिभाषित)/iu.test(t);
        const at = t.split(' ').filter((w) => !SAYS.test(w) || bank.hindi.has(w.toLowerCase()));
        while (at.length && (AFTER.test(at[at.length - 1]) || SAYS.test(at[at.length - 1]))) at.pop();
        for (const [who, what, name] of WHO) if (who.test(t) && what.test(t)) return put(whole({ topic: name, known: true }));
        const all = bank.hindi.get(at.join(' ').toLowerCase());
        if (all && bank.natural[all] && !defines) return put(whole({ topic: all, known: true }));
        const isFacet = (w) => (INDIC.find(([, p]) => p.test(w)) || [''])[0];
        // A name may hold a word that is also a facet, as in "karya vishleshan".
        let first = -1;
        for (let i = 0; i < at.length; i++) {
            let n = Math.min(5, at.length - i);
            for (; n > 1 && !bank.hindi.has(at.slice(i, i + n).join(' ').toLowerCase()); n--);
            if (n > 1) { i += n - 1; continue; }
            if (isFacet(at[i]) && (i > 0 || state.last)) { first = i; break; }
        }
        if (first >= 0) {
            // "types of planning batao" is English with a Hindi verb.
            if (/^(?:of|in)$/i.test(at[first + 1] || '') || first === 0 && !state.last) return read1(at.join(' '), state);
            const topic = indicTopic(at.slice(0, first), state);
            let facets = at.slice(first).map(isFacet).filter(Boolean);
            // Hindi has one word for a principle and a theory.
            if (topic && facets.includes('principles') && bank.info.has(`theories of ${topic.topic}`)) return put(whole({ topic: `theories of ${topic.topic}`, known: true }));
            if (topic) return put([...(defines && !facets.includes('definition') ? [{ ...topic, facet: 'definition' }] : []), ...facets.map((facet) => ({ ...topic, facet }))]);
        }
        if (OF.test(at.join(' '))) return read1(at.join(' '), state);
        const topic = indicTopic([...at], state);
        if (!topic) return out;
        if (out.how === 'short-note') return put([{ ...topic, facet: 'short-note' }]);
        if (defines) out.verb = 'define';
        return put(defines ? [{ ...topic, facet: 'definition' }] : whole(topic));
    }

    // ---- Statements ----

    const ONLY = /^(?:(?:please|critically|briefly)\s+)*(?:(?:explain|discuss|comment|elucidate|examine|justify|evaluate|analy[sz]e|illustrate|elaborate|substantiate|critically)(?:\s*(?:,|and)\s*(?:explain|discuss|comment|elucidate|examine|justify|evaluate|illustrate))*)?(?:\s+(?:on|upon|with|in|of))?\s*(?:(?:this|the|above|given|following|your)\s*)*(?:statement|quotation|view|views|remark|answer|it|light)?(?:\s+(?:critically|briefly|in detail|in brief|clearly|with (?:suitable |the help of )?(?:examples?|reasons?|illustrations?)|giving (?:suitable )?(?:examples?|reasons?)|of this statement))*\s*[.?!]*$|^(?:do you agree|are you agree|give (?:your )?(?:reasons|views|opinion)|why\b.{0,12}$|how far\b.{0,40}$|to what extent\b.{0,40}$|give arguments|support your answer|justify your answer)/i;
    const CUE = /\b(?:this statement|the statement|above statement|comment|do you agree|justify|elucidate|examine the (?:statement|view)|critically examine)\b|(?:^|[.?!"”'’]\s*)(?:discuss|explain|examine|evaluate|illustrate)\s*[.?!]*\s*$/i;
    const FREE = /^(?:is|are|why|whether|how far|do you|can|explain (?:whether|why|how)|discuss (?:whether|why))\b|\b(?:said to be|considered|regarded|called|call)\b/i;
    /** A quoted or plain statement, the claims it makes, and what else the question asks. */
    function statementOf(s) {
        let said = '';
        let rest = '';
        const quoted = /["“”«]([^"“”»]{12,260})["“”»]/.exec(s) || /(?:^|[\s(:])['‘`]{1,2}((?:[^'’`]|['’](?=\p{L})){12,260})['’]{1,2}(?=[\s.,?!)]|$)/u.exec(s);
        if (quoted && words(quoted[1]) > 3) {
            said = quoted[1];
            rest = `${s.slice(0, quoted.index)} . ${s.slice(quoted.index + quoted[0].length)}`;
        } else {
            const plain = /^([^.?!]{12,240}[.!])\s+(.*)$/.exec(s);
            if (plain && !WH.test(plain[1]) && !new RegExp(`^(?:${DO}|write)\\b`, 'i').test(plain[1]) && /\b(?:is|are|was|were|has|have|does|do|can|may|must|should|begins?|means|implies|involves?|requires?|helps?|plays?)\b/i.test(plain[1]) && CUE.test(plain[2])) [said, rest] = [plain[1], plain[2]];
        }
        const entry = (text) => bank.statements.find((x) => x.say.some((p) => p.test(text)));
        if (said) return { said: bare(said), entry: entry(said), rest };
        // Not quoted, but it asks about a claim that is known.
        for (const part of s.split(/(?<=[.?!])\s+/)) {
            if (/\b(?:differen|distinguish|compar|short notes?|write (?:a )?notes?)/i.test(part)) continue;
            const hit = entry(part);
            if (!hit || /^unity of command/.test(hit.name)) continue;
            if (FREE.test(part) || (/\bscience\b/i.test(part) && /\bart\b/i.test(part)) || CUE.test(s.slice(s.indexOf(part)))) return { said: bare(part), entry: hit, rest: s.replace(part, ' '), asked: true };
        }
        return null;
    }

    const codeTitle = (code) => bank.titles.get(code) || '';
    /** The course whose list of topics says nearly the same. */
    function courseOf(topic) {
        const q = [...new Set(norm(topic).split(' ').filter((w) => w.length > 2))];
        if (!q.length || q.length > 8) return '';
        const idf = (w) => Math.log(1 + bank.heads.size / (1 + (bank.df.get(w) || 0)));
        const all = q.reduce((n, w) => n + idf(w), 0);
        let best = '';
        let points = 1.05;
        for (const set of bank.heads) {
            const both = q.filter((w) => set.has(w));
            if (!both.length) continue;
            const hit = both.reduce((n, w) => n + idf(w), 0);
            const v = hit / all + 0.5 * hit / [...set].reduce((n, w) => n + idf(w), 0) + (/^Semester [1-4]/.test(set.course.group) ? 0.05 : 0);
            if (hit / all > 0.7 && v > points) [best, points] = [set.course.code, v];
        }
        return best;
    }

    function parts1(s, state, language) {
        const out = { parts: [], verbs: [], hows: [], free: false, clauses: 0, statement: '', entry: null };
        const take = (p) => {
            // A short form or a word of another subject is kept apart by its sense.
            out.parts.push(p);
            if (!p.again && p.facet !== 'comparison') {
                state.last = p.topic;
                state.lastKnown = p.known;
            } else if (p.facet === 'comparison' && !p.again && p.first) {
                state.last = state.last || p.first;
                state.lastKnown = state.lastKnown || p.known;
            }
        };
        let text = s;
        const claim = language === 'en' ? statementOf(s) : null;
        if (claim) {
            out.statement = claim.said;
            out.entry = claim.entry || null;
            if (claim.entry) for (const [topic, facet, weight, more = {}] of claim.entry.parts) take({ topic, facet, weight, known: true, claim: true, ask: more.ask, must: more.must });
            else {
                const subject = /^(?:the\s+|an?\s+)?(.{2,60}?)\s+(?:is|are|was|were|has|have|does|do|can|may|must|should|begins?|means|implies|involves?|requires?|helps?|plays?|represents?|leads?)\b/i.exec(claim.said);
                const first = subject ? topicOf(subject[1].replace(/^(?:all|every|no)\s+/i, ''), state) : null;
                const t = first && first.known ? first : inside(claim.said) ? { topic: inside(claim.said), known: true } : first || topicOf(claim.said, state);
                take({ ...t, facet: 'definition', weight: 1, claim: true });
                take({ ...t, facet: 'features', weight: 1, claim: true });
                take({ ...t, facet: 'statement-conclusion', weight: 1, claim: true });
            }
            text = claim.rest;
        }
        const list = language === 'en' ? pieces(text) : text.split(/(?<=[?.!।])\s+(?=\S)|;\s*|।/).map((x) => x.trim()).filter((x) => /[\p{L}]/u.test(x));
        for (const c of list) {
            if (claim && ONLY.test(c.trim())) continue;
            if (!claim && out.parts.length && ONLY.test(c.trim()) && !/^why\b/i.test(c)) continue;
            // A sentence that sets the scene asks nothing.
            if (language === 'en' && list.length > 1 && words(c) > 7 && !new RegExp(`^(?:(?:also|briefly|critically|further|besides|and|then|please|in detail)\\W+)*(?:${DO}|write|in what|to what)\\b`, 'i').test(c) && !WH.test(c.replace(/^(?:also|and|then)\s+/i, '')) && !OF.test(c) && !/\b(?:vs|versus|difference)\b/i.test(c)) continue;
            const got = language === 'en' ? read1(c, state) : indic(c, state);
            out.clauses++;
            out.verbs.push(got.verb);
            if (got.how) out.hows.push(got.how);
            if (got.free) out.free = true;
            for (const p of got.parts) take(p);
        }
        return out;
    }

    /** The clauses of an English question, each with one thing to do. */
    function pieces(text) {
        const out = [];
        const verb = `(?:(?:briefly|critically|also|clearly|in detail)\\s+)*(?:${DO}|what (?:is|are|do)|why|how (?:is|are|do|does))\\b`;
        for (const sentence of text.split(/(?<=[?!।])\s*(?=\S)|(?<=[^\s.]{2}\.)\s+(?=\S)|\s*;\s*|(?<=\.)\s+(?=[A-Z("“])/)) {
            const t = sentence.trim().replace(/^[.,:;–-]+\s*/, '');
            if (!/\p{L}/u.test(t)) continue;
            out.push(...t.split(new RegExp(`,?\\s+(?:and|also|then|&|further|besides)\\s*,?\\s+(?:also\\s+)?(?=${verb})|,\\s+(?=${verb})`, 'i')).map((x) => x.trim().replace(/[?.!।]+$/, '')).filter((x) => /\p{L}{2}/u.test(x)));
        }
        return out.filter((x, i) => i === out.length - 1 || !new RegExp(`^(?:(?:briefly|critically|also)\\s+)*${DO}$`, 'i').test(x));
    }

    /**
     * The one structured query that everything after it reads.
     * @param known a speller, as speller() gives it; before: the topic of the question before; subject: the code of the subject that the visitor chose
     */
    function query(question, { known: speller_ = null, before = '', subject = '' } = {}) {
        const original = String(question);
        const language = languageOf(original);
        let q = original.replace(/\s+/g, ' ').trim();
        if (before && language !== 'hi') q = follow(q, before);
        // Two whole questions with OR between them.
        const or = /^(.{8,}?)\s+(?:\(\s*or\s*\)|OR|अथवा|[-–]+\s*or\s*[-–]+)\s+(.{8,})$/.exec(q) || /^(.{8,}?)\s+\(\s*or\s*\)\s+(.{8,})$/i.exec(q);
        const two = or && (new RegExp(`^(?:\\(?[a-z]{1,3}\\)\\s*|q\\.?\\s*\\d*[.)]?\\s*)*(?:${DO}|write|what|why|how|is|are|who|["“'‘])`, 'i').test(or[2]) || language === 'hi') ? [or[1], or[2]] : [q];
        const reads = two.map((x) => {
            const frame = unframe(x);
            const wants = [];
            let s = frame.s.replace(/,?\s*\b(?:(?:and\s+)?(?:with|giving|give|by giving|along with|citing|quoting|using)\s+(?:the help of\s+)?(?:an?\s+|some\s+|two\s+|three\s+)?(?:suitable|appropriate|relevant|practical|real[- ]life|proper)?\s*(?:examples?|illustrations?))\b/gi, () => { wants.push('examples'); return ' '; })
                .replace(/,?\s*\b(?:with|using|draw|give|also draw|and draw)\s+(?:the help of\s+)?(?:an?\s+|the\s+)?(?:neat|suitable|labelled|neat and labelled|proper|clean)?\s*(?:and\s+\w+\s+)?(?:diagrams?|figures?|sketch|flow ?charts?)\b/gi, () => { wants.push('diagram'); return ' '; });
            if (/उदाहरण|\budaharan|\bexample sahit/i.test(s) && language !== 'en') wants.push('examples');
            if (/चित्र|रेखाचित्र/.test(s)) wants.push('diagram');
            s = tidy(s.replace(/\b([A-Za-z]) [-–] ?(?=[a-z])/g, '$1-'));
            const mended = mendTopics(s, speller_);
            s = mended.q.replace(/\b[A-Z]{3,6}\b/g, (w) => (bank.names.get(norm(w)) ? w : SHORT[w] || INDIA[w] || w));
            const state = { last: before, lastKnown: Boolean(before), senses: [], subject, others: s };
            const got = parts1(s, state, language);
            return { ...got, frame, wants: [...new Set(wants)], fixed: mended.fixed, senses: state.senses, text: s };
        });
        const build = (r) => {
            let parts = [];
            for (const p of r.parts) if (!parts.some((x) => x.facet === p.facet && norm(x.topic) === norm(p.topic))) parts.push(p);
            if (r.hows.includes('evaluate') && parts.length && !parts.some((p) => p.facet === 'comparison' || p.claim)) {
                const t = parts[0];
                for (const facet of ['advantages', 'limitations']) if (!parts.some((p) => p.facet === facet)) parts.push({ ...t, facet, whole: false });
            }
            const all = (facet) => parts.length > 0 && parts.every((p) => p.facet === facet);
            const short = r.hows.includes('short-note') && parts.length > 0;
            if (short && parts.some((p) => p.facet === 'short-note')) parts = parts.filter((p) => p.facet === 'short-note');
            const listing = /^(?:enumerate|list|name|mention|point out|state)/;
            const command = all('comparison') ? 'compare' : all('short-note') || (r.hows.includes('short-note') && r.clauses === 1) ? 'short-note'
                : r.hows.includes('evaluate') || /\b(?:do you agree|justify)\b/i.test(r.text) && r.statement ? 'evaluate'
                    : all('definition') && r.verbs.every((v) => /^(?:define|what|)$/.test(v)) ? 'define'
                        : r.clauses === 1 && !r.statement && (listing.test(r.verbs[0] || '') || (/^write (?!an? (?:essay|note|short|brief|detailed))/i.test(r.text) && parts.every((p) => !p.whole))) ? 'list' : 'explain';
            return { parts, command };
        };
        const first = build(reads[0]);
        const r = reads[0];
        // The subject: the one chosen, or that of the topics.
        const codes = new Map();
        for (const p of first.parts) {
            const names = p.sides || [p.topic];
            for (const n of names) {
                const info = bank.info.get(n) || bank.info.get(p.within || '');
                const context = p.field && inside(p.field) ? bank.info.get(inside(p.field)) : null;
                const list = p.sense ? [p.sense] : context && context.codes[0] !== 'CC101' ? context.codes : info ? info.codes : [];
                list.forEach((c, i) => codes.set(c, (codes.get(c) || 0) + (i ? 0.5 : 1) * (p.facet === 'comparison' ? 1 : p.weight || 1)));
            }
        }
        let code = subject || (r.entry && r.entry.subject) || ([...codes.entries()].sort((a, b) => b[1] - a[1])[0] || [''])[0];
        if (!code && first.parts.length) code = courseOf(first.parts[0].topic);
        // A fact, or a topic that only holds a word of the course ("the capital of France"), is looked up as it stands.
        const fact = r.clauses < 2 && !r.statement && (r.free || /^(?:who|whom|whose|when|where|which|how (?:many|much|old|long|far|big|high|deep|fast))\b/i.test(r.text));
        const course = !fact && first.parts.some((p) => p.known || (p.within && (subject || (words(p.within) > 1 && words(p.topic) < 9))));
        let confidence = 0.95;
        if (!first.parts.length) confidence = 0.2;
        if (first.parts.some((p) => !p.known)) confidence -= first.parts.some((p) => !p.known && !p.within) ? 0.4 : 0.2;
        if (r.fixed.length) confidence -= 0.05;
        if (r.statement && !r.entry) confidence -= 0.4;
        if (first.parts.some((p) => p.whole)) confidence -= 0.05;
        if (r.senses.length) confidence -= 0.15;
        if (r.free) confidence -= 0.1;
        const tidyParts = (list) => list.map((p) => ({ topic: p.topic, facet: p.facet, weight: p.weight || 1, ...(p.word ? { word: p.word } : {}), ...(p.must ? { ask: p.ask, must: p.must } : {}), ...(p.sides ? { sides: p.sides } : {}), ...(p.whole ? { whole: true } : {}), ...(bank.natural[p.topic] === p.facet ? { list: true } : {}), known: Boolean(p.known) }));
        const marks = r.frame.marks;
        const alternatives = [];
        if (reads[1]) {
            const b = build(reads[1]);
            if (b.parts.length) alternatives.push({ why: 'or', question: reads[1].text, parts: tidyParts(b.parts), command: b.command });
        }
        for (const x of r.senses) if (!alternatives.some((a) => a.topic === x.topic)) alternatives.push({ why: 'sense', topic: x.topic, subject: codeTitle(x.subject), code: x.subject, parts: tidyParts(first.parts.map((p) => (p.topic === x.from ? { ...p, topic: x.topic } : p))), command: first.command });
        return {
            original, text: r.text, subject: codeTitle(code), code, parts: tidyParts(first.parts), command: first.command, marks, words: r.frame.words || wordsFor(marks), told: Boolean(marks || r.frame.words),
            language, confidence: Math.max(0.05, Math.round(100 * confidence) / 100), alternatives, with: r.wants, statement: r.statement, fixed: r.fixed, course, free: r.free,
        };
    }

    return { follow, INDIA, SHORT, sum, clauses, english, long, plan, query, teach, wordsFor, speller, spell };
})();
