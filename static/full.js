// Full rewrite through this site's own server, which holds the AI key. Hosts without the server simply do not offer it.
const Full = (() => {
    const ROUNDS = 2;
    let max = 6000;

    async function ready() {
        try {
            const response = await fetch('api/health.php', { cache: 'no-store' });
            const body = await response.json();
            if (body.max) max = body.max;
            return response.ok && body.ai === true;
        } catch {
            return false; // A static host sends the file itself, which is not JSON.
        }
    }

    async function ask(body) {
        let response;
        try {
            response = await fetch('api/humanize.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } catch {
            throw new Error('Could not reach the server.');
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok || typeof data.text !== 'string') throw new Error(data.error || 'The server is waking up. Try again in a minute.');
        return data.text;
    }

    function review(engine, original, answer, type) {
        const missing = engine.missing(original, answer);
        const added = engine.missing(answer, original);
        const tells = engine.inspect(answer, type);
        const short = count(original, WORD) >= 40 && count(answer, WORD) < count(original, WORD) * 0.45;
        const problems = [];
        if (missing.length) problems.push(`These details from the original are missing. Put each one back, unless you only wrote it another way: ${missing.join(', ')}`);
        if (added.length) problems.push(`These are not in the original. Remove each one, unless it is the same fact written another way: ${added.join(', ')}`);
        if (short) problems.push('The rewrite is much shorter than the original. Restore the claims you dropped.');
        for (const t of tells.slice(0, 12)) problems.push(`"${t.text.slice(0, 120)}" still reads like AI writing (${RULES.patterns[t.pattern][0]}). ${RULES.patterns[t.pattern][1]}`);
        return { text: answer, problems, score: 3 * missing.length + 3 * added.length + tells.length + (short ? 10 : 0) };
    }

    async function rewrite(engine, text, { type, sample }, status) {
        const original = trim(text);
        if ([...original].length > max) throw new Error(`Full rewrite takes up to ${max.toLocaleString('en')} characters at a time.`);
        const job = { text: original, kind: type, sample: [...sample].slice(0, 3000).join('') };
        status('Rewriting. This can take up to a minute.');
        let current = review(engine, original, await ask(job), type);
        let best = current;
        let rounds = 0;
        while (current.score > 0 && rounds < ROUNDS) {
            rounds++;
            status(`Checking facts and fixing what is left (${rounds} of ${ROUNDS}).`);
            try {
                current = review(engine, original, await ask({ ...job, previous: current.text, problems: current.problems }), type);
            } catch {
                break; // Keep the good answer already in hand.
            }
            if (current.score < best.score) best = current;
        }
        return { text: best.text, rounds };
    }

    return { ready, rewrite };
})();
