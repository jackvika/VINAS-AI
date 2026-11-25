// Answers a question with what Wikipedia says. There is no AI here: it reads the question, finds and ranks sentences,
// puts them in order, and always names its sources.
const Ask = (() => {
    const STOP = new Set(('a an the of in on at to for from by with and or but is are was were be been being am do does did has have had can could will would shall should may might must not no what which '
        + 'who whom whose that this these those when where why how many much it its as about into than then there their they them you your i me my we our us please tell explain describe define write give '
        + 'examine analyse analyze evaluate outline state enumerate illustrate elaborate discuss assess comment briefly critically list name mean means meaning definition short long note notes answer question detail details brief example examples between difference differences compare comparison vs versus '
        + 'क्या है हैं था थी थे कौन किसने कब कहाँ कहां कैसे क्यों किसे किस का की के को में से पर और या एक यह वह ये वे होता होती होते बताओ बताइए समझाओ समझाइए परिभाषा अर्थ मतलब').split(' '));
    const LISTY = /\b(?:types?|kinds?|levels?|stages?|steps?|parts?|components?|functions?|features?|characteristics|advantages?|disadvantages?|benefits?|uses?|causes?|effects?|principles?|elements?|examples?|methods?|examples|symptoms?|objectives?|roles?|factors?|limitations?)\b/i;
    const HOSTS = { en: 'https://en.wikipedia.org', simple: 'https://simple.wikipedia.org', hi: 'https://hi.wikipedia.org' };
    const SIZES = { short: 60, medium: 150, long: 300, essay: 500 };    // words
    const NATURAL = { fact: 50, when: 60, number: 60, who: 80, define: 130, why: 170, compare: 260, list: 260, explain: 220 };
    // Parts of an article that seldom explain its subject. They count only when the question names them.
    const ASIDE = /\b(?:education|training|etymology|popular culture|derivative|adaptations?|legacy|awards|honou?rs|naming|namesakes|media|film|music|organi[sz]ations|journals|criticism)\b/i;
    const KIN = { tall: 'height high elevation metres meters feet', high: 'height elevation altitude metres meters feet', deep: 'depth metres meters feet', far: 'distance km miles kilometres', long: 'length km miles years', big: 'area size large', large: 'area size',
        old: 'age born founded built', fast: 'speed km/h mph', heavy: 'weight mass kg', independent: 'independence', died: 'death', born: 'birth', wrote: 'author written writer', invented: 'inventor invention patent', discovered: 'discovery discoverer' };
    const LENGTH = 'km|kilomet(?:er|re)s?|m|met(?:er|re)s?|cm|mm|ft|feet|foot|mi|miles?|light-years?|AU';
    const TIME = 'seconds?|minutes?|hours?|days?|weeks?|months?|years?|decades?|centuries';
    const SIZE = {    // the thing's name, the word after the number, the units
        tall: ['height|elevation', 'tall|high|above', LENGTH], high: ['height|elevation|altitude', 'tall|high|above', LENGTH], deep: ['depth', 'deep', LENGTH], wide: ['width|breadth|span', 'wide|across', LENGTH],
        far: ['distance', 'away|from', LENGTH], long: ['length|duration|lifespan|period', 'long', `${LENGTH}|${TIME}`], old: ['age', 'old|ago', TIME], fast: ['speed|velocity', 'fast', 'km/h|mph|m/s|km/s|knots|kilomet(?:er|re)s per (?:hour|second)|met(?:er|re)s per second|miles per hour'],
        heavy: ['weight|mass', 'heavy', 'kg|kilograms?|g|grams?|tonnes?|tons?|lb|pounds?'], big: ['area|size|diameter|radius', 'across|wide', `${LENGTH}|km2|km²|sq mi|square kilomet(?:er|re)s|square miles|hectares|acres`], hot: ['temperature', 'hot', '°C|°F|K|degrees'], cold: ['temperature', 'cold', '°C|°F|K|degrees'],
    };
    SIZE.large = SIZE.big;
    // Other ways to say a verb of the question.
    const VERB = { sink: 'sank sunk sinking', sank: 'sink sunk sinking', built: 'construction constructed completed commissioned build building', build: 'built construction', end: 'ended ending surrender surrendered', ended: 'ending surrender', start: 'started began begun', began: 'start started begun', begin: 'began begun started',
        die: 'died death', died: 'death', born: 'birth', become: 'became', independent: 'independence', wrote: 'written author writer novel play poem', invented: 'inventor invention patent patented inventing', discovered: 'discovery discoverer discovering', painted: 'painter painting portrait', founded: 'founder founding established', designed: 'designer architect', made: 'created built', shown: 'showed shows show', known: 'knew knows', created: 'creator made', won: 'winner winners champion', killed: 'assassinated assassin murdered', composed: 'composer', directed: 'director', discover: 'discovered discovery', invent: 'invented inventor' };
    const NUMBER = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|twenty|thirty|forty|fifty|hundred|thousand|\\d[\\d,.]*)';
    // How a sentence says that someone did it: the verb, the noun for the doer, and whether "a novel by ..." says it too.
    const DEED = {
        wrote: ['wrote|written|authored|composed|penned', 'author|writer|playwright|poet', true], invented: ['invent(?:ed|ing|s)|patented|devised', 'inventor', false], discovered: ['discover(?:ed|ing|s)|identified|isolated', 'discoverer', false],
        founded: ['founded|founding|co-founded|cofounded|established|started', 'founders?|co-founders?', true], built: ['built|building|constructed|commissioned|erected', 'builder|architect', true], painted: ['painted|painting', 'painter|artist', true],
        designed: ['designed|designing', 'designers?|architects?|engineers?', true], created: ['created|developed|made', 'creators?', true], made: ['made|created|developed', 'creators?|makers?', true], composed: ['composed|wrote|written', 'composer', true], directed: ['directed', 'director', true],
        won: ['won|winning|defeated|beat', 'winners?|champions?', false], killed: ['killed|assassinated|shot|murdered', 'assassin|killer', false], sang: ['sang|sung|recorded|performed', 'singer', true],
    };
    const WORK = 'painting|portrait|fresco|mural|novel|novella|book|play|tragedy|comedy|drama|poem|epic|story|stories|collection|film|song|opera|symphony|sculpture|statue|work|game|series';
    // Parts of an article that tell how a thing goes.
    const CORE = /^(?:description|overview|process(?:es)?|mechanism|principles?|how it works|basics|stages?|steps?|phases?|types?|structure|definitions?|components?|operation|function)\b/i;
    // Facts that are numbers.
    const QUANTITY = /\b(?:speed|velocity|population|area|height|length|depth|temperature|boiling point|melting point|freezing point|mass|weight|distance|diameter|radius|density|age|value|number|atomic number)\b/i;
    const CAUSE = /\b(?:because|due to|caused? by|causes?|the reasons?|results? from|as a result|owing to|consequence of|explained by|attributed to|which is why)\b|क्योंकि|कारण/i;
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
        const told = wish(question);
        const asked = sense(told.q);
        return { ...asked, told: told.words > 0, words: told.words || (told.much && Math.max(300, NATURAL[asked.kind])) || (told.little && Math.min(90, NATURAL[asked.kind])) || NATURAL[asked.kind] };
    }

    /** How long an answer the question asks for, and the question without that. */
    function wish(question) {
        let q = question.replace(/\s+/g, ' ').trim();
        let count = 0;
        // "(10 marks)" says how long, as examiners expect.
        q = q.replace(/[([]?\s*(?:for\s+)?(\d{1,2})\s*(?:marks?|अंक)\s*[)\]]?/i, (_, n) => {
            const m = Number(n);
            count = m <= 3 ? 80 : m <= 6 ? 220 : m <= 10 ? 400 : 550;
            return ' ';
        });
        // "in 200 words", "200-300 words", "(150 शब्द)", "100 shabd mein"
        q = q.replace(/[([]?\s*(?:(?:write|answer)\s+)?(?:in|within|about|around|of|upto|up to|approximately)?\s*(\d{2,4})(?:\s*(?:-|–|to|or)\s*(\d{2,4}))?\s*(?:words?|शब्दों?|shabd(?:on)?)(?:\s*(?:में|mein|me))?\s*[)\]]?/i, (_, a, b) => {
            count = Math.min(800, Math.max(30, b ? Math.round((Number(a) + Number(b)) / 2) : Number(a)));
            return ' ';
        });
        const much = /\b(?:in detail|detailed|essay|long answer|elaborate|at length|discuss|विस्तार से)\b|विस्तार/i.test(q);
        const little = /\b(?:in short|in brief|briefly|short note|short answer|one line)\b|संक्षेप/i.test(q);
        q = q.replace(/\b(?:in (?:full |great )?detail|in short|in brief|briefly|at length)\b|विस्तार (?:से|में)|संक्षेप (?:में|से)/gi, ' ').replace(/^(?:write |give )?(?:an? )?(?:detailed |short |long )?(?:essay|note|answer|paragraph) (?:on|about) /i, 'explain ').replace(/\s+/g, ' ').trim().replace(/[?.!।,\s]+$/, '');
        // Words of the examiner, not of the subject.
        q = q.replace(/^(?:critically\s+)?(?:examine|analy[sz]e|evaluate|outline|state|enumerate|illustrate|elaborate(?: on| upon)?|discuss|assess|comment on|highlight|identify|mention|briefly)\s+/i, 'explain ')
            .replace(/,?\s*(?:with|giving|using)\s+(?:the help of\s+)?(?:suitable |relevant |appropriate |real[- ]life |practical |two |three )?(?:examples?|illustrations?|diagrams?)\b/gi, ' ')
            .replace(/\s+(?:(?:with)?in|of|for)\s+(?:an?\s+|the\s+)?(?:(?:large|big|modern|typical|any|business|corporate|large[- ]scale)\s+)+(?:organi[sz]ations?|compan(?:y|ies)|firms?|business(?:es)?|enterprises?)\b/gi, ' ')
            .replace(/\s+in your own words\b/gi, ' ').replace(/\s+/g, ' ').trim().replace(/[?.!।,\s]+$/, '');
        return { q, words: count, much, little };
    }

    function sense(q) {
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
        // "भारत की राजधानी क्या है": one fact about one thing.
        const tathya = /^(.{2,40}?) (?:की|का|के) ([^ ]{2,20}) (?:क्या|कौन|कहाँ|कहां) (?:है|हैं|था|थी|थे)$/u.exec(q);
        if (tathya && !/अर्थ|मतलब|परिभाषा/.test(tathya[2])) return { kind: 'fact', topics: [`${tathya[1]} की ${tathya[2]}`, tathya[1]], q, part: tathya[2] };
        if (hindi && /किसने|किसके द्वारा/.test(q)) return { kind: 'who', topics: [words(q).filter((w) => !STOP.has(w)).join(' ') || q, words(q)[0]], q };
        if (hindi) return { kind: /क्यों/.test(q) ? 'why' : /कब/.test(q) ? 'when' : /कितन/.test(q) ? 'number' : 'define', topics: [words(q).filter((w) => !STOP.has(w)).join(' ') || q], q };
        const most = /^(?:what|who|which)\s+(?:is|are|was|were)\s+the\s+((?:\p{L}+est|most \p{L}+|first|last|only|best|worst)\s+(?:\p{L}+\s){0,2}?\p{L}+)\s+(?:of|in|on|to|from)\s+(?:the\s+)?(.{2,60})$/iu.exec(q);
        if (most && !LISTY.test(q)) return { kind: 'fact', topics: [`${most[1]} in ${most[2]}`, most[2]], q, part: most[1] };
        // "the capital of France": one fact about one thing.
        const fact = /^(?:what|who|which|where)\s+(?:is|are|was|were)\s+the\s+(.{2,40}?)\s+of\s+(?:the\s+)?(.{2,60})$/i.exec(q);
        if (fact && !LISTY.test(q)) return { kind: 'fact', topics: [`${fact[1]} of ${fact[2]}`, fact[2]], q, part: fact[1] };
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
        let area = '';
        let block = -1;
        let run = null;
        for (const raw of page.text.split('\n')) {
            // Wikipedia's plain text leaves empty brackets where a sound or a script was.
            const line = raw.replace(/ ?\([\s;,]*\)/g, '').trim();
            block++;
            const head = /^(={2,6})\s*(.+?)\s*\1$/.exec(line);
            if (head) {
                section = head[2];
                intro = null;
                run = null;
                if (head[1].length === 2) area = section;
                if (head[1].length === 2) skip = SKIP.test(section);
                continue;
            }
            if (skip || !line || /\\displaystyle|\{\\/.test(line)) continue;
            const whole = sentencesOf(line);
            const start = words(line).slice(1, 3).join(' ').toLowerCase();
            if (run && run.start && run.start !== start) run = null;
            if (run && !run.start && whole.length) run.start = start;
            for (const text of whole) if (!/^(?:this is an? (?:\w+ )?list|the following is|below is)\b/i.test(text)) out.push({ text, section, place: out.length, page, item: false, block, area, run });
            if (/:$/.test(line) && words(line).length < 40) {
                intro = line;
                run = { text: line, start: '' };
            } else if (!whole.length && words(line).length >= 1 && words(line).length <= 40 && (intro || section)) {
                out.push({ text: line, section, place: out.length, page, item: true, intro, block, area });
            }
        }
        return out;
    }

    const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    /** True when a sentence says the kind of thing that was asked, about the thing that was asked. */
    function replies(asked, s, about) {
        const text = s.text;
        const mine = new Set(s.terms);
        const title = about.titles.get(s.page);
        const told = (w) => mine.has(w) || title.has(w) || (about.verbs.get(w) || []).some((v) => title.has(v));
        const said = (w) => mine.has(w) || (about.verbs.get(w) || []).some((v) => mine.has(v));
        if (s.item || (s.page.title.match(/\d+/g) || []).some((n) => !asked.q.includes(n))) return false;
        if (asked.kind === 'number') {
            const size = about.size;
            if (size) {
                const value = `(?<![\\d,.])\\d[\\d,.]*(?:\\s?±\\s?[\\d.,]+)?(?:\\s(?:hundred|thousand|million|billion|trillion))?[\\s-]?(?:${size[2]})(?![\\p{L}\\d])`;
                const own = about.rest.length > 0 && about.rest.every((w) => title.has(w)) && [...title].every((w) => about.rest.includes(w));
                if (!(own && s.lead) && !about.rest.every((w) => mine.has(w))) return false;
                if (/^(?:despite|although|unlike|compared|while|to )|\b(?:once|if|will|would|sections?|segments?|believed|thought|argued|estimated? the|i\.e|less than|fraction)\b/i.test(text)) return false;
                const said = new RegExp(`\\b(?:its|the|an?|maximum|average|total|whose)\\s(?:\\p{L}+\\s){0,4}?(?:${size[0]})\\b[^;]{0,120}?${value}|\\b(?:${size[0]})\\s(?:of|is|was|at|around|about)\\s(?:\\p{L}+\\s){0,4}?${value}|${value}\\s?(?:\\([^)]*\\)\\s?)?(?:${size[1]})\\b`, 'iu').exec(text);
                // A camp, a plant or a climber on the mountain has a height too.
                return Boolean(said) && !/\b(?:camps?|stations?|climb\p{L}*|descen\p{L}*|fly|flew|flying|plants?|moss|species|gain|grows?|from)\b/iu.test(said[0]);
            }
            const thing = about.thing;
            if (!thing) return /\d/.test(text) && about.wanted.every(told);
            const list = words(text).map((w) => w.toLowerCase());
            const counted = list.some((w, i) => stem(w) === thing && list.slice(Math.max(0, i - 3), i).some((x) => new RegExp(`^${NUMBER}$`).test(x)));
            const plain = words(asked.q).filter((w) => /^\p{Ll}/u.test(w)).map(stem);
            const lower = new Set([...words(text).filter((w, i) => !i || /^\p{Ll}/u.test(w)).map(stem), ...title]);
            return counted && about.wanted.every((w) => told(w) || w === 'body') && about.wanted.every((w) => !plain.includes(w) || w === 'body' || lower.has(w));
        }
        if (asked.kind === 'when') {
            if (!/\b(?:1\d{3}|20\d{2})\b(?!\s?BCE?)|\d+\s?(?:BCE?|AD|CE)\b|[०-९]{4}|\p{Script=Devanagari}.*\b\d{4}\b/u.test(text)) return false;
            const event = about.wanted.filter((w) => !title.has(w) && !(about.verbs.get(w) || []).some((v) => title.has(v)));
            return event.length ? event.every(said) : !s.section && about.wanted.some((w) => mine.has(w));
        }
        if (asked.kind === 'who') {
            if (/\p{Script=Devanagari}/u.test(asked.q)) return /(?:^| )(?:ने|द्वारा) /u.test(text) && about.wanted.some(told) && /बनवा|करवाया|बनाया|लिख|खोज|आविष्कार|रच|निर्माण|स्थापना/u.test(text);
            const did = /^(?:who|whom)\s+(?:has\s+|had\s+|first\s+)?(\p{L}+)\s+(?:(?:the|an?)\s+)?(.+)$/iu.exec(asked.q);
            if (!did) return false;
            const [verbs, nouns, made] = DEED[did[1].toLowerCase()] || [`${escape(did[1])}`, '(?!)', false];
            const own = [...title].length > 0 && terms(did[2]).every((w) => title.has(w)) && [...title].every((w) => terms(did[2]).includes(w) || (about.verbs.get(stem(did[1])) || []).includes(w));
            // Names keep their capitals, so only the thing itself may differ in case.
            const thing = words(did[2]).map((w) => [...w].map((c) => (c.toLowerCase() === c.toUpperCase() ? escape(c) : `[${c.toLowerCase()}${c.toUpperCase()}]`)).join('')).join('[\\s,-]+');
            const obj = `(?:["“]?${thing}(?!\\s(?:industr|compan|network|system|exchange|service|line|call|number|book|film|series|museum))${own ? '|\\bit|\\bthe (?:tower|book|novel|play|poem|epic|film|painting|portrait|company|work|building|monument|song|game)' : ''})\\b`;
            const name = `(?!${words(did[2])[0] ? escape(words(did[2])[0]) : '-'}\\b)\\p{Lu}[\\p{L}.'’-]+`;
            const is = (pattern) => new RegExp(pattern, 'u').test(text) || new RegExp(pattern, 'u').test(text.charAt(0).toLowerCase() + text.slice(1));
            return is(`${name}[^.;]{0,80}?\\b(?:${verbs})\\s(?:(?:the|an?|his|her|their|first|practical|modern|new|successful|epic)\\s){0,3}${obj}`)
                || is(`${obj}[^.;]{0,120}?\\b(?:${verbs})\\b[^.;]{0,60}?\\bby\\s[^.;]{0,40}?${name}`)
                || is(`${made ? '' : '(?:[Ii]nvention|[Dd]iscovery) of (?:the )?'}${obj}[^.;]{0,120}?\\b(?:credited|attributed|ascribed)\\s[^.;]{0,30}?to\\s[^.;]{0,40}?${name}`)
                || is(`${name}[^.;]{0,80}?\\bcredited with\\b[^.;]{0,50}?${obj}`)
                || (is(`\\b(?:${nouns})["”]?\\s[^.;]{0,20}?of\\s(?:the\\s)?${obj}`) && is(name))
                || (made && own && s.lead && s.place < 3 && is(`\\b(?:${verbs}|${WORK})\\b[^.;]{0,80}?\\bby\\s(?:the\\s)?(?:\\p{Ll}[\\p{L}-]*\\s){0,4}${name}`));
        }
        if (asked.kind === 'fact') {
            if (!about.wanted.every(told) || !terms(asked.part || '').every((w) => mine.has(w))) return false;
            if (QUANTITY.test(asked.part || '') && !/(?<![\p{L}\d])\d[\d,.]*(?:\s\d{3})*\s?(?:km|m|cm|mm|kg|g|mg|ft|mi|miles?|feet|met(?:er|re)s?|kilomet(?:er|re)s?|°|K\b|%|thousand|million|billion|people|inhabitants|residents|sq|square|acres|hectares|years?)(?!\p{L})/u.test(text) && !/\b(?:is|of) \d[\d,.]*/.test(text.replace(/\b(?:1\d{3}|20\d{2})\b/g, ''))) return false;
            // The answer to "the capital of" or "the largest" is a name.
            if (!QUANTITY.test(asked.part || '') && !/\p{Script=Devanagari}/u.test(asked.q) && !/(?<=[\p{L}\d,;”)] )\p{Lu}\p{Ll}+|^\p{Lu}\p{Ll}+/u.test(text)) return false;
            if (/^(?:\p{L}+est|most|first|last|only)\b/iu.test(asked.part || '')) return /\b(?:is|was|are|were|became)\b/i.test(text) && new RegExp(`\\b${words(asked.part).map(escape).join('\\s(?:\\p{L}+\\s)?')}`, 'iu').test(text);
            if (/\p{Script=Devanagari}/u.test(asked.q)) return true;
            if (/^\S+\s(?:is|are)\b/i.test(asked.q) && (!/\b(?:is|are|has been|remains)\b/i.test(text) || /\buntil\b/i.test(text))) return false;
            // "the capital of", "its capital is", not "capital punishment".
            return new RegExp(`\\b${asked.part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b(?:\\s(?:city|and \\p{L}+ city|unit))?(?:\\s(?:of|is|are|has)\\b${s.lead ? '|\\s?[,.;)]|\\s(?:in|was|were)\\b' : ''})`, 'iu').test(text);
        }
        if (asked.kind === 'why') {
            const plain = new Set(words(asked.q).filter((w) => /^\p{Ll}/u.test(w)).map(stem));
            const named = new Set((text.match(/(?<=\p{Lu}\p{Ll}+ )\p{Lu}\p{Ll}+/gu) || []).map(stem));
            const lower = new Set(words(text).filter((w) => /^\p{Ll}/u.test(w)).map(stem));
            if ([...plain].some((w) => about.wanted.includes(w) && named.has(w) && !lower.has(w))) return false;
            const inText = about.wanted.filter((w) => mine.has(w)).length;
            return CAUSE.test(text) && about.wanted.filter(told).length >= Math.ceil(0.75 * about.wanted.length) && inText >= Math.ceil(about.wanted.length / 2) && !/\b(?:simply|partly|named|called|known) (?:because|due)/i.test(text);
        }
        return false;
    }

    /** What replies() needs to know about the question. */
    function aboutOf(asked, wanted, titles) {
        const first = words(asked.q).map((w) => w.toLowerCase()).find((w) => SIZE[w]);
        const sized = asked.kind === 'number' && /^how\b/i.test(asked.q) && !/^how (?:many|much)\b/i.test(asked.q) ? first : null;
        const thing = /^how many\s+((?:[\p{L}-]+\s){0,2}?[\p{L}-]+?)\s+(?:are|is|does|do|did|were|was|have|has|had|can|make|makes|there)\b/iu.exec(asked.q);
        const verbs = new Map(words(asked.q).map((w) => [stem(w), (VERB[w.toLowerCase()] || '').split(' ').filter(Boolean).map(stem)]));
        return { wanted, titles, verbs, size: sized ? SIZE[sized] : null, rest: wanted.filter((w) => w !== sized), thing: thing ? stem(thing[1].split(' ').pop()) : null };
    }

    /** Scores every line against the question: BM25, with bonuses for the section, the place and the kind of answer. */
    function rank(asked, pages) {
        const all = pages.flatMap((p) => read(p));
        // "In which year" names the kind of answer, not the topic.
        const wanted = [...new Set(terms(asked.q))].filter((w) => !(asked.kind === 'when' && /^(?:year|date|day|month|time|centur|becom|becam|happen|occurr?|took|tak|plac|get|got)$/.test(w)));
        const kin = new Set(words(asked.q).flatMap((w) => (KIN[w.toLowerCase()] || '').split(' ')).filter(Boolean).map(stem));
        const seen = new Map();
        for (const s of all) {
            s.terms = terms(s.text);
            for (const w of new Set(s.terms)) seen.set(w, (seen.get(w) || 0) + 1);
        }
        const mean = all.reduce((n, s) => n + s.terms.length, 0) / Math.max(1, all.length);
        const weight = (w) => Math.log(1 + (all.length - (seen.get(w) || 0) + 0.5) / ((seen.get(w) || 0) + 0.5));
        const titles = new Map(pages.map((p) => [p, new Set(terms(p.title))]));
        const about = aboutOf(asked, wanted, titles);
        const known = new Set([...wanted, ...[...about.verbs.values()].flat()]);
        const exact = pages.filter((p) => titles.get(p).size && [...titles.get(p)].every((w) => known.has(w)));
        for (const s of all) {
            const have = new Map();
            for (const w of s.terms) have.set(w, (have.get(w) || 0) + 1);
            const head = new Set(terms(s.section));
            // A word for the thing ("elevation") says more than a unit ("metres").
            const related = [...kin].filter((w) => have.has(w)).reduce((v, w) => v + (/^(?:met(?:er|re)|feet|km|mil|kilomet|year|kg|km\/h|mph)/.test(w) ? 0.4 : 1.4), 0);
            let score = 0;
            s.related = related;
            s.hits = 0;
            s.lead = !s.section;
            s.inHead = wanted.some((w) => (head.has(w) || terms(s.area).includes(w)) && !titles.get(s.page).has(w));
            s.inRun = Boolean(s.run) && asked.kind === 'list' && terms(s.run.text).some((w) => wanted.includes(w) && !titles.get(s.page).has(w));
            // Figures from a survey seldom explain a thing.
            s.dull = ['list', 'define', 'explain', 'compare'].includes(asked.kind) && !/\d/.test(asked.q) && s.place > 0 && /\b(?:surveys?|median|estimated to|per ?cent)\b|\d%|[$€£₹]\s?\d|^In (?:1\d{3}|20\d{2})\b/i.test(s.text);
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
            // In the article on a thing, "its elevation" is about that thing.
            if (related >= 1) score += (2 * Math.min(2.5, related) + (asked.kind === 'number' && /\d/.test(s.text) ? 3 : 0) + (!s.section ? 4 : 0)) * (titles.get(s.page).size && [...titles.get(s.page)].every((w) => wanted.includes(w)) ? 1 : 0.4);
            if (asked.kind === 'why' && /\b(?:because|due to|since|caused?|causes|reasons?|results?|therefore|leads? to|led to)\b/i.test(s.text)) score += 2;
            if (asked.kind === 'who' && /\b(?:invent(?:ed|or|s)|discover(?:ed|er)|patent(?:ed)?|credited|founded|founder|wrote|written by|built by|designed by|first)\b/i.test(s.text) && /(?<=[\p{Ll},] )\p{Lu}\p{Ll}+/u.test(s.text)) score += 2.5;
            if (wanted.length > 1 && s.hits === wanted.length) score += asked.kind === 'fact' ? 5 : 1.5;
            if (asked.kind === 'compare' && !s.lead) score -= 4;
            if (/^(?:this is an? |the following is |below is )/i.test(s.text)) score -= 6;
            const aside = ASIDE.exec(s.area) || ASIDE.exec(s.section);
            s.aside = Boolean(aside) && !new RegExp(aside[0], 'i').test(asked.q);
            // The first sentence on a work names who made it.
            if (asked.kind === 'who' && !s.section && s.place < 3 && /\bby (?:the )?(?:\p{L}+ ){0,3}\p{Lu}/u.test(s.text)) score += 7;
            if (asked.kind === 'list' && (s.inHead || /\b(?:includ(?:e|es|ing)|such as|consists? of|divided into|classified|types|three|four|five|two|several)\b/i.test(s.text))) score += 1.5;
            if (s.inRun) score += 5;
            // "Characteristics of ..." over a section, where characteristics are asked for.
            if (asked.aspect && ASPECT[asked.aspect] && ASPECT[asked.aspect].test(s.section)) score += 3;
            if (s.dull) score -= 4;
            if (asked.course && !s.item) score -= (SIGNPOST.test(s.text) || row(s.text) ? 12 : 0) + (s.place > 0 && leans(s.text) ? 0.5 : 0);
            if (s.item) score -= asked.kind === 'list' && s.inHead ? 0.5 : 6;
            // "This process..." points at a sentence that may not be shown.
            if (/^(?:this|these|those|such|he|she|they|it|however|also|for example|in addition|therefore|thus)\b/i.test(s.text) && s.place > 0) score -= 0.8;
            if (['explain', 'define', 'list'].includes(asked.kind) && CORE.test(s.section)) score += 4;
            s.replies = replies(asked, s, about);
            if (s.replies && exact.length && !exact.includes(s.page) && ['when', 'who', 'number'].includes(asked.kind)) s.replies = Boolean(about.size || about.thing);
            if (s.replies) score += 9 + (s.lead ? 4 : 0) + (asked.kind === 'why' ? 4 : 0);
            s.score = score * [1.3, 1, 0.85][Math.min(2, s.page.order)];
        }
        return { all, wanted, why: asked.kind === 'why', list: asked.kind === 'list' };
    }

    const length = (s) => words(s.text).length;
    // Sentences of a textbook that only show the way.
    const SIGNPOST = /\b(?:we (?:now )?turn (?:now )?to|we turn now|we now\b|in this (?:chapter|section|module|unit|lesson|text|book|article)|as (?:we(?: will|['’]ll| shall)|you(?: will|['’]ll)) see|as (?:discussed|mentioned|noted|described|seen|explained|we saw|we have seen) (?:earlier|above|before|previously|in)|learning (?:objectives?|outcomes?)|(?:figure|exhibit|table|chapter) \d+|see (?:chapter|section|figure|table|exhibit)|(?:next|previous|last|preceding) (?:section|chapter|module)|later in (?:this|the) (?:chapter|section|book)|(?:this|the) (?:chapter|section|module|unit) (?:will|is|covers|looks|discusses|examines|explores|begins|presents|describes|explains)|(?:shown|listed|described|discussed|explained|given|summari[sz]ed|presented|illustrated|outlined|see) (?:below|above|in (?:figure|table|exhibit))|the following (?:section|paragraph|chapter|discussion|are|is|list|table|pages?|example)|let['’]?s (?:look|turn|consider|examine|explore)|let us (?:look|turn|consider|examine|explore)|we (?:will|shall) (?:look|discuss|examine|explore|consider|turn|learn|focus|see|describe|review)|you will (?:learn|read|see|explore|be able))\b/i;
    const LINKS = /^(?:this|these|that|those|such|thus|however|therefore|unlike|also|it|they|he|she|his|her|its|their|hence|because of this|as a result|in contrast|on the other hand|similarly|moreover|furthermore|in addition|additionally|for example|for instance|instead|then|consequently|conversely|but|and|so|yet|another|both of these|finally|second(?!-)|third(?!-))\b/i;
    const BACK = /\b(?:this|these|such)\s+(?!(?:as|is|are|was|were|an?|that|can|may|will|means?|has|have|would|could|should|includes?|requires?)\b)[a-z]+/i;
    /** True when a sentence leans on the one before it: a linking word, or "this approach" in its first words. A line with its own label does not. */
    const leans = (text) => !/^[^.:–—]{3,70}?\s*(?:\s[-–—]\s|:\s)/.test(text) && (LINKS.test(text) || BACK.test(text.split(/,/)[0].split(/\s+/).slice(0, 9).join(' ')));
    /** Mostly a row of names or fields, such as "public administration, finance, calculus, information". */
    const row = (text) => {
        const bits = text.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
        return bits.length > 5 && bits.filter((x) => words(x).length < 4).length / bits.length > 0.75 && !/\b(?:such as|includ(?:e|es|ing)|are|consists? of|namely)\b/i.test(text) ;
    };
    const jaccard = (a, b) => {
        const [x, y] = [new Set(terms(a)), new Set(terms(b))];
        const both = [...x].filter((w) => y.has(w)).length;
        return both / Math.max(1, x.size + y.size - both);
    };

    /**
     * The last look at an answer on the course: no sentence twice, none that shows the way, and none that leans on a sentence that is
     * not shown. What leans brings the sentence before it along, when that one stands by itself; otherwise it goes.
     */
    function clean(parts, pool = [], size = 0, about = '') {
        const kept = [];
        const lines = new Map();
        const before = (s) => {
            if (!lines.has(s.page)) lines.set(s.page, read({ ...s.page, order: 0 }));
            const list = lines.get(s.page);
            const k = list.findIndex((x) => x.text === s.text && x.place === s.place);
            const at = k < 0 ? list.findIndex((x) => x.text === s.text) : k;
            return at > 0 && list[at - 1].block === list[at].block ? list[at - 1] : null;
        };
        const again = (text) => kept.some((x) => jaccard(x, text) >= 0.6);
        const out = [];
        for (const part of parts) {
            const chosen = [];
            for (const s of part.chosen) {
                if (SIGNPOST.test(s.text) || row(s.text) || again(s.text)) continue;
                if (!s.item && leans(s.text)) {
                    // What it leans on, one or two sentences back.
                    const chain = [];
                    let x = s;
                    let ok = false;
                    for (let n = 0; n < 2; n++) {
                        x = before(x);
                        if (!x || SIGNPOST.test(x.text) || length(x) > 60) break;
                        const last = chosen[chosen.length - 1];
                        if (last && last.text === x.text) { ok = true; break; }
                        if (again(x.text)) break;
                        x = { ...x, page: s.page, section: s.section };
                        chain.unshift(x);
                        if (!leans(x.text)) { ok = true; break; }
                    }
                    if (!ok) {
                        // It leans on a sentence that is shown elsewhere: then it belongs there.
                        const prior = before(s);
                        const home = prior && [...out.map((p) => p.chosen), chosen].find((list) => list.some((y) => y.text === prior.text));
                        if (!home) continue;
                        const k = home.findIndex((y) => y.text === prior.text);
                        if (home[k + 1] && leans(home[k + 1].text)) continue;
                        home.splice(k + 1, 0, { ...s, section: home[k].section });
                        kept.push(s.text);
                        continue;
                    }
                    for (const y of chain) {
                        chosen.push(y);
                        kept.push(y.text);
                    }
                }
                chosen.push(s);
                kept.push(s.text);
            }
            if (chosen.length || part.note || !part.chosen.length) out.push({ ...part, chosen, words: chosen.reduce((n, x) => n + length(x), 0) });
            // A heading that loses all its sentences gives its place to the next part of the same heading.
            else if (part.head) out.push({ ...part, chosen, words: 0 });
        }
        for (const p of out) p.words = p.chosen.reduce((n, x) => n + length(x), 0);
        // What went leaves room for the next best sentences that stand by themselves.
        let total = out.reduce((n, p) => n + p.words, 0);
        const core = about ? [...new Set(terms(about))] : [];
        const was = parts.reduce((n, p) => n + p.words, 0);
        const room = Math.min(size, was);
        const fill = total < 0.95 * room && core.length ? pool.filter((x) => !x.item && !x.aside && !x.dull && length(x) >= 8 && length(x) <= 45 && !leans(x.text) && !SIGNPOST.test(x.text) && !row(x.text) && !/\?/.test(x.text) && core.every((w) => x.terms.includes(w) || terms(x.page.title).includes(w))).sort((x, y) => y.score - x.score).slice(0, 12) : [];
        const floor = Math.min(...parts.flatMap((p) => p.chosen.map((x) => (x.score === undefined ? Infinity : x.score))));
        for (const x of fill) {
            if (total >= room) break;
            if (again(x.text) || x.score < floor || total + length(x) > room * 1.05) continue;
            const at = out.filter((p) => p.head !== 'Conclusion' && p.chosen.length);
            const home = at.find((p) => p.chosen.some((y) => y.page.url === x.page.url && y.block === x.block)) || at.find((p) => p.chosen.some((y) => y.page.url === x.page.url)) || at[at.length - 1];
            if (!home) break;
            const k = home.chosen.findIndex((y) => y.page.url === x.page.url && y.place > x.place);
            // It does not come between a sentence and the one that leans on it.
            if (k > 0 && leans(home.chosen[k].text)) home.chosen.push({ ...x, section: home.chosen[0].section });
            else if (k >= 0) home.chosen.splice(k, 0, { ...x, section: home.chosen[k].section });
            else home.chosen.push({ ...x, section: home.chosen[home.chosen.length - 1].section });
            home.words += length(x);
            total += length(x);
            kept.push(x.text);
        }
        // Empty headings go, unless sub-headings with sentences follow.
        return out.filter((p, i) => p.chosen.length || p.note || (p.head && out[i + 1] && !out[i + 1].head && out[i + 1].chosen.length)).map((p) => (p.chosen.length || p.note ? p : { ...p, sub: '' }));
    }
    const alike = (a, b) => {
        const mine = new Set(a.terms);
        return [...new Set(b.terms)].filter((w) => mine.has(w)).length / Math.max(1, Math.min(mine.size, new Set(b.terms).size));
    };

    /**
     * Builds an answer of about so many words. Whole stretches of a paragraph are taken, so that one sentence leads to the next:
     * first the sentences that answer best, then the opening of the main article, then more from the sections that fit.
     */
    function choose(ranked, target) {
        const groups = new Map();
        for (const s of ranked.all) {
            const key = `${s.page.url}|${s.section}|${s.item ? 'list' : s.block}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(s);
        }
        const need = Math.min(2, ranked.wanted.length);
        const passages = [...groups.values()].map((list) => {
            const top = list.reduce((x, y) => (y.score > x.score ? y : x));
            const rest = list.filter((x) => x !== top).map((x) => x.score).sort((x, y) => y - x).slice(0, 2);
            const said = new Set(list.flatMap((x) => [...x.terms, ...terms(x.section), ...terms(x.page.title)]));
            const hits = ranked.wanted.filter((w) => said.has(w)).length;
            const lead = !list[0].section;
            return { list, top, lead, run: list.some((x) => x.inRun), good: (hits >= need || lead || list[0].inHead || list.some((x) => x.related >= 1)) && !list[0].aside, score: top.score + 0.25 * rest.reduce((n, x) => n + x, 0) + (lead ? 1 : 0) + (list[0].inHead ? 2 : 0) };
        }).filter((x) => x.good && x.top.score > 0).sort((x, y) => y.score - x.score);
        // For a reason, only articles that give one.
        if (ranked.all.some((x) => x.replies) && ranked.why) passages.splice(0, passages.length, ...passages.filter((p) => ranked.all.some((x) => x.replies && x.page === p.list[0].page)));
        if (!passages.length) return { chosen: [], cover: 0, wanted: ranked.wanted.length, words: 0 };

        const main = passages[0].list[0].page;
        const chosen = [];
        let total = 0;
        const add = (s) => {
            if (chosen.includes(s) || (s.dull && target > 90) || total + length(s) > target * (target < 120 ? 1.12 : 1.05) + (total ? 0 : 60)) return false;
            if (!s.item && chosen.some((c) => !c.item && !(c.page === s.page && c.block === s.block) && alike(c, s) > 0.75)) return false;
            chosen.push(s);
            total += length(s);
            return true;
        };
        /** Takes the best sentence of a passage and grows to its neighbours, up to a share of the answer. */
        const take = (p, share) => {
            const limit = Math.max(40, target * share);
            let here = 0;
            if (p.list[0].item) {
                for (const s of p.list) if (here < limit && add(s)) here += length(s);
                return here;
            }
            let i = p.lead || p.run ? 0 : p.list.indexOf(p.top);
            // A sentence that leans on the one before it brings that one along.
            while (!p.lead && i > 0 && /^(?:this|these|those|such|he|she|they|it|its|their|however|also|for example|in addition|therefore|thus|but|and|another|other)\b/i.test(p.list[i].text) && p.list.indexOf(p.top) - i < 2) i--;
            const from = i;
            for (; i < p.list.length && here < limit; i++) {
                // Stop where the paragraph moves off the question.
                if (i > from && ranked.list && !p.run && p.list[i].score < 0.35 * p.top.score && i > p.list.indexOf(p.top)) break;
                if (add(p.list[i])) here += length(p.list[i]);
            }
            return here;
        };

        const opening = passages.find((p) => p.lead && p.list[0].page === main && p.list[0].place === 0);
        const direct = passages[0];
        if (target <= 90 && !ranked.list) {
            // A short answer is only the sentences that answer.
            const answers = ranked.all.filter((x) => x.replies).sort((x, y) => y.score - x.score);
            for (const s of answers.slice(0, 4)) {
                if (total >= target * 0.6 || s.score < 0.6 * answers[0].score) break;
                // "Its height was..." needs the sentence that says what "it" is.
                const lead = ranked.all.find((x) => x.page === s.page && x.place === 0);
                if (!total && lead && lead !== s && /^(?:its?|the|he|she|they|this|on|in)\b/i.test(s.text) && length(lead) + length(s) <= target * 1.12 + 30) add(lead);
                add(s);
            }
            if (!answers.length) for (const s of passages.slice(0, 6).flatMap((p) => p.list).filter((x) => !x.item || x.inHead).sort((x, y) => y.score - x.score)) {
                if (total >= target * 0.75) break;
                if ((s.hits >= need || s.related >= 1) && s.score > 2) add(s);
            }
        } else {
            const runs = passages.filter((p) => p.run).sort((x, y) => x.list[0].place - y.list[0].place);
            if (opening && (opening === direct || target >= 120)) take(opening, runs.length ? 0.2 : 0.35);
            for (const p of runs) take(p, 0.6 / runs.length);
            if (direct !== opening) take(direct, 0.35);
            const perSection = new Map();
            for (const p of passages) {
                if (total >= target * 0.9) break;
                if (p === opening || p === direct || p.run) continue;
                // With a section on the very thing, the rest of the opening only wanders.
                if (ranked.list && p.lead && (runs.length || passages.some((x) => x.list[0].inHead && x.list[0].page === main))) continue;
                // Other articles only when they answer nearly as well as the main one.
                if (p.list[0].page !== main && p.score < 0.75 * direct.score) continue;
                const key = p.list[0].page.url + p.list[0].section;
                if ((perSection.get(key) || 0) > target * 0.45) continue;
                perSection.set(key, (perSection.get(key) || 0) + take(p, 0.25));
            }
            // Still short: the rest of the opening of the main article tells more about the topic.
            for (const s of ranked.all) {
                if (total >= target * 0.9) break;
                if (s.page === main && !s.item && (ranked.list ? s.inHead && s.score > 0 && !/^(?:however|this|these|those|it|they)\b/i.test(s.text) : !s.section)) add(s);
            }
        }
        // Better the nearest thing, marked as not sure, than nothing.
        if (!chosen.length) add(passages[0].top);
        chosen.sort((x, y) => (y.page === main) - (x.page === main) || x.page.order - y.page.order || x.place - y.place);
        const said = new Set(chosen.flatMap((s) => [...s.terms, ...terms(s.page.title), ...terms(s.section)]));
        return { chosen, cover: ranked.wanted.length ? ranked.wanted.filter((w) => said.has(w)).length / ranked.wanted.length : 0, wanted: ranked.wanted.length, words: total };
    }

    /** True when the chosen sentences hold the kind of thing that was asked for. */
    function sure(asked, got) {
        if (/\b(?:my|mine|our|ours|your|today|tomorrow|yesterday)\b/i.test(asked.q)) return false;
        // Where the reader has read the sentences, it has to think one of them likely.
        const read = got.chosen.some((s) => s.judged !== undefined);
        if (['why', 'when', 'number', 'who', 'fact'].includes(asked.kind)) return got.chosen.some((s) => s.replies && (!read || s.judged > (asked.kind === 'why' ? 0.15 : 0.5)));
        if (got.cover < 0.6 || (read && Math.max(...got.chosen.map((s) => s.judged || 0)) < 0.05)) return false;
        if (asked.kind === 'define' && !/\p{Script=Devanagari}/u.test(asked.q)) {
            const topic = terms(asked.topics[0]);
            return topic.length === 0 || got.chosen.some((s) => topic.every((w) => terms(s.page.title).includes(w) || (s.lead && s.terms.includes(w))));
        }
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
            // For a reason, Wikipedia's own search on the whole question knows best: the answer is seldom under the question's words.
            const points = asked.kind === 'compare' || asked.kind === 'why' || asked.kind === 'fact' ? 1 / (i + 1) - 0.4 * k + 0.3 * fit(x.title, wanted) : fit(x.title, wanted) + 0.5 / (i + 1) - 0.1 * k - (/^(?:list|index|outline|glossary|timeline) of\b/i.test(x.title) && asked.kind !== 'number' ? 0.4 : 0);
            const old = table.get(x.pageid);
            // Found by two searches is a little better than by one.
            table.set(x.pageid, { pageid: x.pageid, title: x.title, points: old ? Math.max(old.points, points + 0.12) : points });
        }));
        const sorted = [...table.values()].sort((x, y) => y.points - x.points);
        return asked.kind === 'compare' ? sorted : sorted.filter((x) => x.points > sorted[0].points - (asked.kind === 'why' || asked.kind === 'fact' ? 0.8 : 0.45));
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

    // Subjects that textbooks treat item by item: [question, topic, items, about the whole list].
    // An item is [name, words that go with it, the article on it, other names of one word, what else is known of it]:
    //   aliases: other names; keywords: what a good answer speaks of; blocked: phrases that only look alike.
    // About the list: related topics; facet_blocked: phrases of another facet of the same topic, by facet; blocked: for all its items;
    // claims: the items are claims about one thing, not a list to go through.
    const ITEMS = [
        [/\b(?:levels? of management|management levels?|managerial levels?|levels? of managers)\b/i, 'management', [
            ['Top management', 'top senior executive managers CEO board strategic', 'Senior management', 'executive', { aliases: ['top-level management', 'top managers', 'senior management', 'executive management', 'executive managers', 'upper management', 'executives'], keywords: ['board', 'CEO', 'chief executive', 'strategy', 'strategic', 'policy', 'policies', 'long-term', 'long-range', 'objectives', 'goals'], blocked: ['line and staff'] }],
            ['Middle management', 'middle managers division department tactical', 'Middle management', '', { aliases: ['middle-level management', 'middle managers', 'middle-level managers', 'intermediary management'], keywords: ['department', 'division', 'branch', 'tactical', 'implement', 'coordinate', 'link', 'plans'], blocked: ['line and staff', 'unlike line management'] }],
            ['First-line management', 'first-line supervisory lower operational front-line supervisors', 'Supervisor', 'supervisor supervisors supervisory', { aliases: ['first-line managers', 'first-level management', 'supervisory management', 'supervisory managers', 'lower-level management', 'lower management', 'operational management', 'front-line managers', 'supervisors', 'foremen'], keywords: ['supervise', 'supervisor', 'day-to-day', 'daily', 'workers', 'operations', 'nonmanagerial', 'foreman', 'operational'], blocked: ['line and staff', 'line authority', 'line management', 'line[ -]managers?', 'line of command', 'line position'] }],
        ], { ask: 'What are the functions of {item}?', related: ['managerial skills', 'functions of management'], blocked: ['management by objectives', 'MBO'], facet_blocked: {} }],
        [/\b(?:functions? of management|management functions?|managerial functions?|process of management|management process)\b/i, 'management', [
            ['Planning', 'planning plans goals objectives', '', '', { aliases: ['plan', 'plans'], keywords: ['goals', 'objectives', 'future', 'decide in advance', 'course of action', 'forecast'], blocked: ['financial planning', 'planning commission', 'urban planning'] }],
            ['Organizing', 'organizing structure departments resources', '', '', { aliases: ['organising', 'organization of work'], keywords: ['structure', 'resources', 'authority', 'departments', 'tasks', 'division of work'], blocked: ['community organi[sz]', 'labor organi[sz]', 'union organi[sz]'] }],
            ['Leading', 'leading motivating guiding leadership', '', 'leadership', { aliases: ['directing', 'leadership', 'direction'], keywords: ['motivat', 'communicat', 'guid', 'influence', 'supervis', 'inspire'], blocked: ['leading (?:company|companies|brand|cause|producer|firms?)'] }],
            ['Controlling', 'controlling control standards performance', '', '', { aliases: ['control'], keywords: ['standards', 'measure', 'compare', 'deviation', 'corrective', 'performance', 'feedback'], blocked: ['birth control', 'price control', 'rent control', 'quality control', 'statistical'] }],
        ], { related: ['levels of management', 'managerial roles', 'managerial skills'], facet_blocked: { functions: ['fourteen principles', '14 principles'] } }],
        [/\b(?:extended marketing mix|7 ?ps|seven ps|services? marketing mix)\b/i, 'the services marketing mix', [
            ['Product', 'product service offering', '', '', { keywords: ['service', 'offering', 'quality', 'brand'] }], ['Price', 'pricing price', '', 'pricing', { aliases: ['pricing'], keywords: ['cost', 'charge', 'value'] }], ['Place', 'distribution place delivery', '', 'distribution', { aliases: ['distribution'], keywords: ['channel', 'location', 'access'] }], ['Promotion', 'promotion communication', '', '', { keywords: ['advertising', 'communication', 'sales promotion'] }],
            ['People', 'people employees staff', '', 'employees', { aliases: ['employees', 'personnel', 'participants'], keywords: ['employees', 'customers', 'training', 'interaction'] }], ['Process', 'process procedures delivery', '', '', { keywords: ['procedures', 'flow', 'steps', 'delivery'] }], ['Physical evidence', 'physical evidence environment tangible', '', '', { keywords: ['tangible', 'environment', 'facilities', 'appearance'] }],
        ], { articles: ['Services marketing', 'Marketing mix'], related: ['marketing mix', 'services marketing'], facet_blocked: {} }],
        [/\b(?:marketing mix|four ps|4 ?ps)\b/i, 'the marketing mix', [
            ['Product', 'product strategy', '', '', { keywords: ['goods', 'services', 'quality', 'brand', 'packaging', 'design', 'need'], blocked: ['gross domestic product'] }], ['Price', 'pricing strategy', '', 'pricing', { aliases: ['pricing'], keywords: ['cost', 'demand', 'value', 'money', 'discount'] }], ['Place', 'distribution place strategy', '', 'distribution', { aliases: ['distribution'], keywords: ['channel', 'retail', 'wholesale', 'location', 'transport'], blocked: ['income distribution', 'frequency distribution'] }], ['Promotion', 'promotion strategy', '', '', { keywords: ['advertising', 'personal selling', 'sales promotion', 'public relations', 'communicat'] }],
        ], { article: 'Marketing mix', related: ['7Ps of marketing', 'product life cycle', 'promotion mix'], facet_blocked: {} }],
        [/\bfactors of production\b/i, 'the factors of production', [['Natural resources', 'land natural resources', '', '', { aliases: ['land'], keywords: ['land', 'water', 'minerals', 'forests', 'rent'] }], ['Labor', 'labor human', '', '', { aliases: ['labour', 'human resources'], keywords: ['workers', 'effort', 'wages', 'physical', 'mental'], blocked: ['labor union', 'labor market'] }], ['Capital', 'capital tools machinery', '', '', { keywords: ['machinery', 'tools', 'equipment', 'buildings', 'interest'], blocked: ['venture capital', 'capital city', 'human capital'] }], ['Entrepreneurship', 'entrepreneurship entrepreneurs', 'Entrepreneurship', 'entrepreneur entrepreneurs entrepreneurial', { aliases: ['enterprise', 'organisation'], keywords: ['risk', 'profit', 'combine', 'innovation'] }], ['Knowledge', 'knowledge', '', '', { keywords: ['skills', 'information', 'talents'] }]], { article: 'Factors of production', related: ['national income', 'theory of rent'], facet_blocked: {} }],
        [/\b(?:forms?|types?|kinds?) of (?:business (?:ownership|organi[sz]ations?|structures?|entit(?:y|ies))|compan(?:y|ies))\b/i, 'business ownership', [['Sole proprietorship', 'sole proprietorship owner', 'Sole proprietorship', '', { aliases: ['sole trader', 'sole trading concern'], keywords: ['one person', 'unlimited liability', 'owner', 'profit'] }], ['Partnership', 'partnership partners', 'Partnership', '', { keywords: ['two or more', 'partners', 'agreement', 'profit', 'liability'] }], ['Corporation', 'corporation stockholders', 'Corporation', '', { aliases: ['joint stock company', 'company'], keywords: ['legal entity', 'shares', 'limited liability', 'stockholders', 'board'] }], ['Limited liability company', 'limited liability company LLC', 'Limited liability company', 'LLC LLCs', { aliases: ['LLC'], keywords: ['limited liability', 'members', 'taxed'] }]], { related: ['partnership deed', 'company'], facet_blocked: {} }],
        [/\bproduct life[- ]?cycle\b/i, 'the product life cycle', [['Introduction stage', 'introduction stage product', '', 'introductory', { aliases: ['introductory stage', 'introduction phase'], keywords: ['launch', 'low sales', 'awareness', 'promotion', 'losses'] }], ['Growth stage', 'growth stage product', '', '', { aliases: ['growth phase'], keywords: ['rapid', 'sales', 'profits', 'competitors'], blocked: ['economic growth', 'population growth'] }], ['Maturity stage', 'maturity stage product', '', '', { aliases: ['maturity phase', 'saturation'], keywords: ['peak', 'level off', 'competition', 'longest', 'saturat'] }], ['Decline stage', 'decline stage product', '', '', { aliases: ['decline phase'], keywords: ['fall', 'drop', 'withdraw', 'discontinue', 'obsolete'] }]], { ask: 'What happens to sales in the {item} of the product life cycle?', article: 'Product life-cycle management (marketing)', related: ['new product development', 'marketing mix', 'BCG matrix'], blocked: ['life-cycle assessment', 'environmental impact', 'industry life ?cycle', 'organi[sz]ational life ?cycle'], facet_blocked: {} }],
        [/\b(?:leadership styles?|styles? of leadership|types? of leaders(?:hip)?)\b/i, 'leadership', [['Autocratic leadership', 'autocratic leaders', '', '', { aliases: ['authoritarian leadership', 'autocratic leader', 'directive'], keywords: ['alone', 'orders', 'obedience', 'decisions', 'centralized'] }], ['Participative leadership', 'participative democratic consensual leaders', '', '', { aliases: ['democratic leadership', 'consultative leadership', 'consensual leadership'], keywords: ['share', 'involve', 'discuss', 'vote', 'decision'] }], ['Free-rein leadership', 'free-rein laissez-faire leaders', '', 'laissez', { aliases: ['laissez-faire leadership', 'delegative leadership'], keywords: ['freedom', 'authority', 'own decisions', 'hands-off'] }]], { related: ['theories of leadership', 'motivation', 'managerial grid'], facet_blocked: {} }],
        [/\b(?:economic systems?|types? of econom(?:y|ies))\b/i, 'economic systems', [['Capitalism', 'capitalism free market', '', '', { aliases: ['free market', 'private enterprise'], keywords: ['private', 'profit', 'competition', 'ownership'] }], ['Communism', 'communism government', '', '', { keywords: ['government', 'owns', 'classless'] }], ['Socialism', 'socialism', '', '', { keywords: ['government', 'state', 'basic industries', 'welfare'] }], ['Mixed economy', 'mixed economies', '', '', { aliases: ['mixed economies'], keywords: ['both', 'private', 'government', 'combine'] }]], { related: ['business environment', 'privatisation'], facet_blocked: {} }],
        [/\b(?:managerial skills?|skills? of (?:a )?managers?|management skills?)\b/i, 'managerial skills', [['Technical skills', 'technical skills', '', '', { keywords: ['specialized', 'knowledge', 'techniques', 'tools', 'first-line'] }], ['Human relations skills', 'human relations skills', '', '', { aliases: ['human skills', 'interpersonal skills', 'people skills'], keywords: ['people', 'communicat', 'motivat', 'teams'] }], ['Conceptual skills', 'conceptual skills', '', '', { keywords: ['whole', 'abstract', 'relationships', 'top managers', 'view the organization'] }]], { related: ['levels of management', 'managerial roles'], facet_blocked: {} }],
        [/\b(?:managerial roles?|roles of (?:a )?managers?|mintzberg)\b/i, 'managerial roles', [['Interpersonal roles', 'interpersonal roles figurehead leader liaison', '', '', { aliases: ['figurehead', 'leader', 'liaison'], keywords: ['figurehead', 'leader', 'liaison', 'relationships'] }], ['Informational roles', 'informational roles monitor spokesperson', '', '', { aliases: ['monitor', 'disseminator', 'spokesperson'], keywords: ['monitor', 'disseminator', 'spokesperson', 'information'] }], ['Decisional roles', 'decisional roles entrepreneur negotiator', '', '', { aliases: ['entrepreneur', 'disturbance handler', 'resource allocator', 'negotiator'], keywords: ['entrepreneur', 'disturbance', 'resource', 'negotiator', 'decisions'] }]], { related: ['managerial skills', 'functions of management'], facet_blocked: {} }],
        [/\b(?:market structures?|types? of (?:markets?|competition))\b/i, 'competition', [['Perfect competition', 'perfect pure competition', '', '', { aliases: ['pure competition'], keywords: ['many', 'identical', 'homogeneous', 'price taker', 'free entry'] }], ['Monopolistic competition', 'monopolistic competition', '', '', { keywords: ['differentiated', 'many', 'substitutes', 'brand'] }], ['Oligopoly', 'oligopoly', '', '', { keywords: ['few', 'interdependen', 'barriers', 'collusion'] }], ['Monopoly', 'pure monopoly', '', '', { aliases: ['pure monopoly'], keywords: ['single', 'one firm', 'no close substitutes', 'barriers', 'price maker'], blocked: ['monopolistic competition', 'board game'] }]], { related: ['price determination', 'price discrimination'], facet_blocked: {} }],
        [/\b(?:maslow|hierarchy of needs)\b/i, "Maslow's hierarchy of needs", [['Physiological needs', 'physiological needs food shelter', '', '', { aliases: ['basic needs', 'survival needs'], keywords: ['food', 'water', 'shelter', 'sleep', 'air', 'clothing'] }], ['Safety needs', 'safety needs', '', '', { aliases: ['security needs'], keywords: ['security', 'protection', 'stability', 'job security', 'health'] }], ['Social needs', 'social needs belonging', '', '', { aliases: ['love and belonging', 'belongingness needs', 'belonging needs', 'affiliation needs'], keywords: ['love', 'belong', 'friend', 'affection', 'group', 'acceptance'] }], ['Esteem needs', 'esteem needs', '', '', { aliases: ['ego needs'], keywords: ['respect', 'recognition', 'status', 'self-respect', 'achievement'] }], ['Self-actualization needs', 'self-actualization needs', '', '', { aliases: ['self-actualisation', 'self-fulfilment'], keywords: ['potential', 'fulfil', 'growth', 'creativ', 'become'] }]], { ask: 'What do {item} include?', article: "Maslow's hierarchy of needs", related: ["Herzberg's two factor theory", 'Theory X and Theory Y', 'motivation'], blocked: ['two-factor', 'hygiene factors?', 'ERG theory'], facet_blocked: {} }],
        [/\bfayol\b.*\bprinciples?\b|\bprinciples?\b.*\bfayol\b|\b(?:14|fourteen) principles of management\b/i, "Fayol's principles of management", [
            ['Division of work', 'division work specialization', '', '', { aliases: ['division of labor', 'division of labour', 'specialization', 'specialisation'], keywords: ['specializ', 'efficiency', 'output'] }], ['Authority and responsibility', 'authority responsibility orders', '', '', { aliases: ['authority', 'parity of authority and responsibility'], keywords: ['right to give orders', 'responsibility', 'obedience'] }], ['Discipline', 'discipline obedience rules', '', '', { keywords: ['obey', 'respect', 'rules', 'agreements'] }], ['Unity of command', 'unity command one superior', 'Unity of command', '', { keywords: ['one superior', 'one boss', 'one manager', 'orders'] }], ['Unity of direction', 'unity direction one plan', '', '', { keywords: ['one plan', 'one head', 'same objective'] }],
            ['Subordination of individual interest to general interest', 'subordination individual interest general', '', '', { aliases: ['subordination of individual interests', 'general interest'], keywords: ['organization as a whole', 'interests'] }], ['Remuneration', 'remuneration pay wages fair', '', '', { aliases: ['remuneration of personnel', 'fair pay'], keywords: ['fair', 'wage', 'pay', 'satisf'] }], ['Centralization and decentralization', 'centralization decentralization', '', '', { aliases: ['centralization', 'centralisation', 'decentralization'], keywords: ['degree', 'subordinates', 'decision'] }], ['Scalar chain', 'scalar chain line authority', '', '', { aliases: ['line of authority', 'chain of command', 'gang plank', 'gangplank'], keywords: ['top', 'lowest', 'hierarchy', 'line of authority'] }], ['Order', 'order place people materials', '', '', { aliases: ['material order', 'social order'], keywords: ['right place', 'right time', 'place for everything', 'materials'] }],
            ['Equity', 'equity kindness justice fair', '', '', { keywords: ['kind', 'fair', 'justice', 'equal'], blocked: ['equity theory', 'equity shares?', "owners?['’]? equity", 'brand equity', 'private equity', 'equity financ'] }], ['Stability of tenure of personnel', 'stability tenure personnel turnover', '', '', { aliases: ['stability of tenure', 'stability of personnel', 'stability of staff'], keywords: ['turnover', 'tenure', 'job security'] }], ['Initiative', 'initiative', '', '', { keywords: ['encourage', 'freedom', 'plan', 'carry out', 'act on their own'] }], ['Esprit de corps', 'esprit corps team spirit harmony', '', '', { aliases: ['team spirit', 'union is strength'], keywords: ['harmony', 'unity', 'team', 'morale'] }],
        ], { articles: ['Henri Fayol', 'Fayolism'], related: ["Fayol's functions of management", "Taylor's scientific management", 'unity of command'], facet_blocked: { principles: ['five functions', 'five elements', 'six functions', 'to forecast and plan', 'planning, organi[sz]ing, (?:commanding|leading|staffing)', 'command(?:ing)?, coordinat', 'functions of management', 'primary functions', 'plan, organi[sz]e', 'technical, commercial'] }, blocked: ['scientific management', 'time study', 'time and motion', 'piece[- ]rate'] }],
        [/\b(?:taylor\b.*\bprinciples?|principles? of scientific management|scientific management principles)\b|\bprinciples?\b.*\btaylor\b/i, 'scientific management', [
            ['Science, not rule of thumb', 'science rule of thumb method study', 'Scientific management', 'science thumb', { aliases: ['scientific method', 'one best way'], keywords: ['rule of thumb', 'one best way', 'study', 'standard', 'time'] }], ['Scientific selection and training of workers', 'selection training workers scientific', 'Scientific management', 'select selection train training', { aliases: ['select and train'], keywords: ['select', 'train', 'teach', 'develop', 'first-class'] }], ['Cooperation between management and workers', 'cooperation cooperate workers management harmony', 'Scientific management', 'cooperate cooperation', { aliases: ['harmony, not discord', 'mental revolution'], keywords: ['cooperat', 'harmony', 'friendly', 'conflict'] }], ['Division of work and responsibility', 'division work responsibility managers workers', 'Scientific management', 'divide division responsibility', { aliases: ['equal division of work'], keywords: ['equal', 'responsibility', 'planning', 'managers', 'workers'] }],
        ], { article: 'Scientific management', related: ["Fayol's 14 principles of management", 'management science'], facet_blocked: { principles: ['fourteen principles', '14 principles', 'fayol'] }, blocked: ['fayol', 'operations research'] }],
        [/\bnature of management\b.*\b(?:science|art|profession)\b|\bmanagement as (?:an? )?(?:both |as )?(?:science|art|profession)\b|\bmanagement is (?:both )?(?:an? )?(?:science|art|profession)\b/i, 'management', [
            ['Management as a science', 'science systematic knowledge principles', '', 'science scientific', { aliases: ['a science', 'science of management'], keywords: ['systematic body of knowledge', 'body of knowledge', 'cause and effect', 'principles', 'experiment', 'universal application', 'observation', 'theory', 'theories'], blocked: ['management science', 'operations research', 'mathematic', 'optimi[sz]ation', 'linear programming', 'numerical', 'algorithm', 'calculus', 'quantitative'] }],
            ['Management as an art', 'art practice skill creativity', '', 'art', { aliases: ['an art', 'art of management', 'art of getting things done'], keywords: ['personal skill', 'skill', 'practice', 'creativ', 'application of knowledge', 'result', 'judgment', 'intuition', 'experience'], blocked: ['art museum', 'works? of art', 'liberal arts', 'state of the art', 'artist'] }],
            ['Management as a profession', 'profession professional training code', '', 'profession professional', { aliases: ['a profession', 'professional management'], keywords: ['specialized knowledge', 'specialised knowledge', 'formal training', 'formal education', 'code of conduct', 'code of ethics', 'professional body', 'association', 'service motive', 'service'], blocked: ['professional sports?', 'professional services firm'] }],
        ], { claims: true, articles: ['Management'], related: ['functions of management', 'scientific management', 'management science'], blocked: ['management science', 'operations research', 'mathematical model', 'linear programming'], facet_blocked: {} }],
    ];
    const plainly = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /** One pattern for some phrases, or none. */
    const phrases = (list) => (list.length ? new RegExp(`(?<![\\p{L}-])(?:${list.join('|')})(?![\\p{L}])`, 'iu') : null);
    const ASPECT = {
        features: /characteristic|feature|nature|qualit|attribute/i, types: /types?\b|kinds?\b|forms?\b|classif|categor/i, process: /process|steps?\b|stages?\b|procedure|how to/i, importance: /importan|significan|why\b|need\b|benefit|role of/i,
        advantages: /advantage|benefit|merit|\bpros\b|strength/i, limitations: /disadvantage|limitation|drawback|weakness|\bcons\b|criticism|problem/i, functions: /function/i, objectives: /objective|goal|purpose|aims?\b/i, principles: /principle/i,
        factors: /factor|determinant|cause|influence|affect/i, elements: /element|component|parts?\b/i, techniques: /technique|method|tool|approach/i, scope: /scope|fields?\b|areas?\b/i, roles: /roles?\b|responsibilit|duties/i,
    };
    const GENERAL = new Set(['level', 'function', 'stage', 'need', 'skill', 'role', 'style', 'type', 'form'].flatMap((w) => [w, ...terms(w)]));
    const LEANS = /^(?:this|that|that[’']s|these|those|such|he|she|they|it|its|their|however|also|for example|for instance|in addition|therefore|thus|hence|but|and|another|other|instead|as a result|first(?!-)|second(?!-)|third(?!-)|finally|furthermore|moreover|as with|like|the (?:first|second|third|fourth)|others|once|if the|in this|at this|both|[\w ]{0,20}who (?:use|adopt) this|because of this)\b/i;
    const SHARP = ['why', 'when', 'number', 'who', 'fact'];
    const english = (asked) => !/\p{Script=Devanagari}/u.test(asked.q);
    const readerReady = () => typeof Judge === 'object' && Judge.ready();

    /** The openings of some articles in one request, to see which of them are about the question. */
    async function openings(lang, titles) {
        const d = await get(lang, { action: 'query', prop: 'extracts', explaintext: '1', exintro: '1', exlimit: 'max', pageids: titles.map((x) => x.pageid).join('|') });
        return new Map((d && d.query && Array.isArray(d.query.pages) ? d.query.pages : []).filter((x) => x && typeof x.extract === 'string').map((x) => [x.pageid, x.extract.slice(0, 3000)]));
    }

    /** Puts the titles whose openings speak to the question first. */
    async function sortTitles(lang, titles, asked) {
        if (!readerReady() || !english(asked) || titles.length < 2) return titles;
        const some = titles.slice(0, 8);
        const seen = await openings(lang, some);
        const texts = some.map((x) => `${x.title}. ${sentencesOf(seen.get(x.pageid) || '').slice(0, 3).join(' ').slice(0, 600)}`);
        const p = await Judge.score(asked.q, texts);
        if (!p) return titles;
        return some.map((x, i) => ({ ...x, points: x.points + ({ why: 0.35, when: 0.8, number: 0.8, who: 1, fact: 1 }[asked.kind] || 0.7) * p[i] })).sort((x, y) => y.points - x.points);
    }

    /** True when a sentence holds the kind of thing asked for. The reader knows what a sentence is about better than whether it gives a reason. */
    function shape(asked, text) {
        // "The smallest in the world" is not "the smallest in Asia".
        if (/\b(?:in|of) the world\b|\bon earth\b|\bever\b/i.test(asked.q) && !/\b(?:world(?:'s|’s)?|earth(?:'s|’s)?|global(?:ly)?|planet|ever|any)\b/i.test(text)) return false;
        if (asked.kind === 'why') return /\b(?:because|due to|caus(?:e|ed|es|ing)|reasons?|results?|owing to|consequence|explain(?:s|ed)?|therefore|thus|so that|as a result|leads? to|led to|makes?|allow(?:s|ing)?)\b/i.test(text);
        if (asked.kind === 'when') return /\b(?:1\d{3}|20\d{2})\b|\bcentury\b/i.test(text);
        if (asked.kind === 'number') return /\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b/i.test(text);
        if (asked.kind === 'who') return /\p{Lu}\p{Ll}+/u.test(text.slice(1));
        return true;
    }

    /**
     * Has the reader read the likeliest sentences together with the question. What it says decides for questions with one answer,
     * and helps for the others, where the sections of an article say more than any one sentence.
     */
    async function judge(asked, ranked) {
        if (!readerReady() || !english(asked) || !ranked.all.length) return;
        const pool = ranked.all.filter((x) => !x.item && !x.aside);
        const some = new Set([...pool].sort((x, y) => y.score - x.score).slice(0, 30));
        // The opening of each article often answers without using the question's words.
        for (const x of pool) if (x.lead && x.place < 8 && some.size < 44) some.add(x);
        const list = [...some];
        const p = await Judge.score(asked.q, list.map((x) => `${x.page.title}${x.section ? ` > ${x.section}` : ''}: ${x.text}`));
        if (!p) return;
        ranked.judged = true;
        list.forEach((x, i) => {
            x.judged = p[i];
            if (SHARP.includes(asked.kind)) x.score = 0.4 * x.score + 16 * p[i];
            else x.score += 5 * p[i];
        });
        for (const x of ranked.all) if (x.judged === undefined && SHARP.includes(asked.kind)) x.score *= 0.4;
        // A pattern can be fooled by a date or a name; the reader has read what it belongs to.
        if (SHARP.includes(asked.kind)) for (const x of list) x.replies = shape(asked, x.text) && ((x.replies && x.judged > 0.02) || x.judged > 0.6);
    }

    /**
     * One heading for each item of a list that textbooks treat item by item. For each, the reader looks for the sentences
     * on that item alone, in the book and in the article on it.
     */
    async function byItem(asked, lang, size, books, rest = []) {
        const found = ITEMS.find(([pattern]) => pattern.test(asked.q));
        // Claims are not a list; a long list has a line for each item.
        if (!found || lang === 'hi' || !readerReady() || (found[3] && found[3].claims)) return null;
        if (found[2].length > 6) return longList(found, asked, lang, size, books);
        const [, topic, items, whole = {}] = found;
        const wiki = new Map();
        const titles = [...new Set([...items.map((x) => x[2]), whole.article])].filter(Boolean);
        if (titles.length) {
            const d = await get(lang, { action: 'query', prop: 'extracts', explaintext: '1', exintro: '1', exlimit: 'max', redirects: '1', titles: titles.join('|') });
            const moved = new Map((d && d.query && Array.isArray(d.query.redirects) ? d.query.redirects : []).map((r) => [r.from, r.to]));
            for (const t of titles) {
                const p = (d && d.query && Array.isArray(d.query.pages) ? d.query.pages : []).find((x) => x && x.title === (moved.get(t) || t) && typeof x.extract === 'string');
                if (p) wiki.set(t, { title: p.title, text: p.extract.slice(0, 6000), url: `${HOSTS[lang]}/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`, order: 1 });
            }
        }
        const main = typeof Book === 'object' ? await Book.find(asked.q, 2, 0.3, books) : [];
        const share = Math.max(28, Math.round(size * 0.8 / items.length));
        const used = new Set();
        const parts = [];
        const found_ = [];
        for (const [name] of items) if (typeof Book === 'object') found_.push(...await Book.find(`${name} in ${topic}`, 2, 0.2, books));
        for (const [name, other, title, alias, own = {}] of items) {
            const alike_ = phrases([...(own.blocked || []), ...(whole.blocked || [])]);
            const also = phrases((own.aliases || []).filter((x) => x.includes(' ') || x.includes('-')).map(plainly));
            const pages = [...found_, ...main, ...(wiki.has(title) ? [wiki.get(title)] : [])].filter((p, i, a) => a.findIndex((x) => x.url === p.url) === i);
            const words_ = new Set(terms(`${name} ${other} ${alias || ''} ${(own.aliases || []).join(' ')}`));
            const pool = pages.flatMap((p) => read({ ...p, order: 0 }).map((x) => ({ ...x, page: p }))).filter((x) => !used.has(x.text) && !/\?/.test(x.text) && !SIGNPOST.test(x.text) && !(alike_ && alike_.test(x.text)));
            for (const x of pool) {
                x.terms = terms(x.text);
                x.hits = new Set([...x.terms, ...terms(x.section)].filter((w) => words_.has(w))).size;
            }
            const some = pool.filter((x) => x.hits > 0 && length(x) >= 7).sort((x, y) => y.hits - x.hits).slice(0, 36);
            const p = some.length ? await Judge.score(`What is ${name.toLowerCase()} in ${topic}?`, some.map((x) => `${x.page.title}${x.section ? ` > ${x.section}` : ''}: ${x.text}`)) : null;
            if (!p) continue;
            some.forEach((x, i) => { x.judged = p[i]; x.raw = p[i]; });
            const ownWords = (n) => terms(n).filter((w) => !terms(topic).includes(w) && !GENERAL.has(w));
            const called = new Set(terms(alias || ''));
            const main_ = ownWords(name);
            const named = new Set([...main_, ...called]);
            // By the word itself: "organizational" does not speak of organizing.
            const plain = (t) => words(t).map((w) => w.toLowerCase().replace(/^\W+|\W+$/g, '').replace(/s$/, '')).filter((w) => w.length > 3 && !GENERAL.has(w) && !GENERAL.has(stem(w)));
            const others = new Set(items.filter(([n]) => n !== name).flatMap(([n, , , also]) => plain(`${n} ${also || ''}`)).filter((w) => !plain(`${name} ${alias || ''} ${topic}`).includes(w)));
            // A name of several words must be there with most of them.
            const says = (x) => !named.size || (also && also.test(x.text)) || x.terms.some((w) => called.has(w)) || main_.filter((w) => x.terms.includes(w)).length >= Math.min(2, main_.length);
            const near = (x) => says(x) || [...terms(x.section), ...terms(x.page.title)].some((w) => named.has(w));
            const apart = (x) => !plain(x.text).some((w) => others.has(w));
            const label = (x) => { const m = /^([^:.]{2,40}):\s/.exec(x.text); return Boolean(m) && terms(m[1]).some((w) => named.has(w)); };
            for (const x of some) {
                const t = x.text.split(/\s+/).map((w) => [w, terms(w).some((v) => named.has(v))]);
                // "Planning is ...", "... are known as capital", and "Growth: ..." open an item; a sentence on two items, one that
                // leans on the sentence before, or one that names the item only in passing does not.
                const verb = /^(?:is|are|refers?|means?|involves?|includes?|called|as)$/i;
                const defines = t.some(([w], i) => verb.test(w) && ((i < 10 && t.slice(Math.max(0, i - 3), i).some((v) => v[1])) || t.slice(i + 1, i + 4).some((v) => v[1])));
                const passing = !t.some((v, i) => v[1] && !/\([^)]*$/.test(x.text.split(/\s+/).slice(0, i + 1).join(' ')));
                x.passing = passing;
                x.judged += (label(x) ? 0.8 : 0) + (defines ? 0.4 : 0) - (apart(x) ? 0 : 0.4) - (LEANS.test(x.text) ? 0.4 : 0) - (says(x) ? 0 : 0.15) - (passing ? 0.3 : 0) + Math.min(0.2, 0.1 * (own.keywords || []).filter((w) => x.text.toLowerCase().includes(w.toLowerCase())).length);
            }
            const sayers = some.filter((x) => says(x) && !x.passing);
            const best = (sayers.length ? sayers : some.filter(near)).sort((x, y) => y.judged - x.judged)[0];
            if (!best || best.judged < 0.15) continue;
            // From the best sentence on, while the paragraph stays with the item.
            const chosen = [];
            let total = 0;
            const keyed = (x) => (own.keywords || []).some((w) => x.text.toLowerCase().includes(w.toLowerCase()));
            const follow = (from, most = share * 1.2, close = false) => {
                for (const x of pool.filter((y) => y.page === from.page && y.block === from.block && y.place >= from.place)) {
                    if (chosen.includes(x) || (total && total + length(x) > most) || (x !== from && (!apart(x) || (close && !keyed(x) && !LEANS.test(x.text)) || /on the other hand|in contrast|by contrast/i.test(x.text)))) break;
                    chosen.push(x);
                    total += length(x);
                }
            };
            // The definition slot.
            follow(best, share * 0.6);
            // The slot for what it does: its own question to the reader.
            const open = some.filter((y) => !chosen.includes(y) && !y.passing && (says(y) || near(y)) && apart(y) && !LEANS.test(y.text)).sort((m, n) => n.judged - m.judged).slice(0, 20);
            const does = open.length ? await Judge.score((whole.ask || 'What does {item} do in {topic}?').replace('{item}', name.toLowerCase()).replace('{topic}', topic), open.map((x) => `${x.page.title}${x.section ? ` > ${x.section}` : ''}: ${x.text}`)) : null;
            if (does) {
                open.forEach((x, i) => { x.does = Math.max(does[i], 0.8 * x.raw) + (says(x) ? 0.2 : 0) + (label(x) && keyed(x) ? 0.3 : 0) + Math.min(0.3, 0.1 * (own.keywords || []).filter((w) => x.text.toLowerCase().includes(w.toLowerCase())).length); });
                for (const x of open.filter((y) => y.does > 0.4).sort((m, n) => n.does - m.does)) {
                    if (total > share * 0.8) break;
                    if (chosen.includes(x) || chosen.some((c) => alike(c, x) > 0.6)) continue;
                    follow(x, share * 1.1, true);
                }
            }
            // The slot for an example, when a sentence gives one.
            if (total < share * 0.9) {
                const eg = some.filter((y) => !chosen.includes(y) && says(y) && apart(y) && !y.passing && /\b(?:for example|for instance|such as|e\.g\.|examples? (?:of|include))/i.test(y.text) && !/^(?:this|these|those|such|he|she|they|it|its|their)\b/i.test(y.text) && !chosen.some((c) => alike(c, y) > 0.6)).sort((m, n) => n.judged - m.judged)[0];
                if (eg && eg.judged > 0.3 && total + length(eg) < share * 1.3) {
                    chosen.push(eg);
                    total += length(eg);
                }
            }
            chosen.forEach((x) => used.add(x.text));
            // The heading is the item's own.
            parts.push({ head: name, chosen: chosen.map((x) => ({ ...x, section: '' })), cover: 1, wanted: 1, words: total });
        }
        if (parts.length < Math.max(2, Math.ceil(items.length / 2))) return null;
        parts.missing = items.map((x) => x[0]).filter((n) => !parts.some((x) => x.head === n));
        // No item has more than twice the words of another.
        const least = Math.max(25, Math.min(...parts.map((x) => x.words)));
        for (const x of parts) {
            while (x.words > 2 * least && x.chosen.length > 1) x.words -= length(x.chosen.pop());
        }
        // A short opening that says what the whole is: a sentence that defines it, or the best there is.
        const own_ = whole.article && wiki.get(whole.article);
        const otherFacet = phrases([...Object.values(whole.facet_blocked || {}).flat(), ...(whole.blocked || [])]);
        const says = definition(coreOf({ topics: [topic], q: topic }), [...(own_ ? [own_] : []), ...main].flatMap((p) => read({ ...p, order: 0 }).map((x) => ({ ...x, page: p, terms: terms(x.text) }))).filter((x) => !used.has(x.text) && !(otherFacet && otherFacet.test(x.text))));
        if (says) {
            parts.unshift({ head: '', chosen: [{ ...says, section: '' }], cover: 1, wanted: 1, words: length(says) });
            rest.push(...main.flatMap((p) => read({ ...p, order: 0 }).map((x) => ({ ...x, page: p, terms: terms(x.text) }))));
            return parts;
        }
        const pool = main.flatMap((p) => read({ ...p, order: 0 }).map((x) => ({ ...x, page: p, terms: terms(x.text) }))).filter((x) => !used.has(x.text) && !x.item && !LEANS.test(x.text) && !/^[^:.]{2,40}:\s/.test(x.text) && !/^(?:this|these|in this) (?:chapter|module|section|book)|^(?:let|now|so)\b|\balso\b|\?/i.test(x.text)).slice(0, 40);
        const p = pool.length ? await Judge.score(`What are the ${asked.topics[0]}?`, pool.map((x) => `${x.page.title}${x.section ? ` > ${x.section}` : ''}: ${x.text}`)) : null;
        if (p) {
            pool.forEach((x, i) => { x.judged = p[i]; });
            rest.push(...pool);
            // It speaks of all the items or of none, not of one.
            const about = (x) => items.filter(([n, , , also]) => terms(`${n} ${also || ''}`).filter((w) => !terms(topic).includes(w) && !GENERAL.has(w)).some((w) => x.terms.includes(w) || terms(x.text).includes(w))).length;
            pool.forEach((x, i) => { const n = about(x); p[i] += n === 1 ? -1 : n > items.length / 2 ? 0.3 : /\b(?:is|are|refers? to|consists? of|has|have) /i.test(x.text) && terms(topic).some((w) => terms(x.text).slice(0, 8).includes(w)) ? 0 : -0.5; });
            const k = p.indexOf(Math.max(...p));
            if (p[k] > 0.12) {
                const lead = [pool[k]];
                const next = pool[k + 1];
                if (next && next.page === lead[0].page && next.block === lead[0].block && about(next) !== 1 && length(lead[0]) + length(next) < Math.max(45, size * 0.2)) lead.push(next);
                parts.unshift({ head: '', chosen: lead.map((x) => ({ ...x, section: '' })), cover: 1, wanted: 1, words: lead.reduce((n, x) => n + length(x), 0) });
            }
        }
        return parts;
    }

    /** A list of many items: for each its name with one sentence that says what it is, and the names of those without one. */
    async function longList(found, asked, lang, size, books) {
        const [, topic, items, whole = {}] = found;
        const wiki = [];
        for (const title of whole.articles || []) {
            const d = await get(lang, { action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', redirects: '1', titles: title });
            const x = d && d.query && Array.isArray(d.query.pages) ? d.query.pages[0] : null;
            if (x && typeof x.extract === 'string' && x.extract.trim()) wiki.push({ title: String(x.title), text: x.extract.slice(0, 60000), url: `${HOSTS[lang]}/wiki/${encodeURIComponent(String(x.title).replace(/ /g, '_'))}` });
        }
        const book = typeof Book === 'object' ? await Book.find(asked.q, 2, 0.2, books) : [];
        const other = phrases([...Object.values(whole.facet_blocked || {}).flat(), ...(whole.blocked || [])]);
        const pages = [...book, ...wiki];
        const pool = pages.flatMap((p) => read({ ...p, order: 0 }).map((x) => ({ ...x, page: p, terms: terms(x.text) }))).filter((x) => !/\?/.test(x.text) && !(other && other.test(x.text)));
        const share = Math.max(24, Math.round(size * 0.85 / items.length));
        const parts = [];
        const missing = [];
        const named = (t) => terms(t).filter((w) => !['principl', 'manag'].includes(w));
        for (const [name, , , , own = {}] of items) {
            const blocked = phrases(own.blocked || []);
            const names = [name, ...(own.aliases || [])];
            const free = pool.filter((x) => !(blocked && blocked.test(x.text)));
            // "Order - this principle is concerned with ...": a line that has the name of the item and says what it is.
            const label = (x) => {
                const m = /^([^.:–—]{3,70}?)\s*(?:\s[-–—]\s|:\s)/.exec(x.text);
                if (!m || length(x) < 5) return false;
                const mine = new Set(named(m[1]));
                return names.some((n) => named(n).length && named(n).every((w) => mine.has(w))) && mine.size <= named(name).length + 2;
            };
            let best = free.filter((x) => !x.item && label(x)).sort((x, y) => (y.page === pages[0]) - (x.page === pages[0]))[0];
            if (!best) {
                const says = phrases(names.map((n) => plainly(n)));
                const some = free.filter((x) => !x.item && length(x) >= 8 && length(x) < 60 && says.test(x.text.slice(0, 90)) && !LEANS.test(x.text)).slice(0, 12);
                const p = some.length ? await Judge.score(`What does ${name.toLowerCase()} mean in ${topic}?`, some.map((x) => `${x.page.title}${x.section ? ` > ${x.section}` : ''}: ${x.text}`)) : null;
                if (p) {
                    const k = p.indexOf(Math.max(...p));
                    if (p[k] > 0.4) best = some[k];
                }
            }
            if (!best) {
                missing.push(name);
                continue;
            }
            const chosen = [best];
            let total = length(best);
            for (const x of free.filter((y) => y.page === best.page && y.block === best.block && y.place > best.place)) {
                if (total + length(x) > share || LEANS.test(x.text)) break;
                chosen.push(x);
                total += length(x);
            }
            parts.push({ head: name, chosen: chosen.map((x) => ({ ...x, section: '' })), cover: 1, wanted: 1, words: total });
        }
        if (parts.length < items.length / 3) return null;
        const used = new Set(parts.flatMap((x) => x.chosen.map((y) => y.text)));
        const key = named(topic);
        const lead = pool.filter((x) => !x.item && !used.has(x.text) && !LEANS.test(x.text) && length(x) >= 8 && length(x) <= 45 && key.every((w) => x.terms.includes(w)) && /\b(?:is|are|developed|proposed|identified|created|consists?|refers?|set)\b/i.test(x.text) && !/^[^:.]{2,40}:\s/.test(x.text)).slice(0, 24);
        const p = lead.length ? await Judge.score(`What are ${topic}?`, lead.map((x) => `${x.page.title}${x.section ? ` > ${x.section}` : ''}: ${x.text}`)) : null;
        if (p) {
            const v = p.map((n, i) => n + (/\b(?:principles?|needs|stages|ps)\b/i.test(lead[i].text) ? 0.3 : 0));
            const k = v.indexOf(Math.max(...v));
            if (v[k] > 0.3) parts.unshift({ head: '', chosen: [{ ...lead[k], section: '' }], cover: 1, wanted: 1, words: length(lead[k]) });
        }
        parts.missing = missing;
        parts.checklist = items.map((x) => x[0]);
        return parts;
    }

    const PLAIN = new Set(terms('meaning concept definition nature scope importance significance need needs role features characteristics types type kinds forms objectives objective purpose functions function process steps stages principles principle basics basic overview introduction fundamentals determinants factors advantages disadvantages benefits limitations merits demerits elements components methods techniques approaches models theories theory evolution history issues challenges trends applications application examples various different key core main general modern indian india source sources problem problems skills skill provisions uses use reason reasons causes cause impact effect effects relationship levels level explain detail structure methods tools classification essentials difference'));

    /** The words of a topic that say what it is about: "determinants of working capital" is about working capital. */
    function coreOf(asked) {
        let t = (asked.topics[0] || asked.q).replace(/\([^)]*\)/g, ' ').trim();
        const plain = (x) => { const all = terms(x); return all.length > 0 && all.every((w) => PLAIN.has(w)); };
        const m = /^(.+?)\s+(?:of|in|for|to|behind|affecting|determining|involved in)\s+(.+)$/i.exec(t);
        const some = m ? terms(m[1]) : [];
        if (m && terms(m[2]).length && (plain(m[1]) || (some.length > 1 && PLAIN.has(some[0]) && some.filter((w) => PLAIN.has(w)).length * 3 >= some.length && terms(m[2]).length > 1))) t = m[2];
        let all = terms(t);
        // "management by objectives" is a name; "planning techniques" is about planning.
        if (!/\s(?:by|of)\s/i.test(t)) {
            while (all.length > 1 && PLAIN.has(all[all.length - 1])) all = all.slice(0, -1);
            while (all.length > 1 && PLAIN.has(all[0])) all = all.slice(1);
        }
        const own = [...new Set(all)];
        return own.length ? own : [...new Set(terms(asked.topics[0] || asked.q))];
    }

    /** Whether a text speaks of the core of a topic: most of its words together in a title or in one sentence. */
    function speaks(core, text) {
        const have = new Set(terms(text));
        return core.filter((w) => have.has(w)).length >= Math.max(1, Math.ceil(core.length * 0.66));
    }

    function onTopic(core, page) {
        if (speaks(core, page.title)) return true;
        let n = 0;
        for (const line of page.text.split('\n')) {
            for (const text of line.startsWith('==') ? [line] : sentencesOf(line)) if (speaks(core, text) && ++n >= (core.length > 1 ? 2 : 4)) return true;
        }
        return false;
    }

    /** The sentence that says what the topic is, if there is one. */
    const definition = (core, pool) => definitions(core, pool)[0];
    /** All sentences that say what the topic is, best first. */
    function definitions(core, pool) {
        const verb = /\b(?:is|are|refers? to|means|involves|consists? of|describes|denotes)\b/i;
        return pool.filter((x) => {
            if (x.item || length(x) < 8 || length(x) > 60 || /\?/.test(x.text)) return false;
            const label = /^([^:.]{2,60}):\s/.exec(x.text);
            if (label) return speaks(core, label[1]) && terms(label[1]).filter((w) => !core.includes(w) && !PLAIN.has(w)).length <= (core.length > 1 ? 1 : 0);
            if (LEANS.test(x.text)) return false;
            const open = x.text.replace(/^In [^,.]{3,40}, /, '').replace(/\s*\([^)]*\)/g, '');
            const at = open.search(verb);
            if (at < 2 || at > 110) return false;
            const before = terms(open.slice(0, at));
            // The topic is what the sentence is about: "the assessment of the function of the heart is" is about an assessment.
            return core.every((w) => before.includes(w)) && before.length <= core.length + 2 && (core.includes(before[0]) || PLAIN.has(before[0]));
        }).map((x) => ({ x, v: (x.judged || 0) + (x.place === 0 ? 0.3 : 0) - (/^In (?!econom|management|business|marketing|finance|accounting|statistic|microecon|macroecon)\w+(?: \w+)?,/i.test(x.text) ? 0.3 : 0) + (/\b(?:is|are) (?:an?|the) |refers? to|means\b|:\s/.test(x.text) ? 0.2 : 0) })).sort((m, n) => n.v - m.v).map((m) => m.x);
    }

    const alikeText = (x, y) => x.terms && y.terms && alike(x, y) > 0.7;

    const CLOSES = /^(?:in (?:conclusion|summary|short|sum)|overall|to (?:sum|conclude)|thus|therefore|ultimately)\b|\b(?:essential|crucial|vital|important|importance|critical|success(?:ful)?|benefits?|helps?|enables?|allows?)\b/i;

    /**
     * The form of an exam answer: an introduction, the points one by one, and a conclusion when the sources have a sentence
     * that can close. Every sentence stays as its source has it; only the order and the headings are made here.
     */
    function exam(result, pool = []) {
        const { asked, parts } = result;
        if (!['list', 'explain', 'why', 'define'].includes(asked.kind) || !parts.length) return result;
        const bare = (x) => ({ ...x, section: '' });
        const part = (head, chosen, sub = '') => ({ head, sub, chosen: chosen.map(bare), cover: 1, wanted: 1, words: chosen.reduce((n, x) => n + length(x), 0) });
        let intro = [];
        let points = [];
        if (parts.length > 1) {
            if (!parts[0].head) intro = parts[0].chosen;
            points = parts.filter((p) => p.head).map((p) => ({ name: p.head, chosen: p.chosen }));
        } else {
            const all = parts[0].chosen;
            const total = all.reduce((n, x) => n + length(x), 0);
            if (total < 70 || all.length < 4) {
                // A short answer has no headings, but it too begins with what the topic is.
                const says = definition(coreOf(asked), [...all, ...pool]);
                if (!says || says.text === all[0].text || asked.kind === 'why') return result;
                const room = Math.max(result.size || 80, 60) * 1.15;
                const kept = [says];
                let n = length(says);
                for (const x of all.filter((y) => y.text !== says.text && !alikeText(y, says))) {
                    if (n + length(x) > room) continue;
                    kept.push(x);
                    n += length(x);
                }
                return { ...result, parts: [{ ...parts[0], chosen: kept.map((x) => (x === says ? bare(x) : x)), words: n }] };
            }
            // The paragraph it opens with, up to about fifty words; the rest are points.
            let n = 0;
            while (n < all.length && !all[n].item && (n === 0 || (all[n].block === all[0].block && all[n].page === all[0].page && intro.reduce((v, x) => v + length(x), 0) + length(all[n]) <= 55))) intro.push(all[n++]);
            const groups = [];
            for (const x of all.slice(n)) {
                const last = groups[groups.length - 1];
                if (last && last[0].page === x.page && (last[0].block === x.block || (last[0].item && x.item) || (x.item && last[0].section === x.section))) last.push(x);
                else groups.push([x]);
            }
            const used = new Set();
            for (const g of groups) {
                const title = [g[0].section, g[0].page.title].find((t) => t && !/^(?:key terms?|overview|introduction|summary|see also|general)$/i.test(t)) || '';
                const label = /^([A-Z][\w’'-]+(?: [\w’'-]+){0,3}(?: \([^)]{1,20}\))?):\s/.exec(g[0].text);
                const name = label ? label[1] : title;
                // More on the same heading stays under it.
                if (!name || used.has(name)) {
                    if (points.length && (!name || points[points.length - 1].name === name)) points[points.length - 1].chosen.push(...g);
                    else points.push({ name: '', chosen: g });
                } else {
                    used.add(name);
                    points.push({ name, chosen: g });
                }
            }
        }
        if (points.length < 2) return result;
        // It opens with what the topic is. What opened before becomes the first point, unless it says the same.
        const core = coreOf(asked);
        // Where the points are the items of a list, no item lends its sentence to the introduction.
        const items = parts.length > 1;
        if (!intro.length || (!items && !definition(core, intro.slice(0, 1)))) {
            const shared = new Set(items ? points.flatMap((p) => p.chosen.map((x) => x.text)) : []);
            const says = definition(core, [...intro, ...(items ? [] : points.flatMap((p) => p.chosen)), ...pool].filter((x) => !shared.has(x.text)));
            if (says) {
                points.forEach((p) => { p.chosen = p.chosen.filter((x) => x.text !== says.text); });
                const left = intro.filter((x) => x.text !== says.text);
                if (left.length && parts.length === 1) {
                    const name = /^(?:key terms?|overview|introduction|summary)?$/i.test(left[0].section) ? left[0].page.title : left[0].section;
                    const same = points.find((p) => p.name === name);
                    if (same) same.chosen.unshift(...left);
                    else points.unshift({ name, chosen: left });
                }
                intro = parts.length === 1 ? [says] : [says, ...left];
                points = points.filter((p) => p.chosen.length);
            } else if (intro.length && LEANS.test(intro[0].text)) {
                const better = points.flatMap((p) => p.chosen).find((x) => !x.item && !LEANS.test(x.text) && speaks(core, x.text));
                if (intro.length > 1) intro = intro.slice(1);
                else if (better) {
                    points.forEach((p) => { p.chosen = p.chosen.filter((x) => x !== better); });
                    points = points.filter((p) => p.chosen.length);
                    intro = [better];
                }
            }
        }
        // Where nothing defines the topic, what was to open the answer is a point like the others.
        if (asked.course && !items && intro.length && !definition(core, intro.slice(0, 1)) && (!speaks(core, intro[0].text) || /\b(?:century|founded|born|in \d{4}|job title|degree|field of study|academic)\b/i.test(intro[0].text))) {
            points.unshift({ name: intro[0].section || intro[0].page.title, chosen: intro });
            intro = [];
        }
        const shown = new Set([...intro, ...points.flatMap((p) => p.chosen)].map((x) => x.text));
        const topic = new Set(terms(asked.topics[0] || asked.q));
        const pages = new Set([...intro, ...points.flatMap((p) => p.chosen)].map((x) => x.page.url));
        const close = pool.filter((x) => !x.item && pages.has(x.page.url) && !shown.has(x.text) && length(x) >= 9 && length(x) <= 42 && !/\?|:/.test(x.text) && CLOSES.test(x.text)
            && (!LEANS.test(x.text) || /^(?:thus|therefore|overall)\b/i.test(x.text)) && terms(x.text).some((w) => topic.has(w)) && (x.judged || 0) > 0.05)
            .sort((x, y) => (y.judged || 0) + (/^(?:in (?:conclusion|summary)|overall|thus|therefore|ultimately)/i.test(y.text) ? 0.5 : 0) - (x.judged || 0) - (/^(?:in (?:conclusion|summary)|overall|thus|therefore|ultimately)/i.test(x.text) ? 0.5 : 0))[0];
        const name = (asked.topics[0] || '').replace(/^(?:the|an?)\s+/i, '');
        // As many points as the length can hold, so that each is written out.
        const most = !result.size || result.size > 420 ? 8 : result.size > 250 ? 6 : result.size > 120 ? 4 : 3;
        if (parts.length === 1) points = points.slice(0, most);
        for (const p of points) if (p.name && terms(p.name).join(' ') === terms(name).join(' ')) p.name = `More about ${p.name[0].toLowerCase()}${p.name.slice(1)}`;
        // What has the same heading stands together.
        points = points.filter((p, i) => {
            const first = p.name ? points.find((x, k) => k < i && terms(x.name).join(' ') === terms(p.name).join(' ')) : null;
            if (first) first.chosen = [...first.chosen, ...p.chosen];
            return !first;
        });
        const heads = points.map((p) => p.name).filter(Boolean);
        const list = (x) => (x.length < 2 ? x.join('') : `${x.slice(0, -1).join(', ')} and ${x[x.length - 1]}`);
        const low = (t) => (/^[A-Z][a-z]/.test(t) && !/^(?:[A-Z][a-z]+ ){1,}[A-Z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
        const short = heads.filter((h) => words(h).length <= 6 && !/[?:]/.test(h));
        const out = [];
        if (intro.length) out.push(part('Introduction', intro));
        points.forEach((p, i) => out.push({ ...part(i ? '' : 'Explanation', p.chosen, `${i + 1}.${p.name ? ` ${p.name}` : ''}`), note: !i && points.length > 2 && heads.length === points.length ? `The answer is explained below under ${['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][points.length] || points.length} points.` : '' }));
        if (result.sure !== false) {
            const said = parts.length > 1 && short.length > 1 ? `Thus, ${name ? `${low(name)} can be understood through` : 'the topic covers'} ${list(short.map(low))}.` : '';
            if (close) out.push(part('Conclusion', [close]));
            else if (said) out.push({ ...part('Conclusion', []), note: said });
        }
        return { ...result, parts: out };
    }

    const HEADS = { features: ['characteristics', 'Characteristics'], types: ['types', 'Types'], importance: ['importance', 'Importance'], objectives: ['objectives', 'Objectives'], principles: ['principles', 'Principles'], functions: ['functions', 'Functions'], advantages: ['advantages', 'Advantages'], limitations: ['disadvantages', 'Limitations'], factors: ['factors', 'Factors'], scope: ['scope', 'Scope'], effects: ['effects', 'Effects'] };
    /** The parts of a structured query as questions for the sources, each with its heading and its share of the words. */
    function asksOf(query) {
        const out = [];
        const name = (t) => t[0].toUpperCase() + t.slice(1);
        for (const p of query.parts) {
            const t = p.topic;
            const before = out[out.length - 1];
            if (p.whole && before && before.whole && before.topic === t) {
                before.weight += p.weight;
                continue;
            }
            const one = { topic: t, facet: p.facet, weight: p.weight, known: p.known };
            if (p.whole || p.list || p.facet === 'short-note') Object.assign(one, { q: `Explain ${t.replace(/^(\p{Lu}[\p{L}]+)'s ((?:14 )?principles of .+)$/u, 'the $2 by $1')}`, head: name(t), whole: Boolean(p.whole) });
            else if (p.facet === 'comparison') Object.assign(one, { q: `Difference between ${p.sides[0]} and ${p.sides[1]}`, head: `Difference between ${p.sides[0]} and ${p.sides[1]}`, compare: true });
            else if (p.facet === 'relationship') Object.assign(one, { q: `Explain the relationship between ${t}`, head: `Relationship between ${t}` });
            else if (p.facet === 'definition') Object.assign(one, { q: `What is ${t}`, head: `Meaning of ${t}`, defines: true });
            else if (p.facet === 'process') Object.assign(one, { q: /^(?:process|procedure)$/.test(p.word || '') ? `Explain the ${p.word} of ${t}` : /^stages?$/.test(p.word || '') ? `What are the stages of ${t}` : `What are the steps in ${/process$/i.test(t) ? `the ${t}` : t}`, head: `Process of ${t.replace(/\s+process$/i, '')}`, aspect: 'process' });
            else if (p.facet === 'statement' || p.facet === 'statement-conclusion') {
                const is = t.replace(/ as (?=\w+ing\b)/, ' is ');
                const ends = p.facet === 'statement-conclusion';
                Object.assign(one, { q: `Explain ${is}`, head: ends ? 'Conclusion' : name(t), gap: ends ? `conclusion: ${t}` : name(t), statement: / as \w+ing\b/.test(t) ? t.replace(/ as .*$/, '') : '' });
                if (p.must && p.must.length) {
                    const entry = ITEMS.find(([pattern, , , more]) => more && more.claims && pattern.test(t));
                    const item = entry && !ends ? entry[2].find(([n]) => n.toLowerCase() === t.toLowerCase()) : null;
                    const own = (item && item[4]) || {};
                    const more = (entry && entry[3]) || {};
                    one.claim = { ask: p.ask || `Why ${is}?`, must: p.must.map((x) => new RegExp(x, 'iu')), keywords: own.keywords || [], blocked: phrases([...(own.blocked || []), ...(more.blocked || [])]), articles: more.articles || [], least: ends ? 0.02 : 0.12, most: ends ? 2 : 6 };
                }
            }
            else {
                const [usual, head_] = HEADS[p.facet] || [p.facet, name(p.facet)];
                // Words of the examiner that the sources use too.
                const own = /^(?:methods|techniques|tools|elements|components|sources|bases|instruments|styles|approaches|measures|dimensions|causes|determinants|responsibilities|duties|barriers|qualities|tools and techniques)$/.test(p.word || '') ? p.word : '';
                const [word, head] = own ? [own, name(own)] : [usual, head_];
                Object.assign(one, { q: p.facet === 'importance' || p.facet === 'scope' ? `Explain the ${word} of ${t}` : `What are the ${word} of ${t}`, head: `${head} of ${t}`, aspect: /^(?:elements|components)$/.test(own) ? 'elements' : /^(?:methods|techniques|tools|approaches|measures|instruments|sources)$/.test(own) ? 'techniques' : ASPECT[p.facet] ? p.facet : '' });
            }
            out.push(one);
        }
        const ends = out.find((x) => x.claim && x.head === 'Conclusion');
        if (ends) for (const x of out) if (x.claim && x !== ends && ends.claim.must.length > x.claim.must.length) x.claim.kept = ends.claim.must;
        return out;
    }
    /** How long the answer should be: what was asked for, or what the command needs. */
    const lengthOf = (query, size) => size || (query.told ? query.words : { define: 130, compare: 260, 'short-note': 150 * Math.max(1, query.parts.length) }[query.command] || query.words);

    async function answer(question, lang, size, { format = 'plain', books = null, subject = '', known = null, before = '', query = null } = {}) {
        // A question on the course comes as a structured query, and its text is not read again.
        const asks = query && query.course && lang !== 'hi' ? asksOf(query) : null;
        if (asks && asks.length) size = lengthOf(query, size);
        const told_ = asks ? query.told : false;
        const read_ = asks ? { q: asks.length === 1 ? asks[0].q : asks.map((x) => x.q).join('. '), parts: asks, notes: [], fixed: query.fixed, topic: asks[0].topic } : typeof Parse === 'object' && lang !== 'hi' ? Parse.plan(question, known, before) : { q: question, parts: [], notes: [], fixed: [] };
        const long = (q) => (typeof Parse === 'object' && lang !== 'hi' ? Parse.long(q, Boolean(subject)) : q);
        const plan = { read: read_.q, fixed: read_.fixed || [], notes: read_.notes || [], parts: read_.parts.map((p) => p.head) };
        if (read_.parts.length < 2) {
            const pool = [];
            const one = asks ? asks[0] : {};
            const result = await find(long(read_.q), lang, size, books, pool, subject, { aspect: one.aspect || '', topic: one.statement || '', claim: one.claim || null, about: one.topic || '' });
            if (asks) result.told = told_;
            if (asks && result.parts.length && !result.sure && !(result.missing || []).length) result.missing = [one.gap || one.head];
            const formed = format === 'exam' && result.parts.length ? exam(result, pool) : result;
            return { ...formed, ...(asks && formed.parts.length ? { parts: clean(formed.parts, pool, size, one.claim || (result.checklist || []).length ? '' : one.topic) } : {}), plan };
        }
        // Several things are asked: each is looked up by itself and has its own heading.
        const told = wish(question);
        const whole = size || told.words || Math.min(600, 130 * read_.parts.length + 40);
        const out = [];
        const missing = [];
        const checklist = [];
        let first = null;
        let any = false;
        for (const [i, part] of read_.parts.entries()) {
            const pool = [];
            const weightOf = (x) => (asks ? x.weight : x.aspect || x.compare || x.statement ? 1.15 : 0.8);
            const left = read_.parts.slice(i).reduce((n, x) => n + weightOf(x), 0);
            const share = Math.max(60, Math.round(asks ? (whole - out.reduce((n, x) => n + x.words, 0)) * weightOf(part) / left : whole * weightOf(part) / read_.parts.reduce((n, x) => n + weightOf(x), 0)));
            const got = await find(long(part.q), lang, share, books, pool, subject, { aspect: part.aspect ? part.aspect[0] : '', topic: asks ? part.statement || '' : part.statement ? part.topic : '', claim: part.claim || null, about: asks ? part.topic : '' });
            if (!first) first = got;
            if (!got.parts.length || !got.sure) {
                missing.push(part.gap || part.head);
                continue;
            }
            any = true;
            for (const n of got.missing || []) missing.push(`${n} (${part.head})`);
            if (got.checklist && got.missing.length) checklist.push(...got.checklist);
            const taken = new Set(out.flatMap((p) => p.chosen.map((x) => x.text)));
            const says = part.defines ? definitions(coreOf({ topics: [part.topic], q: part.topic }), [...got.parts.flatMap((p) => p.chosen), ...pool]).filter((x, k, all) => all.findIndex((y) => y.text === x.text) === k) : [];
            const few = [];
            for (const x of says) if (few.length < 3 && (!few.length || /\b(?:is|are) (?:an?|the) |refers? to|\bmeans\b|\bdefine[sd]?\b|^[^:.]{2,40}:\s/i.test(x.text)) && !few.some((y) => alikeText(x, y)) && (!few.length || few.reduce((n, y) => n + length(y), length(x)) <= share)) few.push({ ...x, section: '' });
            const formed = few.length ? { ...got, parts: [{ head: '', chosen: few, cover: 1, wanted: 1, words: few.reduce((n, x) => n + length(x), 0) }] } : got.asked.kind === 'compare' || part.claim ? got : exam({ ...got, asked: { ...got.asked, kind: 'explain' } }, pool);
            if (asks && !part.claim && !few.length && formed.parts.length) formed.parts = clean(formed.parts, pool, share, (got.checklist || []).length || got.asked.kind === 'compare' ? '' : part.topic);
            const name = part.head === 'Conclusion' ? 'Conclusion' : `${format === 'exam' ? `${out.filter((p) => p.head && p.head !== 'Conclusion').length + 1}. ` : ''}${part.head}`;
            let opened = false;
            for (const p of formed.parts) {
                if (p.head === 'Conclusion' && (i < read_.parts.length - 1 || read_.parts.some((x) => x.head === 'Conclusion'))) continue;
                const chosen = p.chosen.filter((x) => !taken.has(x.text));
                if (!chosen.length) continue;
                const same = (t) => terms(t).join(' ') === terms(part.topic || '').join(' ') || terms(t).join(' ') === terms(part.head).join(' ');
                const sub_ = p.head === 'Conclusion' || p.head === 'Introduction' ? '' : (p.sub || '').replace(/^\d+\.\s*/, '') || (got.asked.kind === 'compare' ? p.head : '');
                const sub = same(sub_.replace(/^More about /, '')) ? '' : sub_;
                out.push({ ...p, note: '', head: p.head === 'Conclusion' ? 'Conclusion' : opened ? '' : name, sub: p.head === 'Conclusion' ? '' : sub, chosen, words: chosen.reduce((n, x) => n + length(x), 0) });
                opened = true;
            }
            if (!opened) missing.push(part.gap || part.head);
        }
        // The conclusion of a statement is the end of its answer.
        const ends = out.filter((p) => p.head === 'Conclusion');
        out.splice(0, out.length, ...out.filter((p) => p.head !== 'Conclusion'), ...ends);
        const asked = { ...(first ? first.asked : understand(question)), kind: 'several', topics: [read_.topic || (first ? first.asked.topics[0] : question)] };
        if (!any) {
            const pool = [];
            const result = await find(long(read_.q), lang, size, books, pool, subject);
            return { ...(format === 'exam' && result.parts.length ? exam(result, pool) : result), ...(asks ? { sure: false, missing } : {}), plan };
        }
        // What a part had only in common with another is told as missing.
        const last = asks ? clean(out) : out;
        for (const p of asks ? out : []) if (p.head && !last.some((x) => x.head === p.head) && !missing.includes(p.head.replace(/^\d+\.\s*/, ''))) missing.push(p.head.replace(/^\d+\.\s*/, ''));
        return { asked, parts: last, size: whole, told: asks ? told_ : size > 0 || told.words > 0, sure: true, missing, checklist, plan };
    }

    const Judge_ = async (q, list) => (readerReady() ? Judge.score(q, list.map((x) => `${x.page.title}${x.section ? ` > ${x.section}` : ''}: ${x.text}`)) : null);

    const TRADE = /\b(?:manage(?:ment|rs?|rial)|business(?:es)?|organi[sz]ations?|compan(?:y|ies)|firms?|employe(?:es?|rs?)|workers?|markets?|marketing|customers?|consumers?|corporat(?:e|ions?)|econom(?:y|ics?|ists?)|accounting|financ(?:e|ial)|costs?|prices?|products?|production|statistic(?:s|al)?|probability)\b/gi;

    // Works of art and people that share a name with a topic of a course.
    const NAMESAKE = /\b(?:is|are|was|were) (?:an? |the )?[^.]{0,70}\b(?:rock|pop|band|film|album|song|single|video game|television|tv series|short subject|novel|rapper|singer|footballer|comic|anime|manga|racehorse|village|surname|musician|magazine|board game)\b/i;

    /** True for a chapter whose title has a word that also stands before most mentions of the topic. */
    function narrow(page, about, q) {
        const last = stem(about.toLowerCase().split(' ').pop());
        const t = words(page.text).map((w) => w.toLowerCase());
        const before = new Map();
        let all = 0;
        for (let i = 1; i < t.length; i++) {
            if (stem(t[i]) !== last) continue;
            all++;
            const w = t[i - 1];
            if (w.length > 3 && !STOP.has(w) && !PLAIN.has(stem(w))) before.set(w, (before.get(w) || 0) + 1);
        }
        const asks = new Set(terms(q));
        const own = new Set(terms(page.title));
        return all > 4 && [...before].some(([w, n]) => n / all > 0.3 && !terms(w).some((x) => asks.has(x)) && (terms(w).some((x) => own.has(x)) || w.includes('-')));
    }

    /** Scores up what is about the topic itself, and down what is about another known topic, or about one that only looks alike. */
    function keepTo(ranked, about, aspect) {
        const me = Parse.norm(about);
        const core = ` ${me} `;
        const key = new Set(terms(about));
        const pages = new Map();
        for (const s of ranked.all) {
            // The article on the thing itself, and a chapter that does not name it.
            if (!pages.has(s.page)) {
                const title = [...new Set(terms(s.page.title.replace(/\(.*?\)/g, '')))];
                pages.set(s.page, title.length === key.size && title.every((w) => key.has(w)) ? 1.5 : s.page.from && !title.some((w) => key.has(w)) ? -1.5 : 0);
            }
            s.score += pages.get(s.page);
            const text = ` ${Parse.norm(s.text)} `;
            const named = Parse.topicsIn(s.text).map(Parse.norm);
            const alikes = named.filter((n) => n !== me && ` ${n} `.includes(core)).length;
            const mine = Math.max(0, text.split(core).length - 1 - alikes);
            const other = new Map();
            for (const n of named) if (n !== me && !` ${n} `.includes(core) && !core.includes(` ${n} `)) other.set(n, (other.get(n) || 0) + 1);
            const most = Math.max(0, ...other.values());
            if (most > mine) s.score -= mine ? 1.5 : 3;
            if (alikes && !mine && aspect !== 'types') s.score -= 1.5;
            // The topic is what the sentence is about.
            if (text.startsWith(core) || /^ (?:effective |good |most )/.test(text) && text.indexOf(core) < 14 && text.indexOf(core) > 0) s.score += 2;
        }
    }

    /** The sentences that speak for one claim of a statement: what they must say is known, and what only looks alike is kept out. */
    async function argue(claim, asked, ranked, size, pool, told) {
        pool.push(...ranked.all);
        const some = ranked.all.filter((x) => !x.item && !x.aside && length(x) >= 8 && length(x) <= 60 && !/\?/.test(x.text) && !LEANS.test(x.text) && !(claim.blocked && claim.blocked.test(x.text)) && claim.must.every((p) => p.test(x.text)) && !(claim.kept && claim.kept.every((p) => p.test(x.text)))).sort((x, y) => y.score - x.score).slice(0, 30);
        const p = some.length ? await Judge_(claim.ask, some) : null;
        if (!p) return { asked, parts: [], size, told, sure: false };
        const keys = (x) => claim.keywords.filter((w) => x.text.toLowerCase().includes(w.toLowerCase())).length;
        some.forEach((x, i) => { x.judged = p[i]; x.argues = p[i] + Math.min(0.45, 0.15 * keys(x)); });
        const chosen = [];
        let total = 0;
        for (const x of some.filter((y) => y.argues > claim.least).sort((m, n) => n.argues - m.argues)) {
            if (chosen.some((c) => alike(c, x) > 0.6) || (total && total + length(x) > size * 1.1)) continue;
            chosen.push({ ...x, section: '' });
            total += length(x);
            if (total > size * 0.8 || chosen.length >= claim.most) break;
        }
        chosen.sort((x, y) => x.page.order - y.page.order || x.place - y.place);
        return { asked, parts: chosen.length ? [{ head: '', chosen, cover: 1, wanted: 1, words: total }] : [], size, told, sure: chosen.length > 0 };
    }

    async function find(question, lang, size, books, pool, subject, { aspect = '', topic = '', claim = null, about = '' } = {}) {
        const asked = understand(question);
        if (about) asked.course = true;
        if (aspect) asked.aspect = aspect;
        // A statement is about its subject; the whole of it says what to look for.
        if (topic) asked.topics = [topic];
        // Only a length that was asked for is worth a remark when it cannot be met.
        const told = size > 0 || asked.told;
        if (!size) size = asked.words;
        if (['list', 'explain', 'define'].includes(asked.kind)) {
            const parts = await byItem(asked, lang, size, books, pool);
            if (parts && !claim) return { asked: { ...asked, kind: 'list' }, parts, size, told, sure: true, missing: parts.missing || [], checklist: parts.checklist };
        }
        if (asked.kind === 'compare') {
            const parts = [];
            const rest = [];
            for (const topic of asked.topics) {
                const own = lang !== 'hi' && typeof Book === 'object' ? await Book.find(`What is ${topic}?`, 1, books ? 0.6 : 0.95, books) : [];
                const wiki = (await articles(lang, pickTitles([await search(lang, subject ? `${topic} ${subject.toLowerCase()}` : topic, 4), ...(subject ? [await search(lang, topic, 4)] : [])], { kind: 'compare', topics: [topic], q: topic }), 1)).filter((p) => !subject || onTopic(coreOf({ topics: [topic], q: topic }), p));
                const pages = [...wiki, ...own].map((p, order) => ({ ...p, order }));
                if (!pages.length) continue;
                const ranked = rank({ kind: 'compare', q: topic }, pages);
                await judge({ kind: 'compare', q: `What is ${topic}?` }, ranked);
                if (!ranked.all.length) continue;
                const got = choose(ranked, Math.round(size * 0.4));
                const says = books ? definition(coreOf({ topics: [topic], q: topic }), ranked.all) : null;
                if (says && !got.chosen.some((x) => x.text === says.text)) got.chosen.unshift({ ...says, section: '' });
                rest.push(...ranked.all);
                if (got.chosen.length) parts.push({ head: books ? topic[0].toUpperCase() + topic.slice(1) : pages[0].title, ...got, chosen: got.chosen.slice(0, 8) });
            }
            if (parts.length > 1 && lang !== 'hi') {
                const [one, two] = asked.topics.map((t) => coreOf({ topics: [t], q: t }));
                const more = typeof Book === 'object' ? await Book.find(`difference between ${asked.topics[0]} and ${asked.topics[1]}`, 2, 0.3, books) : [];
                const all = [...rest, ...more.flatMap((p) => read({ ...p, order: 0 }).map((x) => ({ ...x, page: p, terms: terms(x.text) })))];
                const taken = new Set(parts.flatMap((p) => p.chosen.map((x) => x.text)));
                const apart = one.filter((w) => !two.includes(w)).length && two.filter((w) => !one.includes(w)).length;
                const both = all.filter((x, i) => apart && !x.item && !taken.has(x.text) && length(x) >= 8 && one.every((w) => x.terms.includes(w)) && two.every((w) => x.terms.includes(w)) && !/\?/.test(x.text) && all.findIndex((y) => y.text === x.text) === i).slice(0, 30);
                const p = both.length ? await Judge_(`What is the difference between ${asked.topics[0]} and ${asked.topics[1]}?`, both) : null;
                if (p) {
                    const best = both.map((x, i) => ({ x, v: p[i] + (/\b(?:whereas|unlike|while|differ|difference|rather than|in contrast|on the other hand|but|however|compared)\b/i.test(x.text) ? 0.25 : 0) })).filter((m) => m.v > 0.4).sort((m, n) => n.v - m.v).slice(0, 3).map((m) => ({ ...m.x, section: '' }));
                    if (best.length) parts.push({ head: 'How they differ', chosen: best, cover: 1, wanted: 1, words: best.reduce((n, x) => n + length(x), 0) });
                }
            }
            return { asked, parts, size, told, sure: parts.length > 1 };
        }
        const queries = [...new Set([...asked.topics, asked.q].map((t) => t.toLowerCase()))].slice(0, 3);
        // A question that names a topic, not one that asks for a fact about it in a whole sentence.
        const topical = subject || asked.kind !== 'explain' || /^(?:explain|describe|discuss|define|write|give|tell)\b/i.test(asked.q) || asked.q.split(' ').length < 4;
        // "Determinants of working capital" is looked up as working capital too.
        if (topical && lang !== 'hi' && ['explain', 'list', 'define'].includes(asked.kind)) {
            const core = new Set(coreOf(asked));
            const bare = words(asked.topics[0].toLowerCase()).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter((w) => terms(w).some((t) => core.has(t))).join(' ');
            if (bare && !queries.includes(bare)) queries.unshift(bare);
            // Within a subject, the subject helps to tell one meaning of a word from another.
            if (bare && subject) queries.push(`${bare} ${subject.replace(/\([^)]*\)|\bI+$/g, '').toLowerCase()}`.replace(/\s+/g, ' ').trim());
        }
        if (['when', 'number'].includes(asked.kind)) {
            const bare = asked.topics[0].split(' ').filter((w) => !VERB[w.toLowerCase()] && !SIZE[w.toLowerCase()] && !/^(?:is|are|was|were|the|did|does|do)$/i.test(w)).join(' ').toLowerCase();
            if (bare && !queries.includes(bare)) queries.push(bare);
        }
        // A reason is seldom in an article named after the words of the question, so the whole question leads.
        if (asked.kind === 'why' || asked.kind === 'number') queries.reverse();
        const searches = [];
        for (const q of queries) searches.push(await search(lang, q, 5));
        if (!searches.some((x) => x.length)) return { asked, parts: [] };
        let titles = pickTitles(searches, asked);
        titles = await sortTitles(lang, titles, asked);
        if (topical && lang !== 'hi' && ['explain', 'list'].includes(asked.kind)) {
            // The article on the thing itself comes before one on a part of it.
            const core = coreOf(asked);
            const own = titles.findIndex((x) => { const t = [...new Set(terms(x.title.replace(/\(.*?\)/g, '')))]; return t.length === core.length && t.every((w) => core.includes(w)); });
            if (own > 0) titles.unshift(...titles.splice(own, 1));
            else if (own < 0) {
                const found = searches.flat().find((x) => { const t = [...new Set(terms(x.title.replace(/\(.*?\)/g, '')))]; return t.length === core.length && t.every((w) => core.includes(w)); });
                if (found) titles.unshift({ pageid: found.pageid, title: found.title, points: 1 });
            }
        }
        let merged = await articles(lang, titles, 3);
        // A business question is answered from the textbook first; Wikipedia adds to it.
        if (lang !== 'hi' && typeof Book === 'object' && (['define', 'explain', 'list'].includes(asked.kind) || (asked.kind === 'why' && books) || (asked.kind === 'why' && /\b(?:firms?|compan(?:y|ies)|business(?:es)?|managers?|employees?|consumers?|customers?|markets?|organi[sz]ations?)\b/i.test(asked.q)))) {
            let book = await Book.find(asked.q, 2, books ? 0.5 : 0.9, books);
            // A chapter on one kind of the thing ("cross-cultural training") is not on the thing.
            if (about && aspect !== 'types') {
                const wide = book.filter((x) => !narrow(x, about, asked.q));
                book = wide.length || merged.length ? wide : book;
            }
            if (book.length) merged = (asked.kind === 'define' ? [...merged.slice(0, 2), ...book.slice(0, 1)] : [...book, ...merged.slice(0, 2)]).map((p, order) => ({ ...p, order }));
        }
        // Nor is the life of a person who had to do with it.
        // A title with a word that is not asked for ("Diving supervisor") has to be about business as well, within a business subject.
        const strange = (p) => {
            if (p.from || !books || !books.length) return false;
            const asks = new Set([...terms(asked.q), ...terms(asked.topics.join(' ')), ...terms(subject)]);
            if (terms(p.title.replace(/\(.*?\)/g, '')).every((w) => asks.has(w) || PLAIN.has(w))) return false;
            const t = p.text.slice(0, 4000);
            return (t.match(TRADE) || []).length / Math.max(1, words(t).length) < 0.008;
        };
        const apart = (p) => strange(p) || !p.from && (NAMESAKE.test(p.text.slice(0, 260)) || (/\(born\b|\(\d{4}\s?[–-]\s?\d{4}\)|\b(?:politician|actor|actress|businessman|businesswoman|lawyer|academic|civil servant)\b/i.test(p.text.slice(0, 220)) && !speaks(coreOf(asked), p.title)));
        if (subject) merged = merged.filter((p) => !apart(p));
        // A claim has its own articles, and none on a look-alike.
        if (claim) {
            for (const title of claim.articles) {
                if (merged.some((x) => x.title === title)) continue;
                const d = await get(lang, { action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', redirects: '1', titles: title });
                const x = d && d.query && Array.isArray(d.query.pages) ? d.query.pages[0] : null;
                if (x && typeof x.extract === 'string' && x.extract.trim()) merged.push({ title: String(x.title), text: x.extract.slice(0, 120000), url: `${HOSTS[lang]}/wiki/${encodeURIComponent(String(x.title).replace(/ /g, '_'))}`, order: merged.length });
            }
            merged = merged.filter((x) => !(claim.blocked && claim.blocked.test(x.title)));
        }
        // An article that only shares a word with the topic is not on it.
        let off = false;
        if (topical && lang !== 'hi' && ['explain', 'list', 'define'].includes(asked.kind)) {
            const core = coreOf(asked);
            // A short topic means many things; an article on it has to speak of the subject as well.
            const field = subject && core.length < 3 ? [...new Set(terms(subject))] : [];
            const ours = (p) => p.from || !field.length || (() => { const have = new Set(terms(p.text)); return field.some((w) => have.has(w)); })();
            let on = merged.filter((p) => onTopic(core, p) && ours(p));
            if (!on.length && titles.length > 3) on = (await articles(lang, titles.slice(3), 3)).filter((p) => onTopic(core, p) && ours(p) && !(subject && apart(p)));
            // Beside the article on the heart, one on the regional function of the heart is about less than was asked.
            const named = (p) => [...new Set(terms(p.title))];
            if (on.some((p) => !p.from && named(p).length === core.length && named(p).every((w) => core.includes(w)))) {
                const asks = new Set([...terms(asked.q), ...terms(subject)]);
                on = on.filter((p) => p.from || !core.every((w) => named(p).includes(w)) || named(p).every((w) => asks.has(w) || PLAIN.has(w)));
            }
            if (on.length) merged = on.map((p, order) => ({ ...p, order }));
            else off = true;
        }
        let ranked = rank(asked, merged);
        if (about && typeof Parse === 'object') keepTo(ranked, about, aspect);
        if (claim) return argue(claim, asked, ranked, size, pool, told);
        await judge(asked, ranked);
        if (['why', 'when', 'number', 'who', 'fact'].includes(asked.kind) && titles.length > 3 && !ranked.all.some((x) => x.replies)) {
            // None of these answers, so look at the next ones too.
            const more = (await articles(lang, titles.slice(3), 3)).map((p) => ({ ...p, order: p.order + 1 }));
            const again = rank(asked, [...merged, ...more]);
            await judge(asked, again);
            if (again.all.some((x) => x.replies)) {
                merged = [...merged, ...more];
                ranked = again;
            }
        }
        if (!ranked.all.length) return { asked, parts: [] };
        pool.push(...ranked.all);
        const got = choose(ranked, size);
        return { asked, parts: got.chosen.length ? [{ head: '', ...got }] : [], size, told, sure: !off && sure(asked, got) };
    }

    return { ITEMS, NATURAL, SIZES, answer, asksOf, clean, leans, coreOf, exam, onTopic, judge, shape, calculate, choose, pickTitles, rank, read, sentencesOf, sure, understand, wish };
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

    /** A source number that jumps to the source. */
    const cite = (n) => {
        const sup = el('sup');
        const link = el('a', `[${n}]`);
        link.href = `#source-${n}`;
        sup.append(link);
        return sup;
    };

    // What the site says itself is always told apart from what it quotes.
    const MADE = 'Prepared by VINAS';
    const STUDY = 'Study notes with sources. Write the answer in your own words for exams and assignments.';
    const FACETS = [['definition', 'definition'], ['features', 'features'], ['scope', 'scope'], ['importance', 'importance'], ['objectives', 'objectives'], ['types', 'types'], ['process', 'process'], ['principles', 'principles'], ['functions', 'functions'], ['advantages', 'advantages'], ['limitations', 'limitations'], ['factors', 'factors'], ['effects', 'effects'], ['comparison', 'comparison'], ['relationship', 'relationship'], ['short-note', 'short note'], ['statement', 'claim'], ['statement-conclusion', 'conclusion']];
    const facetName = (f) => (FACETS.find((x) => x[0] === f) || [f, f])[1];
    const press = (text, className, act) => {
        const node = el('button', text);
        node.type = 'button';
        node.className = className;
        node.addEventListener('click', act);
        return node;
    };

    /** The line above an answer that says how the question was read. Each part of it can be changed or removed. Returns it as text. */
    function showQuery(question, result) {
        const home = by('understood');
        const tag = el('span', MADE);
        tag.className = 'made';
        home.replaceChildren(tag);
        const unsure = (what) => {
            const low = el('p', `VINAS is not sure that it read this question right. ${what}`);
            low.className = 'low';
            home.append(low);
        };
        const query = result.query;
        const plan = result.plan || { read: question, fixed: [], notes: [] };
        if (!query || !query.course) {
            const kinds = { compare: 'a comparison', list: 'a list of points', define: 'a definition', why: 'a reason', when: 'a date or time', number: 'a number', who: 'a person', fact: 'one fact', explain: 'an explanation', several: 'several questions' };
            const line = `Understood as ${kinds[result.asked.kind]}. Topic: ${result.asked.topics[0]}${plan.parts && plan.parts.length > 1 ? `. Asked: ${plan.parts.map((x, i) => `(${i + 1}) ${x}`).join(', ')}` : ''}${plan.notes.length ? `. Read as: ${plan.read}` : ''}${plan.fixed.length ? `. Spelling read as: ${plan.fixed.map((x) => x[1]).join(', ')}` : ''}`;
            home.append(line);
            if (query && query.statement && query.confidence < 0.6) unsure('Ask about its topic by name.');
            return line;
        }
        const strong = el('strong', 'Understood as:');
        const row = el('p');
        row.className = 'query';
        row.append(strong, ' ');
        const edit = el('div');
        edit.className = 'edit';
        edit.hidden = true;
        query.parts.forEach((part, i) => {
            const before = query.parts[i - 1];
            const same = before && before.topic === part.topic;
            if (!same) row.append(before ? '; ' : '', `${part.topic[0].toUpperCase()}${part.topic.slice(1)}: `);
            else row.append(', ');
            const extra = part.weight < 1 ? ' (in brief)' : part.weight > 1 ? ' (in detail)' : '';
            const chip = press(`${facetName(part.facet)}${extra}`, 'part', () => change(query, question, i, edit));
            chip.title = 'Change or remove this part';
            row.append(chip);
        });
        const size = query.marks ? `${query.marks} marks (~${result.size} words)` : `about ${result.size} words`;
        row.append(` · ${query.subject || 'Any subject'} · ${size}`);
        if (query.with.length) row.append(` · with ${query.with.join(' and ')}`);
        home.append(row, edit);
        if (query.fixed.length) home.append(el('p', `Spelling read as: ${query.fixed.map((x) => x[1]).join(', ')}.`));
        if (query.confidence < 0.6) unsure('Click a part above to change it, or ask it another way.');
        if (query.alternatives.length) {
            const more = el('p');
            more.className = 'mean';
            for (const x of query.alternatives) {
                const swap = () => run(question, { ...query, parts: x.parts, command: x.command, subject: x.subject || query.subject, code: x.code || query.code, text: x.question || query.text, alternatives: [{ why: x.why, question: query.text, topic: query.parts[0].topic, subject: query.subject, code: query.code, parts: query.parts, command: query.command }] });
                more.append(x.why === 'or' ? 'The other question: ' : 'Did you mean: ', press(x.why === 'or' ? x.question : `${x.topic} (${x.subject})`, 'chip', swap), ' ');
            }
            home.append(more);
        }
        return `${row.textContent}${query.confidence < 0.6 ? '. Not sure that the question was read right.' : ''}`;
    }

    /** The small form that changes one part of a query. */
    function change(query, question, i, edit) {
        const part = query.parts[i];
        const name = el('input');
        name.value = part.topic;
        name.maxLength = 80;
        const facet = el('select');
        for (const [value, text] of FACETS) {
            const option = el('option', text);
            option.value = value;
            option.selected = value === part.facet;
            facet.append(option);
        }
        const again = (parts) => run(question, { ...query, parts, course: true, command: parts.every((p) => p.facet === 'comparison') ? 'compare' : parts.length === 1 && parts[0].facet === 'definition' ? 'define' : query.command === 'define' || query.command === 'compare' ? 'explain' : query.command, confidence: 1 });
        // The parts of a topic that was asked for as a whole now stand alone.
        const apart = (p) => (p.topic === part.topic ? { ...p, whole: false } : p);
        const ok = press('Change', 'ghost', () => {
            const topic = name.value.replace(/\s+/g, ' ').trim() || part.topic;
            again(query.parts.map((p, k) => {
                const x = { ...apart(p), topic: p.topic === part.topic ? topic : p.topic, facet: k === i ? facet.value : p.facet };
                if (k === i || p.topic === part.topic) x.list = false;
                if (x.facet === 'comparison') x.sides = (x.topic === p.topic && p.sides) || (/\sand\s/.test(x.topic) ? x.topic.split(/\s+and\s+(.+)/).slice(0, 2) : null);
                if (x.facet === 'comparison' && !x.sides) x.facet = 'definition';
                return x;
            }));
        });
        const buttons = [ok, press('Remove', 'ghost', () => again(query.parts.filter((p, k) => k !== i).map(apart))), press('Close', 'ghost', () => { edit.hidden = true; })];
        buttons[1].disabled = query.parts.length < 2;
        const labelled = (text, node) => {
            const l = el('label', text);
            l.append(node);
            return l;
        };
        edit.replaceChildren(labelled('Topic', name), labelled('Part', facet), ...buttons);
        edit.hidden = false;
        name.focus();
    }

    /** Builds the answer from text nodes only, so nothing from outside can become a tag. */
    function show(question, result) {
        const sources = [];
        const lines = [`# ${question}`, ''];
        const note = result.sure ? '' : result.asked.kind === 'compare' ? 'Only one of the two was found.'
            : 'Not sure: no right answer was found. The closest sentences may not answer the question. Check the sources, or ask it another way.';
        // The warning goes wherever the answer goes: to the copy, the file and the PDF.
        const gap = result.missing && result.missing.length ? `Not found in sources: ${result.missing.join('; ')}.` : '';
        lines.push(`${MADE}. ${showQuery(question, result)}`, '', STUDY, '');
        if (note) lines.push(`${MADE}. ${note}`, '');
        let body = by('answer-body');
        body.replaceChildren();
        // What may not be the answer is not shown as if it were: it is folded away.
        if (note && result.asked.kind !== 'compare') {
            const fold = el('details');
            fold.append(el('summary', 'Show the closest sentences'));
            body.append(fold);
            body = fold;
            lines.push('Closest sentences:', '');
        }
        by('answer-title').textContent = question;
        for (const part of result.parts) {
            if (part.head) {
                body.append(el('h3', part.head));
                lines.push(`## ${part.head}`, '');
            }
            if (part.note) {
                const made = el('p', `${MADE}: ${part.note}`);
                made.className = 'prepared';
                body.append(made);
                lines.push(`${MADE}: ${part.note}`, '');
            }
            if (part.sub) {
                body.append(el('h4', part.sub));
                lines.push(`### ${part.sub}`, '');
            }
            let section = null;
            let home = null;
            let block = -1;
            for (const s of part.chosen) {
                let n = sources.findIndex((x) => x.url === s.page.url) + 1;
                if (!n) n = sources.push(s.page);
                if (section !== s.section + s.page.url) {
                    section = s.section + s.page.url;
                    home = null;
                    if (s.section) {
                        body.append(el('h4', s.section));
                        lines.push('', `### ${s.section}`, '');
                    }
                }
                const kind = s.item ? 'UL' : 'P';
                if (!home || home.tagName !== kind || (kind === 'P' && block !== s.block)) {
                    home = el(kind);
                    body.append(home);
                    lines.push('');
                }
                block = s.block;
                const spot = s.item ? el('li') : home;
                const text = s.text;
                spot.append(text);
                if (s.item) {
                    home.append(spot);
                    lines.push(`- ${text}`);
                } else if (lines[lines.length - 1] !== '') lines[lines.length - 1] += ` ${text}`;
                else lines.push(text);
                // The source stands once, where the paragraph or list ends.
                const after = part.chosen[part.chosen.indexOf(s) + 1];
                const ends = !after || after.page.url !== s.page.url || after.section !== s.section || Boolean(after.item) !== Boolean(s.item) || (!s.item && after.block !== s.block);
                if (ends) {
                    spot.append(' ', cite(n));
                    lines[lines.length - 1] += ` [${n}]`;
                } else if (!s.item) spot.append(' ');
            }
            lines.push('');
        }
        for (const line of [gap, result.checklist && result.checklist.length ? `To cover: ${result.checklist.join(', ')}.` : ''].filter(Boolean)) {
            const made = el('p', `${MADE}. ${line}`);
            made.className = 'prepared gap';
            by('answer-body').append(made);
            lines.push(`${MADE}. ${line}`, '');
        }
        by('sources').replaceChildren(...sources.map((s, i) => {
            const item = el('li');
            item.id = `source-${i + 1}`;
            const link = el('a', `${s.title}. ${s.from || 'Wikipedia'}${s.licence ? ` (${s.licence})` : ''}`);
            link.href = s.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            item.append(link);
            return item;
        }));
        const day = new Date().toLocaleDateString('en-GB', { dateStyle: 'long' });
        by('answer-text').value = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n\n## Sources\n\n${sources.map((s, i) => `${i + 1}. ${s.title}. ${s.from || 'Wikipedia'}${s.licence ? `, ${s.licence}` : ''}. ${s.url} (read ${day})`).join('\n')}\n\n${[sources.some((x) => !x.from) ? 'Text from Wikipedia, licensed CC BY-SA 4.0.' : '', sources.some((x) => x.from) ? 'Text from open textbooks, under the licence named with each.' : ''].filter(Boolean).join(' ')}\n`;
        const total = result.parts.reduce((n, x) => n + x.words, 0);
        by('answer-size').textContent = `${total} words${result.told && total < 0.7 * result.size ? `. You asked for about ${result.size}, but the sources have no more that fits this question` : ''}`;
        by('ask-note').textContent = note ? `${MADE}. ${note}` : '';
        by('answer').hidden = false;
        by('answer').scrollIntoView();
    }

    document.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-ask]');
        if (!chip) return;
        by('question').value = chip.dataset.ask;
        if (chip.dataset.lang) by('lang').value = chip.dataset.lang;
        box.requestSubmit();
    });
    by('question').addEventListener('keydown', (event) => {
        // Enter asks; Shift and Enter starts a new line.
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            box.requestSubmit();
        }
    });
    const reader = by('reader');
    let patience = 0;
    /** Gets the reader, for a while. The first time it is a download; an answer does not wait for it longer than this. */
    const getReader = async () => {
        if (typeof Judge !== 'object' || Judge.ready() || by('lang').value === 'hi') return;
        if (!Judge.able() || (navigator.connection && navigator.connection.saveData)) return;
        const say = (part) => { reader.textContent = `Getting the reader ready, once only: ${Math.round(100 * part)}%`; };
        say(0);
        const ok = Judge.load(say).then((yes) => {
            reader.textContent = yes ? 'Reader ready' : 'Reader not available here: plain word search is used';
            return yes;
        });
        patience++;
        await Promise.race([ok, new Promise((done) => { setTimeout(done, patience > 1 ? 8000 : 45000); })]);
    };

    // The subjects of the BBA. A subject says which textbooks to look in.
    const subjects = new Map();
    const getSubjects = async () => {
        if (!/^https?:$/.test(location.protocol)) return;
        try {
            const r = await fetch('static/bba.json', { credentials: 'same-origin' });
            if (!r.ok) return;
            const bba = await r.json();
            let group = null;
            for (const c of bba.courses) {
                if (!group || group.label !== c.group) {
                    group = el('optgroup');
                    group.label = c.group;
                    by('subject').append(group);
                    const option = el('option', c.group);
                    option.value = c.group;
                    by('semester').append(option);
                }
                const option = el('option', c.title);
                option.value = c.code;
                group.append(option);
                subjects.set(c.code, c);
            }
            const [glossary, statements] = await Promise.all(['static/glossary.json', 'static/statements.json'].map(async (path) => (await fetch(path, { credentials: 'same-origin' })).json()));
            if (typeof Parse === 'object') Parse.teach({ bba, glossary, statements });
        } catch { /* the page works without them */ }
    };
    // What was asked about last, for "its advantages?".
    let last = '';
    const coreName = (result) => {
        const t = String(result.asked.topics[0] || '').replace(/^(?:the|an?)\s+/i, '');
        const of = /^(?:meaning|types?|kinds?|steps|process|characteristics|features|importance|advantages|disadvantages|functions|objectives|principles|factors|elements|methods|techniques|scope|role|levels?|nature|concept|causes|stages)\s+(?:of|in)\s+(?:the\s+)?(.{2,60})$/i.exec(t);
        return (of ? of[1] : t).slice(0, 60);
    };
    let mend = null;
    /** Mends spelling from the words of the textbooks; a word the reader knows is never changed. */
    const speller = async () => {
        if (mend || typeof Parse !== 'object' || typeof Book !== 'object' || !Book.used.size) return mend;
        const counts = new Map(Book.used);
        for (const c of subjects.values()) for (const u of c.units) for (const t of u.topics) for (const w of t.toLowerCase().match(/[a-z]{4,}/g) || []) counts.set(w, (counts.get(w) || 0) + 1);
        try {
            const r = await fetch('static/vendor/vocab.txt', { credentials: 'same-origin' });
            if (!r.ok) return null;
            for (const w of (await r.text()).split('\n')) if (/^[a-z]{4,}$/.test(w.trim()) && !counts.has(w.trim())) counts.set(w.trim(), 1);
        } catch { return null; }
        mend = Parse.speller(counts);
        return mend;
    };
    /** A link from the course page: #CODE/question. */
    const fromLink = () => {
        const m = /^#([A-Za-z0-9]{0,12})\/(.+)$/.exec(location.hash);
        if (!m) return;
        let question = '';
        try { question = decodeURIComponent(m[2]).slice(0, 300); } catch { return; }
        by('question').value = question;
        by('semester').value = '';
        filter();
        by('subject').value = subjects.has(m[1]) ? m[1] : '';
        by('lang').value = 'en';
        // Asked once: going back or loading again does not ask again.
        history.replaceState(null, '', location.pathname);
        box.requestSubmit();
    };
    // The subject is remembered in this browser only.
    const keep = (name, value) => { try { if (value) localStorage.setItem(name, value); else localStorage.removeItem(name); } catch { /* not allowed here */ } };
    const kept = (name) => { try { return localStorage.getItem(name) || ''; } catch { return ''; } };
    /** Shows the subjects of one semester, or all. */
    const filter = () => {
        const group = by('semester').value;
        for (const g of by('subject').querySelectorAll('optgroup')) g.hidden = g.disabled = Boolean(group) && g.label !== group;
        const c = subjects.get(by('subject').value);
        if (group && c && c.group !== group) by('subject').value = '';
    };
    by('semester').addEventListener('change', () => {
        filter();
        keep('vinas-semester', by('semester').value);
        keep('vinas-subject', by('subject').value);
    });
    by('subject').addEventListener('change', () => keep('vinas-subject', by('subject').value));
    const taught = getSubjects().then(() => {
        const [semester, code] = [kept('vinas-semester'), kept('vinas-subject')];
        if ([...by('semester').options].some((x) => x.value === semester)) by('semester').value = semester;
        filter();
        const c = subjects.get(code);
        if (c && (!semester || c.group === semester)) by('subject').value = code;
    });
    taught.then(fromLink);
    window.addEventListener('hashchange', fromLink);

    box.addEventListener('submit', (event) => {
        event.preventDefault();
        run(by('question').value.replace(/\s+/g, ' ').trim());
    });
    /** Answers a question; a query that was changed by hand is taken as it is. */
    async function run(question, given = null) {
        if (button.disabled) return;
        by('answer').hidden = true;
        by('sum').hidden = true;
        by('ask-note').textContent = '';
        if (question.length < 2) {
            by('ask-note').textContent = 'Type a question first.';
            return;
        }
        const done = given ? null : Ask.calculate(question);
        if (done) {
            by('sum').textContent = `${done.sum} = ${done.value.toLocaleString('en-IN', { maximumFractionDigits: 10 })}`;
            by('sum').hidden = false;
            return;
        }
        if (!given && typeof Parse === 'object' && Parse.sum(question)) {
            by('ask-note').textContent = 'This is a problem to work out from figures. This site explains topics but does not solve numerical problems. Ask about the method instead, for example: Explain standard deviation.';
            return;
        }
        button.disabled = true;
        button.textContent = 'Reading...';
        by('busy').hidden = false;
        try {
            await getReader();
            await taught;
            const subject = subjects.get(by('subject').value);
            const english = by('lang').value !== 'hi';
            if (english && typeof Judge === 'object' && Judge.ready() && typeof Book === 'object') await Book.load(subject && subject.books.length ? subject.books : undefined);
            const known = english ? await speller() : null;
            const query = given || (english && typeof Parse === 'object') ? given || Parse.query(question, { known, before: last, subject: subject ? subject.code : '' }) : null;
            const guess = !subject && query && query.course ? subjects.get(query.code) || null : null;
            const result = await Ask.answer(question, by('lang').value, Ask.SIZES[by('size').value] || 0, { known, query, before: last, format: by('format').value, books: subject ? subject.books : guess ? guess.books : null, subject: subject ? subject.title : '' });
            result.query = query;
            if (result.parts.length && result.sure) last = query && query.course && query.parts.length ? query.parts[query.parts.length - 1].topic : coreName(result);
            if (result.parts.length) show(question, result);
            else by('ask-note').textContent = 'Nothing was found for this question. Use the main words of the topic, and check the spelling.';
        } catch (error) {
            by('ask-note').textContent = error.plain ? error.message : 'Wikipedia could not be reached. Check your connection and try again.';
        } finally {
            button.disabled = false;
            button.textContent = 'Find the answer';
            by('busy').hidden = true;
        }
    }
})();
