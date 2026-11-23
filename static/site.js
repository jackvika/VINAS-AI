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
    const was = engine.metrics(text);
    const now = engine.metrics(r.text);
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
                ${pdfButton(r.text, 'output', fileName || 'rewrite', true)}
                <button type="button" class="ghost" data-reuse="output">Edit and check again</button>
            </span>
        </div>
        <p class="stats">
            <span><b>${edits}</b> fixed</span>
            <span><b>${left}</b> left to check</span>
            <span><b>${engine.averageSentence(text)} → ${engine.averageSentence(r.text)}</b> words per sentence</span>
            <span><b>${was.variety} → ${now.variety}</b> sentence variety</span>
            <span><b>${was.ease} → ${now.ease}</b> reading ease</span>
            <span><b>${r.sections} of ${r.sections}</b> sections reviewed</span>
        </p>
        ${note ? `<p class="note">${note}</p>` : ''}
        ${r.missing.length ? `<p class="error" role="alert">Check these details, which are no longer in the result: ${esc(r.missing.join(', '))}</p>` : ''}
        <div class="output">${highlight(r.text, r.flags)}</div>
        <textarea id="output" class="source" readonly tabindex="-1" aria-hidden="true"></textarea>
        ${voice}
        ${r.tips.length ? `<h3>Make it yours</h3><p class="muted">Only you can do these, and they make the biggest difference.</p><ul class="list">${r.tips.map(([kind, quote]) => `<li>${quote ? `<mark>${esc(quote)}</mark>` : ''}<span>${esc(DATA.rules.tips[kind])}</span></li>`).join('')}</ul>` : ''}
        ${left ? `<h3>Left for you to check</h3>${tells(r.flags)}` : ''}
        ${r.first !== null ? `<details><summary>First rewrite, and the ${r.survived.length} tells that survived it</summary><div class="output">${highlight(r.first, r.survived)}</div></details>` : ''}
        ${edits ? `<details><summary>What was fixed (${edits})</summary><ul class="list">${r.edits.map((c) => `<li>${tag(c.pattern)} <del>${esc(c.before)}</del>${c.after ? ` <ins>${esc(c.after)}</ins>` : ''}</li>`).join('')}</ul></details>` : ''}`);
    show(node);
    byId('output').value = r.text;
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
