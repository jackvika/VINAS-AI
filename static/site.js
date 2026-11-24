// Runs the rewrite and check pages.
const engine = new Humanizer(DATA.rules);
const names = { ...DATA.rules.patterns, 0: ['Voice match', 'Matched to your sample.'] };
const byId = (id) => document.getElementById(id);

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function highlight(text, flags) {
    let out = '';
    let at = 0;
    for (const f of flags) {
        const [name, advice] = names[f.pattern];
        out += esc(text.slice(at, f.start)) + `<mark title="${esc(`${name}: ${advice}`)}">${esc(text.slice(f.start, f.end))}</mark>`;
        at = f.end;
    }
    return out + esc(text.slice(at));
}

function tag(n) {
    return n ? `<a class="tag" href="guide.html#p${n}">${n}. ${esc(names[n][0])}</a>` : '<span class="tag">Voice match</span>';
}

function tells(list) {
    return `<ul class="list">${list.map((f) => `<li>${tag(f.pattern)} <mark>${esc(f.text)}</mark><span>${esc(names[f.pattern][1])}</span></li>`).join('')}</ul>`;
}

function tooLong(...texts) {
    return texts.some((t) => [...t].length > DATA.max) ? `Keep each box under ${DATA.max.toLocaleString('en')} characters.` : '';
}

function showError(message) {
    const old = document.querySelector('p.error[data-form]');
    if (old) old.remove();
    if (message) document.querySelector('form').insertAdjacentHTML('beforebegin', `<p class="error" role="alert" data-form>${esc(message)}</p>`);
}

function show(section) {
    const old = byId(section.id);
    if (old) old.remove();
    document.querySelector('footer').before(section);
    section.scrollIntoView();
}

function section(id, html) {
    const node = document.createElement('section');
    node.id = id;
    node.innerHTML = html;
    return node;
}

function pdfButton(text, source, name) {
    return trim(text) === '' ? '' : `<button type="button" class="pdf" data-pdf="${source}" data-name="${esc(name)}">Download PDF</button>`;
}

// The brain runs on the site's server. Pages opened without one, such as on GitHub Pages, use the rules alone.
const api = (path, options, ms) => fetch(path, { ...options, credentials: 'same-origin', signal: AbortSignal.timeout(ms) }).then((r) => {
    if (r.status === 401) location.reload();
    if (!r.ok) {
        const said = r.json().then((x) => String(x.error || '').slice(0, 200), () => '');
        return said.then((text) => { throw Object.assign(new Error(`The server answered ${r.status}.`), { status: r.status, said: text, busy: r.status === 429 || r.status === 503 }); });
    }
    return r.json();
});
let awake = null;
let hasWriter = false;

/** Asks once whether there is a brain. No text is sent, and the request wakes a sleeping server. */
function wake() {
    if (!awake) {
        awake = /^https?:$/.test(location.protocol)
            ? api('api/health', {}, 90000).then((x) => {
                hasWriter = x.writer === true;
                return x.ok === true;
            }).catch(() => false)
            : Promise.resolve(false);
        awake.then((ok) => { if (!ok) awake = null; });
    }
    return awake;
}

/** Tells the writer how to mend its last version. */
function mend(why) {
    if (why.startsWith('lost ') && !/too much|a link|its subject/.test(why)) return `It left out "${why.slice(5)}"`;
    if (why.startsWith('invented ')) return `It added "${why.slice(9)}", which is not in the original`;
    return {
        'lost too much meaning': 'It left out points of the original', 'added too much': 'It added things that are not in the original', 'too long': 'It was too long', 'too short': 'It left out points of the original',
        'barely changed': 'It copied the sentences of the original', 'changed a yes to a no': 'It changed a yes to a no, or a no to a yes', 'claims too much': 'It dropped "one of the"', 'changed a quotation': 'It changed a quotation',
        'lost its subject': 'It did not name who or what the first sentence is about', 'lost a link': 'It left out a link or address', 'changed how much': 'It changed how much or how many, such as all to almost all', 'repeats a phrase': 'It said the same thing twice', 'repeats a word': 'It repeated a word',
    }[why] || '';
}

const pause = (ms) => new Promise((done) => { setTimeout(done, ms); });

/** Has the AI writer write every part again, and keeps the first version that passes both checks. */
async function rewriteAll(text, options, tell, stopped) {
    const pieces = Checker.pieces(text, 170);
    const jobs = pieces.filter((p) => p.write);
    const limit = { light: 0.92, normal: 0.8, strong: 0.7, deep: 0.7 }[options.level] ?? 0.8;
    const overused = [0, 0];
    let written = 0;
    let trouble = '';
    const words = (options.sample.match(WORD) || []).length;
    const sample = words >= 20 ? options.sample.slice(0, 2000) : '';
    let notes = options.notes.split('\n').map((n) => n.trim()).filter(Boolean);
    for (const [done, p] of jobs.entries()) {
        if (stopped()) break;
        const before = pieces.slice(0, pieces.indexOf(p)).map((x) => x.text + x.end).join('');
        tell(done, jobs.length, before);
        let best = null;
        let hint = '';
        for (let attempt = 0; attempt < 3 && !stopped(); attempt++) {
            let out;
            const listed = p.items ? p.items.map((x, i) => `[${i + 1}] ${x.label ? `(${x.label}) ` : ''}${x.body}`).join('\n') : '';
            try {
                const body = JSON.stringify({
                    text: listed || p.text, items: Boolean(p.items), type: options.type, level: options.level, contractions: !options.fullForms, hint, attempt, sample,
                    notes: p.items ? '' : notes.join('\n'), context: before.trim().slice(-900),
                });
                out = await api('api/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, 240000);
            } catch (error) {
                trouble = error.said || 'The AI writer could not be reached.';
                if (error.status === 503 && attempt < 2) {
                    await pause(3000);
                    continue;
                }
                break;
            }
            trouble = '';
            if (!out || typeof out.text !== 'string') break;
            const issue = String(out.issue || '');
            const stock = Array.isArray(out.stock) && out.stock.length === 2 ? out.stock.map(Number) : null;
            const countStock = () => {
                if (stock && stock.every(Number.isFinite)) stock.forEach((n, i) => { overused[i] += n; });
            };
            if (p.items) {
                const bodies = Checker.readItems(out.text, p.items.length);
                if (!bodies) {
                    hint = 'It did not give one line for each item';
                    continue;
                }
                // Each point is checked alone, so one bad point does not cost the others.
                const good = bodies.map((b, i) => {
                    const version = Checker.clean(b, p.items[i].body);
                    const ok = Checker.judge(p.items[i].body, version, { limit: 1.01, keep: 0.2, add: 0.8, least: 0.4 });
                    return ok.ok ? version : p.items[i].body;
                });
                const same = Checker.sameness(good);
                hint = issue || (same ? `Too many items say "${same}"` : '');
                if (issue === '' && (!same || attempt === 2)) {
                    best = p.items.map((x, i) => x.prefix + good[i] + x.end).join('');
                    countStock();
                    break;
                }
                continue;
            }
            const version = Checker.clean(out.text, p.text);
            const verdict = Checker.judge(p.text, version, { limit, keep: 0.25, add: 0.75, extra: notes.join('\n') });
            hint = verdict.ok ? issue : mend(verdict.why);
            // A version with a doubt about its meaning is never used.
            if (verdict.ok && issue === '') {
                if (!best) countStock();
                best = best || version;
                // The author asked for their own facts, so a version without any is only the second choice.
                const told = !notes.length || notes.some((n) => Checker.tells(version, n));
                if (told) {
                    best = version;
                    break;
                }
                hint = "It left out the author's own facts, which have to be told";
            }
        }
        if (best) {
            // The text appears as if typed.
            const step = Math.max(2, Math.round(best.length / 120));
            for (let i = step; i < best.length && !stopped(); i += step) {
                tell(done, jobs.length, before + best.slice(0, i));
                await pause(16);
            }
            p.text = best;
            // A fact is told once.
            notes = notes.filter((n) => !Checker.tells(best, n));
            written++;
        }
        if (trouble) break;
    }
    return { text: pieces.map((p) => p.text + p.end).join(''), written, total: jobs.length, stopped: stopped(), trouble, unused: written ? notes : [], overused };
}

/** Lets the brain finish what the rules started. Returns why it could not, or an empty string. */
async function think(r, options) {
    const offline = 'The brain could not be reached, so only the built-in rules were used.';
    if (r.held || trim(r.text) === '') return '';
    if (!await wake()) return offline;
    let out;
    try {
        const contractions = options.fullForms || (r.voice && r.voice.contractions === 'long') ? false : null;
        const body = JSON.stringify({ text: r.text, type: options.type, sample: options.sample, contractions, level: options.level });
        out = await api('api/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, 60000);
    } catch (error) {
        return error.busy ? 'The brain is busy, so only the built-in rules were used. Wait a minute and press Humanize again.' : offline;
    }
    // A change that loses a fact is worse than no change.
    const valid = out && typeof out.text === 'string' && Array.isArray(out.edits) && Array.isArray(out.stiff);
    if (!valid || trim(out.text) === '' || engine.missing(r.text, out.text).length) return offline;
    r.text = out.text;
    for (const e of out.edits) r.edits.push({ pattern: 32, before: String(e.before), after: String(e.after) });
    r.flags = engine.flags(r.text);
    r.stiff = out.stiff.map(String);
    return '';
}

async function readFile(file) {
    if (!/\.(?:txt|md|markdown)$/i.test(file.name)) throw new Error('Upload a .txt or .md file. For Word or PDF, paste the text instead.');
    if (file.size > DATA.max * 4) throw new Error(`Keep the file under ${DATA.max.toLocaleString('en')} characters.`);
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    } catch {
        throw new Error('That text is not valid UTF-8. Copy it again as plain text.');
    }
}

function renderRewrite(r, text, fileName) {
    const edits = r.edits.length;
    const left = r.flags.length;
    let note = '';
    if (r.held) note = 'Only one kind of tell was found. In informal text that is not enough to act on, so nothing was changed.';
    else if (r.text === '') note = 'Every sentence matched a filler pattern, so nothing is left. Add a concrete fact and try again.';
    else if (!edits && !left && !r.wrote) note = 'No tells this site can detect were found. Your text is unchanged.';

    for (const extra of [r.writer, r.brain]) if (extra) note = `${note ? `${note} ` : ''}${extra}`;

    let voice = '';
    if (r.voice) {
        const habit = { short: 'uses contractions', long: 'avoids contractions', mixed: 'mixes contractions and full forms' }[r.voice.contractions];
        const gap = engine.averageSentence(r.text) - r.voice.sentence;
        voice = `<p class="note">Your sample: about ${r.voice.sentence} words per sentence, ${r.voice.dashes ? 'uses dashes' : 'no dashes'}, ${habit}.`
            + (Math.abs(gap) > 5 ? ` Your result averages ${Math.abs(gap)} words ${gap > 0 ? 'more; try splitting some sentences' : 'fewer; try joining some sentences'}.` : '') + '</p>';
    }
    const node = section('result', `
        <div class="bar">
            <h2>Humanized text</h2>
            <span class="actions">
                <span id="pdf-slot"></span>
                <button type="button" class="ghost" data-copy="output">Copy</button>
                <button type="button" class="ghost" data-download="output" data-name="${esc(fileName || 'humanized-text.txt')}">Download text</button>
                <button type="button" class="ghost" data-reuse="output">Edit and check again</button>
            </span>
        </div>
        <p class="stats" id="stats"></p>
        ${note ? `<p class="note">${esc(note)}</p>` : ''}
        <p class="error" role="alert" id="lost" hidden></p>
        <div class="output" id="shown"></div>
        <textarea id="output" class="source" readonly tabindex="-1" aria-hidden="true"></textarea>
        <details class="compare"${r.wrote ? ' open' : ''}><summary>Compare with your original</summary>
            <div class="sides"><div><h3>Original</h3><div class="output">${esc(text)}</div></div><div><h3>New</h3><div class="output" id="side"></div></div></div>
        </details>
        ${voice}
        <div id="finish"></div>
        ${r.first !== null ? `<details><summary>First rewrite, and the ${r.survived.length} tells that survived it</summary><div class="output">${highlight(r.first, r.survived)}</div></details>` : ''}
        ${edits ? `<details><summary>What was fixed (${edits})</summary><ul class="list">${r.edits.map((c) => `<li>${tag(c.pattern)} <del>${esc(c.before)}</del>${c.after ? ` <ins>${esc(c.after)}</ins>` : ''}</li>`).join('')}</ul></details>` : ''}`);
    show(node);
    finishEditor(node, r, text, fileName);
}

/** The choices a phrase offers, with the case of the phrase. */
function choices(phrase) {
    for (const [pattern, options] of Object.entries(RULES.suggest)) {
        const m = rx('^(?:' + apos(pattern) + ')$', 'i').exec(phrase);
        if (m) return options.map((o) => likeCase(phrase, o.replace(/\$(\d)/g, (_, n) => m[n] || '')));
    }
    return [];
}

/** Lets the writer settle each highlighted phrase and add their own details. */
function finishEditor(node, r, original, fileName) {
    let current = r.text;
    let done = 0;
    const history = [];
    const kept = new Set();
    const withTips = byId('strength').value === 'human';
    let jobs = [];

    function listJobs() {
        const flags = engine.flags(current);
        const list = flags.map((f) => ({ kind: 'flag', start: f.start, end: f.end, text: f.text, pattern: f.pattern, advice: names[f.pattern][1] }));
        const stiff = (r.stiff || []).map((s) => ['stiff', s]);
        for (const [kind, quote] of withTips ? [...engine.tips(current), ...stiff] : []) {
            const start = quote === '' ? current.length : current.indexOf(quote);
            if (start >= 0) list.push({ kind, start, end: start + quote.length, text: quote, pattern: 0, advice: RULES.tips[kind] });
        }
        // One sentence needs only one reason to rewrite it.
        const whole = new Set();
        return {
            flags,
            list: list.filter((j) => {
                const again = ['long', 'even', 'stiff'].includes(j.kind) && whole.has(j.text);
                whole.add(j.text);
                return !again && !kept.has(j.kind + j.text);
            }),
        };
    }

    /** True where cutting the phrase leaves a whole sentence: an aside, or a describing word before its noun. */
    function removable(j) {
        const before = current.slice(0, j.start);
        const after = current.slice(j.end);
        const opens = /(?:^|[.!?;:,(]\s|\n)$/.test(before);
        const closes = /^(?:[,.;!?)\n]|$)/.test(after);
        // A whole sentence, an opener with its comma, or an aside between commas.
        if (opens && closes && !(/(?:^|[.!?]\s|\n)$/.test(before) && !after.startsWith(','))) return true;
        const describes = /^(?:actually|quietly|innovative|sleek|stunning|breathtaking|fascinating|unparalleled|world-class|robust|valuable|iconic|unforgettable|must-see|must-visit|renowned|profound|profoundly)$/i.test(j.text);
        return describes && /^ \p{L}/u.test(after) && !/^ (?:and|or|but|for)\b/.test(after) && (/(?:actually|quietly|profoundly)/i.test(j.text) || !rx(PREDICATE, 'i').test(before));
    }

    function item(j, i) {
        const long = ['long', 'even', 'stiff'].includes(j.kind);
        const field = long
            ? `<textarea rows="3" aria-label="${esc(RULES.ask[j.kind])}">${esc(j.text)}</textarea>`
            : `<input type="text" aria-label="${esc(RULES.ask[j.kind])}" placeholder="${esc(RULES.ask[j.kind])}">`;
        return `<li data-job="${i}">
            ${j.pattern ? tag(j.pattern) : ''}${j.text ? `<mark>${esc(j.text)}</mark>` : ''}<span>${esc(j.advice)}</span>
            <div class="choose">
                ${j.kind === 'flag' ? choices(j.text).map((c) => `<button type="button" class="chip" data-use="${esc(c)}">${esc(c)}</button>`).join('') : ''}
                ${j.kind === 'flag' && removable(j) ? '<button type="button" class="chip" data-use="">Delete it</button>' : ''}
                <button type="button" class="chip" data-keep>${j.text ? 'Keep' : 'Skip'}</button>
            </div>
            <div class="own">${field}<button type="button" class="ghost" data-own>${j.text ? 'Replace' : 'Add'}</button></div>
        </li>`;
    }

    function draw() {
        const state = listJobs();
        jobs = state.list;
        const was = engine.metrics(original);
        const now = engine.metrics(current);
        byId('output').value = current;
        byId('side').textContent = current;
        byId('shown').innerHTML = highlight(current, state.flags.filter((f) => !kept.has('flag' + f.text)));
        byId('pdf-slot').innerHTML = pdfButton(current, 'output', fileName || 'humanized-text');
        byId('stats').innerHTML = `<span><b>${r.edits.length}</b> fixed for you</span><span><b>${done}</b> by you</span><span><b>${jobs.length}</b> left</span>`
            + `<span><b>${was.variety} → ${now.variety}</b> sentence variety</span><span><b>${was.ease} → ${now.ease}</b> reading ease</span>`
            + `<span><b>${r.sections} of ${r.sections}</b> sections reviewed</span>`;
        const lost = engine.missing(original, current);
        byId('lost').hidden = lost.length === 0;
        byId('lost').textContent = `Check these details, which are no longer in the result: ${lost.join(', ')}`;
        byId('finish').innerHTML = jobs.length || history.length
            ? `<div class="bar"><h3>Finish it yourself</h3>${history.length ? '<button type="button" class="ghost" data-undo>Undo</button>' : ''}</div>
               <p class="muted">${jobs.length ? 'Your own choices and details are what make it yours. Pick a word, type your own, or keep it.' : 'All done. Read it aloud once before you use it.'}</p>
               <ul class="list">${jobs.map(item).join('')}</ul>` : '';
    }

    /** Puts new words in place of a job's phrase and tidies the spacing around a removal. */
    function apply(j, words) {
        history.push([current, done, [...kept]]);
        let before = current.slice(0, j.start);
        let after = current.slice(j.end);
        if (j.text === '') {
            current = `${trim(current)} ${words}`;
        } else {
            if (words === '') {
                // "is, actually, fine" => "is fine"
                if (/, $/.test(before) && /^, /.test(after)) before = before.replace(/, $/, ' ');
                if (/ an? $/i.test(before)) before = before.replace(/(an?) $/i, (_, a) => `${articleFor(a, after.trimStart())} `);
                after = after.replace(/^,? /, (gap) => (before === '' || /[\s(]$/.test(before) ? '' : gap));
                if (/^[.,;!?]/.test(after)) before = before.replace(/,? $/, '');
                if (/(?:^|[.!?]\s|\n)$/.test(before)) after = ucfirst(after);
            }
            current = before + words + after;
        }
        done++;
        draw();
    }

    node.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.undo !== undefined) {
            const [text, count, keep] = history.pop();
            current = text;
            done = count;
            kept.clear();
            keep.forEach((k) => kept.add(k));
            draw();
            return;
        }
        const row = button.closest('[data-job]');
        if (!row) return;
        const j = jobs[Number(row.dataset.job)];
        if (button.dataset.use !== undefined) {
            apply(j, button.dataset.use);
        } else if (button.dataset.keep !== undefined) {
            history.push([current, done, [...kept]]);
            kept.add(j.kind + j.text);
            draw();
        } else if (button.dataset.own !== undefined) {
            const words = trim(row.querySelector('.own input, .own textarea').value);
            if (words !== '' && words !== j.text) apply(j, words);
        }
    });
    node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.matches('.own input')) {
            event.preventDefault();
            event.target.closest('.own').querySelector('[data-own]').click();
        }
    });
    draw();
}

function renderCheck(original, rewrite) {
    const missing = engine.missing(original, rewrite);
    const added = engine.missing(rewrite, original);
    const before = engine.inspect(original).length;
    const left = engine.inspect(rewrite);
    show(section('report', `
        <div class="bar"><h2>Report</h2>${pdfButton(rewrite, 'rewrite', 'rewrite')}</div>
        <p class="stats">
            <span><b>${before} → ${left.length}</b> tells</span>
            <span><b>${missing.length}</b> details missing</span>
            <span><b>${added.length}</b> details added</span>
        </p>
        ${missing.length ? `<p class="error">Missing from the rewrite: ${esc(missing.join(', '))}</p>` : ''}
        ${added.length ? `<p class="error">Not in the original: ${esc(added.join(', '))}</p>` : ''}
        ${!missing.length && !added.length ? '<p class="note">Every number, link and name matches. Read it once more for changed meaning, which this check cannot see.</p>' : ''}
        ${left.length ? `<h3>Tells still in the rewrite</h3>${tells(left)}` : '<p class="note">No tells this site can detect are left.</p>'}`));
}

const form = document.querySelector('form') || document.createElement('form');

// An earlier version could keep an AI key in the browser. Remove it.
for (const store of ['localStorage', 'sessionStorage']) {
    try {
        for (const name of ['vinas-key-gemini', 'vinas-key-openrouter', 'original']) window[store].removeItem(name);
    } catch {
        // Storage is blocked, so nothing was kept.
    }
}

if (byId('strength')) {
    const wanted = new URLSearchParams(location.search).get('example');
    const example = /^\d$/.test(wanted || '') ? DATA.examples[Number(wanted)] : undefined;
    if (example !== undefined) {
        byId('text').value = example;
        byId('text').dispatchEvent(new Event('input'));
    }
    const button = form.querySelector('button.main');
    const label = button.textContent;
    const setText = (text) => {
        byId('text').value = text;
        byId('text').dispatchEvent(new Event('input'));
    };
    let fileName = '';

    const showStatus = async () => {
        const status = byId('status');
        const human = byId('strength').value === 'human';
        const wanted = human && (form.elements.brain.checked || form.elements.writer.checked);
        byId('level').disabled = !wanted;
        status.className = 'status';
        if (!wanted) {
            status.textContent = 'Text stays in your browser';
            return;
        }
        status.textContent = 'Waking the server';
        const ok = await wake();
        if (byId('level').disabled) return;
        const full = ok && hasWriter && form.elements.writer.checked;
        status.classList.add(ok ? 'on' : 'off');
        status.textContent = full ? 'AI writer ready' : ok ? (form.elements.writer.checked ? 'Word brain ready, AI writer not set up' : 'Word brain ready') : 'Server offline: rules only';
    };
    byId('strength').addEventListener('change', showStatus);
    form.elements.brain.addEventListener('change', showStatus);
    form.elements.writer.addEventListener('change', showStatus);
    showStatus();

    byId('paste').addEventListener('click', async () => {
        try {
            setText(await navigator.clipboard.readText());
            fileName = '';
            showError('');
        } catch {
            byId('text').focus();
            showError('Your browser did not allow that. Click the box and press Ctrl+V, or Cmd+V on a Mac.');
        }
    });
    byId('clear').addEventListener('click', () => {
        setText('');
        fileName = '';
        showError('');
        if (byId('result')) byId('result').remove();
        byId('text').focus();
    });
    byId('file').addEventListener('change', async () => {
        const file = byId('file').files[0];
        if (!file) return;
        try {
            const text = (await readFile(file)).replace(/\r\n/g, '\n');
            const error = tooLong(text);
            showError(error);
            if (!error) {
                setText(text);
                fileName = file.name;
            }
        } catch (error) {
            showError(error.message);
        }
        byId('file').value = '';
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (button.disabled) return;
        let slow = 0;
        try {
            const text = byId('text').value;
            const sample = trim(byId('sample').value);
            const error = tooLong(text, sample) || (trim(text) === '' ? 'Paste some text first.' : '');
            showError(error);
            if (error) return;
            const strength = byId('strength').value;
            let options = { type: byId('type').value, strong: strength === 'strong', human: strength === 'human', sample, dashes: form.elements.dashes.checked, fullForms: byId('contractions').value === 'no', level: byId('level').value };
            let source = text;
            let wrote = null;
            let writerNote = '';
            let unused = '';
            const useWriter = options.human && form.elements.writer.checked;
            button.disabled = true;
            if (useWriter && options.type === 'reference') {
                writerNote = 'Technical and legal text skips the AI writer, because every word can matter.';
            } else if (useWriter) {
                button.textContent = 'Writing...';
                byId('progress').textContent = 'Waking the server. This can take a minute.';
                if (!await wake()) {
                    writerNote = 'The AI writer could not be reached.';
                } else if (!hasWriter) {
                    writerNote = 'The AI writer is not set up on this server yet, so only words and phrases were changed.';
                } else {
                    let halt = false;
                    byId('stop').hidden = false;
                    byId('live').hidden = false;
                    byId('stop').onclick = () => { halt = true; };
                    try {
                        wrote = await rewriteAll(text, { ...options, notes: byId('notes').value }, (done, total, ready) => {
                            byId('progress').textContent = `The AI writer is on part ${done + 1} of ${total}.`;
                            byId('live').textContent = ready;
                        }, () => halt);
                    } finally {
                        byId('stop').hidden = true;
                        byId('live').hidden = true;
                        byId('live').textContent = '';
                    }
                    source = wrote.text;
                    const rest = wrote.total - wrote.written;
                    if (options.level === 'deep' && wrote.overused[0]) unused += ` Overused words: ${wrote.overused[0]} before, ${wrote.overused[1]} now.`;
                    if (wrote.unused.length) unused += ` These facts of yours did not fit anywhere: ${wrote.unused.join('; ')}`;
                    writerNote = wrote.total === 0 ? 'The text has no full paragraphs for the AI writer.'
                        : `The AI writer rewrote ${wrote.written} of ${wrote.total} parts.${rest ? ` ${rest} ${rest === 1 ? 'was' : 'were'} left to the word brain${wrote.trouble ? `: ${wrote.trouble}` : wrote.stopped ? ', because you stopped it.' : ', because no version passed the checks.'}` : ''}`;
                }
            }
            // Text the AI wrote needs only safe fixes; the rest gets the full treatment.
            const all = Boolean(wrote && wrote.total && wrote.written === wrote.total);
            if (all) options = { ...options, human: false, strong: false };
            const result = engine.run(source, options);
            result.writer = writerNote + unused;
            result.wrote = Boolean(wrote && wrote.written);
            if (strength === 'human' && !all && form.elements.brain.checked) {
                button.textContent = 'Thinking...';
                byId('progress').textContent = 'The word brain is polishing the text.';
                slow = setTimeout(() => { byId('progress').textContent = 'The word brain was asleep. Waking it can take a minute.'; }, 4000);
                result.brain = await think(result, options);
            }
            renderRewrite(result, text, fileName);
        } catch (error) {
            showError(error.message);
        } finally {
            clearTimeout(slow);
            button.disabled = false;
            button.textContent = label;
            byId('progress').textContent = '';
        }
    });
} else if (byId('original')) {
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const original = byId('original').value;
        const rewrite = byId('rewrite').value;
        const error = tooLong(original, rewrite) || (trim(original) === '' || trim(rewrite) === '' ? 'Paste both the original and the rewrite.' : '');
        showError(error);
        if (!error) renderCheck(original, rewrite);
    });
}

document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-pdf]');
    if (!button || button.disabled) return;
    const name = button.dataset.name.replace(/\.(?:txt|md|markdown)$/i, '').replace(/[^A-Za-z0-9 _-]+/g, '-').replace(/^[ -]+|[ -]+$/g, '') || 'rewrite';
    const text = trim(byId(button.dataset.pdf).value);
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Making the PDF...';
    try {
        // Built-in PDF fonts cover Western European text. Other scripts, symbols and emoji are drawn instead.
        const bytes = Pdf.supports(text) ? Pdf.render(text, name, DATA.widths) : await Pdf.draw(text, name);
        saveFile(new Blob([bytes], { type: 'application/pdf' }), `${name}.pdf`);
        button.textContent = label;
    } catch {
        button.textContent = 'PDF failed';
    }
    button.disabled = false;
});
