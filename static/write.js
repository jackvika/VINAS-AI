// The page where the visitor writes and the site only helps.
(() => {
    const list = byId('points');
    const trouble = byId('trouble');

    const post = async (path, body, button, busy) => {
        const label = button.textContent;
        button.disabled = true;
        button.textContent = busy;
        trouble.textContent = '';
        try {
            if (!await wake()) throw new Error('The server could not be reached.');
            return await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 240000);
        } catch (error) {
            trouble.textContent = error.said || error.message;
            trouble.scrollIntoView({ block: 'center' });
            return null;
        } finally {
            button.disabled = false;
            button.textContent = label;
        }
    };

    function addPoint(text) {
        const item = document.createElement('li');
        const box = document.createElement('textarea');
        box.rows = 2;
        box.maxLength = 1200;
        if (text) {
            const p = document.createElement('p');
            p.className = 'point';
            p.textContent = text;
            item.append(p);
        }
        box.setAttribute('aria-label', text ? `Your words for: ${text}` : 'Your own point');
        box.placeholder = text ? 'In your own words' : 'An example, a number, or what you think';
        item.append(box);
        list.append(item);
        return box;
    }

    byId('get-points').addEventListener('click', async (event) => {
        const text = trim(byId('source').value);
        if (text === '') {
            trouble.textContent = 'Paste some text first.';
            return;
        }
        if ([...list.querySelectorAll('textarea')].some((b) => b.value.trim()) && !window.confirm('This replaces the points and what you wrote under them.')) return;
        const out = await post('api/points', { text }, event.target, 'Reading...');
        if (!out || !Array.isArray(out.points)) return;
        list.replaceChildren();
        for (const point of out.points) addPoint(String(point));
        addPoint('');
        byId('step-write').hidden = false;
        byId('step-write').scrollIntoView();
    });

    byId('add-point').addEventListener('click', () => addPoint('').focus());

    byId('finish-text').addEventListener('click', async (event) => {
        const own = [...list.querySelectorAll('textarea')].map((b) => b.value.trim()).filter(Boolean).map((t) => (/[.!?।]["”')]?$/.test(t) ? t : `${t}.`)).join(' ');
        if (own === '') {
            trouble.textContent = 'Write at least one point in your own words.';
            trouble.scrollIntoView({ block: 'center' });
            return;
        }
        if (own.length > 4000) {
            trouble.textContent = 'Keep it under 4,000 characters in all.';
            trouble.scrollIntoView({ block: 'center' });
            return;
        }
        const english = byId('english').checked;
        const out = await post('api/polish', { text: own, english }, event.target, 'Correcting...');
        let text = out && typeof out.text === 'string' ? trim(out.text) : '';
        let note = english ? 'Put into English. Check that it still says what you meant.' : 'Only your mistakes were corrected.';
        // A correction that rewrites is not a correction.
        if (text === '' || (!english && Checker.similarity(own, text) < 0.7)) {
            text = own;
            note = 'Your text is shown as you wrote it, because the correction changed too much or could not be made.';
        }
        text = text.replace(/(^|[.!?]\s+|\n)(\p{Ll})/gu, (_, gap, c) => gap + c.toUpperCase()).replace(/\bi\b(?=[ ,.!?]|['’])/g, 'I');
        byId('mine').value = text;
        byId('mine-note').textContent = note;
        const found = engine.inspect(text);
        byId('tells').innerHTML = found.length ? `<h3>Phrases that sound like AI</h3>${tells(found)}` : '';
        byId('step-result').hidden = false;
        byId('step-result').scrollIntoView();
    });
})();
