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

function pdfButton(text, source, name, canPrint) {
    if (trim(text) === '') return '';
    if (Pdf.supports(text)) return `<button type="button" class="ghost" data-pdf="${source}" data-name="${esc(name)}">Download PDF</button>`;
    return canPrint ? '<button type="button" class="ghost" data-print>Save as PDF</button>' : '';
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
    else if (!edits && !left) note = 'No tells this site can detect were found. Your text is unchanged.';

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
                <button type="button" class="ghost" data-copy="output">Copy</button>
                <button type="button" class="ghost" data-download="output" data-name="${esc(fileName || 'rewrite.txt')}">Download text</button>
                <span id="pdf-slot"></span>
                <button type="button" class="ghost" data-reuse="output">Edit and check again</button>
            </span>
        </div>
        <p class="stats" id="stats"></p>
        ${note ? `<p class="note">${note}</p>` : ''}
        <p class="error" role="alert" id="lost" hidden></p>
        <div class="output" id="shown"></div>
        <textarea id="output" class="source" readonly tabindex="-1" aria-hidden="true"></textarea>
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
        for (const [kind, quote] of withTips ? engine.tips(current) : []) {
            const start = quote === '' ? current.length : current.indexOf(quote);
            if (start >= 0) list.push({ kind, start, end: start + quote.length, text: quote, pattern: 0, advice: RULES.tips[kind] });
        }
        return { flags, list: list.filter((j) => !kept.has(j.kind + j.text)) };
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
        const long = j.kind === 'long' || j.kind === 'even';
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
        byId('shown').innerHTML = highlight(current, state.flags.filter((f) => !kept.has('flag' + f.text)));
        byId('pdf-slot').innerHTML = pdfButton(current, 'output', fileName || 'rewrite', true);
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
        <div class="bar"><h2>Report</h2>${pdfButton(rewrite, 'rewrite', 'rewrite', false)}</div>
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

const form = document.querySelector('form');

// An earlier version could keep an AI key in the browser. Remove it.
for (const store of ['localStorage', 'sessionStorage']) {
    try {
        for (const name of ['vinas-key-gemini', 'vinas-key-openrouter', 'original']) window[store].removeItem(name);
    } catch {
        // Storage is blocked, so nothing was kept.
    }
}

if (byId('strength')) {
    const example = DATA.examples[new URLSearchParams(location.search).get('example')];
    if (example !== undefined) {
        byId('text').value = example;
        byId('text').dispatchEvent(new Event('input'));
    }
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const file = byId('file').files[0];
            const text = (file ? await readFile(file) : byId('text').value).replace(/\r\n/g, '\n');
            const sample = trim(byId('sample').value);
            const error = tooLong(text, sample) || (trim(text) === '' ? 'Paste some text or choose a file first.' : '');
            showError(error);
            if (error) return;
            if (file) {
                byId('text').value = text;
                byId('text').dispatchEvent(new Event('input'));
                byId('file').value = '';
            }
            const strength = byId('strength').value;
            const options = { type: byId('type').value, strong: strength === 'strong', human: strength === 'human', sample, dashes: form.elements.dashes.checked };
            renderRewrite(engine.run(text, options), text, file ? file.name : '');
        } catch (error) {
            showError(error.message);
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

document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pdf]');
    if (!button) return;
    const name = button.dataset.name.replace(/\.(?:txt|md|markdown)$/i, '').replace(/[^A-Za-z0-9 _-]+/g, '-').replace(/^[ -]+|[ -]+$/g, '') || 'rewrite';
    saveFile(new Blob([Pdf.render(trim(byId(button.dataset.pdf).value), name, DATA.widths)], { type: 'application/pdf' }), `${name}.pdf`);
});
