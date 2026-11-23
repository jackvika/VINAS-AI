// Rebuilds sentences the way a person would say them. Each rule keeps every word that carries a fact.
// It works on text whose code, links and quotations are already protected by the engine.
const Brain = (() => {
    const SUBJECT = '(?:we|you|they|he|she|it|I|people|companies|teams|businesses|users|the \\p{L}+)';
    const MODAL = '(?:can|will|could|may|might|should)';
    const ACTIVE = {
        founded: 'founded', built: 'built', established: 'set up', created: 'created', launched: 'launched', designed: 'designed', developed: 'developed',
        introduced: 'introduced', opened: 'opened', discovered: 'discovered', invented: 'invented', published: 'published', directed: 'directed',
        produced: 'produced', commissioned: 'commissioned', written: 'wrote', painted: 'painted', composed: 'composed', led: 'led',
    };
    const BASE = {
        maintaining: 'maintain', shaping: 'shape', improving: 'improve', reducing: 'reduce', building: 'build', creating: 'create', supporting: 'support',
        preventing: 'prevent', promoting: 'promote', protecting: 'protect', driving: 'drive', keeping: 'keep', making: 'make', developing: 'develop',
        determining: 'decide', regulating: 'regulate', helping: 'help', managing: 'manage', connecting: 'connect', strengthening: 'strengthen', understanding: 'understand',
    };
    const doers = Object.keys(ACTIVE).join('|');
    const Doers = Object.keys(ACTIVE).map((w) => w[0].toUpperCase() + w.slice(1)).join('|');
    // A maker is a name or a person, not "hand", "accident" or a date.
    const MAKER = '(?:\\p{Lu}|the |an? (?=\\p{Ll}))[^,;:]{2,56}?';
    const PEOPLE = 'users|people|teams|you|us|them|developers|customers|businesses|companies|students|employees|readers|visitors|writers|everyone|organizations|teachers|patients|workers|families|learners|doctors|farmers';

    // Whole-sentence shapes: [pattern, rebuild]. The sentence arrives without its full stop. Only one fires per sentence.
    const SHAPES = [
        // "Although X, Y" => "X, but Y"
        [/^(?:Although|Though|Even though) (?!\p{L}+ing\b)([^,;:]{10,140}), ((?!and\b|but\b)[^;:]{8,})$/u, (m) => `${ucfirst(m[1])}, but ${m[2]}`],
        // "While X has..., Y": only where While means "although", not "during"
        [/^While (?!(?:you|we|he|she|they|it|I)\b|\p{L}+ing\b)([^,;:]{10,140}), ((?:\S+ ){1,6}?(?:is|are|was|were|has|have|had|can|could|will|would|may|might|must|remains?|continues?|offers?|outweighs?|far)\b[^;:]{4,})$/u,
            (m) => (/\b(?:is|are|was|were) \p{L}+ing\b/u.test(m[1]) || !/\b(?:has|have|had|is|are|was|were|may|might|can|remain|remains|persist|exist|exists|offers?|seems?)\b/.test(m[1]) ? null : `${ucfirst(m[1])}, but ${m[2]}`)],
        // "By doing X, we can Y" => "We can Y by doing X"
        [new RegExp(`^By (\\p{L}+ing\\b[^;:]{8,220}), (${SUBJECT}) (${MODAL}) ([^,;:]{5,120})$`, 'u'), (m) => `${ucfirst(m[2])} ${m[3]} ${m[4]} by ${m[1]}`],
        // "With X, you can Y" => "You can Y with X"
        [new RegExp(`^With ([^;:]{8,160}), (you|we|they|it|he|she) (${MODAL}) ([^,;:]{5,100})$`, 'u'), (m) => `${ucfirst(m[2])} ${m[3]} ${m[4]} with ${m[1]}`],
        // "From A to B, Y" => "Y, from A to B"
        [/^From ([^,;:]{4,80} to [^,;:]{3,80}), ([^;:]{12,})$/u, (m) => `${ucfirst(m[2])}, from ${m[1]}`],
        // "Whether you're A or B, Y" => "Y, whether you're A or B"
        [/^Whether ((?:you|they|we|it)(?:['’]re| are|['’]s| is) [^;:]+ or [^;:]+), ((?:the|this|our|we|you|it|they|there|\p{Lu})[^,;:]{8,140})$/u, (m) => `${ucfirst(m[2])}, whether ${m[1]}`],
        // "Founded by B in 1526, it became Y" => "B founded it in 1526, and it became Y"
        [new RegExp(`^(${Doers}) by (${MAKER})( in \\d{4})?, (it|he|she|they|the [^,;:]{2,40}?) (?=(?:is|was|became|has|had|grew|soon|quickly|now|became|remains|offers|helps|shows)\\b)([^;:]{8,})$`, 'u'),
            (m) => `${ucfirst(m[2])} ${ACTIVE[m[1].toLowerCase()]} ${m[4]}${m[3] || ''}, and ${/^(?:it|he|she|they)$/.test(m[4]) ? m[4] : 'it'} ${m[5]}`],
        // "The T, built by S, shows Y" => "S built the T, which shows Y"
        [new RegExp(`^(The|A|An|This) ([^,;:]{2,50}), (${doers}) by (${MAKER}), ((?:is|was|has|had|shows|became|remains|stands|draws|attracts|can|will)\\b[^;:]{4,})$`, 'u'),
            (m) => `${ucfirst(m[4])} ${ACTIVE[m[3]]} ${m[1].toLowerCase()} ${m[2]}, which ${m[5]}`],
        // "There are many X that do Y" => "Many X do Y"
        [/^There are (several|many|some|a few|two|three|four|five) ([^,;:]{3,50}?) (?:that|who) ([^;:]{6,})$/u, (m) => `${ucfirst(m[1])} ${m[2]} ${m[3]}`],
        // "Introducing the X, a Y" => "The X is a Y"
        [/^Introducing (the |our |my )?([^,;:]{2,50}), (an? [^;:]{5,})$/u, (m) => `${ucfirst((m[1] || '') + m[2])} is ${m[3]}`],
        // "Not only does X do Y, but it also does Z" => "X does Y, and it also does Z"
        [/^Not only does ([^,;:]{2,40}?) (\p{Ll}+) ([^,;:]{3,80}), but (it|he|she) also ([^;:]{4,})$/u, (m) => `${ucfirst(m[1])} ${third(m[2])} ${m[3]}, and ${m[4]} also ${m[5]}`],
        // "In addition to X, Y also Z" => "Besides X, Y also Z"
        [/^(?:In addition to|Aside from|Apart from) ([^,;:]{3,80}), ([^;:]{8,})$/u, (m) => `Besides ${m[1]}, ${m[2]}`],
        // "When it comes to X, Y" => "For X, Y"
        [/^When it comes to ([^,;:]{3,60}), ([^;:]{8,})$/u, (m) => `For ${m[1]}, ${m[2]}`],
    ];

    // Turns inside a sentence. All that match fire.
    const TURNS = [
        [/\b(is|was) (?:an?|the) (?:\p{Ll}+ )?(?:process|method|mechanism|means|way) (?:by|through|in) which\b/gu, (m) => `${m[1]} how`],
        [/, as (it|they|this|these|we|you|he|she) (?!(?:do|does|did|always|usually|often|once|used)\b)(?=\p{Ll})/gu, (m) => ` because ${m[1]} `],
        [/, making (it|them) (?=(?:an?|the|ideal|perfect|easy|easier|hard|harder|possible|suitable|useful|great|good|safe|popular|one)\b)/gu, (m) => (m[1] === 'it' ? ", so it's " : ", so they're ")],
        [new RegExp(`, (?:allowing|enabling) (${PEOPLE}) to `, 'gu'), (m) => `, so ${{ us: 'we', them: 'they' }[m[1]] || m[1]} can `],
        [new RegExp(`\\b(?:offers|gives|provides) (${PEOPLE}) the (?:flexibility|ability|freedom|opportunity|chance|power) to\\b`, 'gu'), (m) => `lets ${m[1]}`],
        [new RegExp(`\\b(?:offer|give|provide) (${PEOPLE}) the (?:flexibility|ability|freedom|opportunity|chance|power) to\\b`, 'gu'), (m) => `let ${m[1]}`],
        [new RegExp(`\\bplays a (?:\\p{Ll}+ )?(?:role|part) in (${Object.keys(BASE).join('|')})\\b`, 'gu'), (m) => `helps ${BASE[m[1]]}`],
        [new RegExp(`\\bplay a (?:\\p{Ll}+ )?(?:role|part) in (${Object.keys(BASE).join('|')})\\b`, 'gu'), (m) => `help ${BASE[m[1]]}`],
        [new RegExp(`\\bwill play an increasingly (?:important|big|vital) (?:role|part) in (${Object.keys(BASE).join('|')})\\b`, 'gu'), (m) => `will do more to ${BASE[m[1]]}`],
        [/\b(must|should|need to) be (?:carefully|properly|thoughtfully) (?:addressed|considered|managed)\b/gu, (m) => `${m[1]} be handled with care`],
        [/\ballocate ((?:an? |another |about )?(?:additional )?[$€£₹]?[\d,.]+(?: \p{Ll}+)?) (?:towards?|to)\b/gu, (m) => `put ${m[1].replace('an additional', 'another')} into`],
        [/\bthe benefits of ((?:(?!far\b|greatly\b)\p{Ll}+ ){0,3}(?!far\b|greatly\b)\p{Ll}+[^s\s]) (?:far |greatly )?outweigh (?:its|the) (drawbacks|risks|costs|disadvantages)\b/gu, (m) => `${m[1]} has more benefits than ${m[2]}`],
    ];

    function third(verb) {
        if (/(?:s|x|z|ch|sh)$/.test(verb)) return `${verb}es`;
        if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
        return { have: 'has', do: 'does', go: 'goes' }[verb] || `${verb}s`;
    }

    function sentence(s) {
        const m = /^([\s\S]*?)(\.)?$/u.exec(s);
        const body = m[1];
        for (const [pattern, rebuild] of SHAPES) {
            const hit = pattern.exec(body);
            const next = hit && rebuild(hit);
            if (next) return next + (m[2] || '');
        }
        return s;
    }

    /** @param {Humanizer} engine logs each change so the reader can review it */
    function rewrite(engine, text) {
        return text.split('\n').map((line) => {
            if (/^\s*(?:#|>|\||[-*] |\d+\. )/.test(line)) return line;
            for (const [pattern, rebuild] of TURNS) {
                line = engine.replace(31, new RegExp(pattern.source, pattern.flags), rebuild, line);
            }
            return line.split(/((?<=[.!?])\s+)/u).map((s) => {
                const next = sentence(s);
                if (next !== s) engine.log(31, s, next);
                return next;
            }).join('');
        }).join('\n');
    }

    return { rewrite };
})();
