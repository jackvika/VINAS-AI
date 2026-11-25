// The BBA course: every topic is a link that asks its question on the first page.
(() => {
    const home = document.getElementById('course');
    if (!home) return;
    const note = document.getElementById('bba-note');
    const find = document.getElementById('find');
    const marks = document.getElementById('marks');
    const el = (tag, text, cls) => {
        const node = document.createElement(tag);
        if (text) node.textContent = text;
        if (cls) node.className = cls;
        return node;
    };
    const YEAR = { 'Semester 1': 'Year 1', 'Semester 3': 'Year 2', 'Semester 5': 'Year 3', 'Business Analytics': 'Specialisations, semesters 5 and 6' };
    let course = null;
    let links = [];

    /** A topic as a question. The subject goes with it in the link. */
    function ask(topic, n) {
        let t = topic.replace(/\s*[-–]\s*(?:concept|meaning|definition)s?\b.*$/i, '');
        // "Types of plans: strategic, tactical" asks for the types of plans.
        const colon = t.indexOf(':');
        if (colon > 0 && t.slice(0, colon).split(' ').length > 1) t = t.slice(0, colon);
        t = t.replace(/\s*\([^)]*\)/g, '').trim() || topic;
        t = t.replace(/\s*-?\s*practice problems?$/i, '').replace(/\s+\d$/, '');
        // Title Case That Is Only A Heading becomes plain; names like SWOT and McGregor stay.
        const low = t.split(' ').length > 1 && /^[A-Z][a-z]/.test(t) && !/^(?:Indian?|Maslow|Porter|Fayol|Herzberg|Keynes|India)/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
        return `Explain ${low} (${n} marks)`;
    }

    function point() {
        for (const [a, topic, c] of links) a.href = `index.html#${encodeURIComponent(c.code)}/${encodeURIComponent(ask(topic, marks.value))}`;
    }

    function draw() {
        const word = find.value.trim().toLowerCase();
        home.replaceChildren();
        links = [];
        let group = '';
        let box = null;
        let subjects = 0;
        let topics = 0;
        for (const c of course.courses) {
            const whole = !word || c.title.toLowerCase().includes(word) || c.code.toLowerCase() === word;
            const units = c.units.map((u) => ({ ...u, topics: whole || u.title.toLowerCase().includes(word) ? u.topics : u.topics.filter((t) => t.toLowerCase().includes(word)) })).filter((u) => u.topics.length);
            if (!units.length) continue;
            if (group !== c.group) {
                group = c.group;
                if (YEAR[group]) home.append(el('h2', YEAR[group]));
                box = el('section', '', 'term');
                box.append(el('h3', group));
                home.append(box);
            }
            subjects++;
            const fold = el('details', '', 'subject');
            fold.open = Boolean(word) && !whole;
            const sum = el('summary', c.title);
            sum.append(' ', el('span', `${c.code}, ${c.units.length} ${c.units.length === 1 ? 'unit' : 'units'}`, 'muted'));
            fold.append(sum);
            units.forEach((u, i) => {
                fold.append(el('h4', `Unit ${c.units.findIndex((x) => x.title === u.title) + 1 || i + 1}: ${u.title}`));
                const list = el('ul', '', 'topics');
                for (const t of u.topics) {
                    const item = el('li');
                    const a = el('a', t);
                    links.push([a, t, c]);
                    item.append(a);
                    list.append(item);
                    topics++;
                }
                fold.append(list);
            });
            box.append(fold);
        }
        point();
        note.textContent = subjects ? `${subjects} subjects, ${topics.toLocaleString('en-IN')} topics` : 'No subject or topic has this word.';
    }

    if (/^https?:$/.test(location.protocol)) {
        fetch('static/bba.json', { credentials: 'same-origin' }).then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then((data) => {
            course = data;
            draw();
            find.addEventListener('input', draw);
            marks.addEventListener('change', point);
        }).catch(() => { note.textContent = 'The course could not be loaded. Try again.'; });
    } else note.textContent = 'Open this page from the site.';
})();
