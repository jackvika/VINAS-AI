// A small neural network that reads questions. Trained by brain/train_mind.py on questions people asked about Wikipedia;
// the code here does exactly what that file does. It runs in the browser and sends nothing anywhere.
const Mind = (() => {
    const TYPES = ['person', 'place', 'date', 'number', 'reason', 'other'];
    const FEATURES = 20;
    const STOP = new Set(('a an the of in on at to for from by with and or but is are was were be been being am do does did has have had can could will would shall should may might must not no what which '
        + 'who whom whose that this these those when where why how many much it its as about into than then there their they them you your i me my we our us please tell explain describe define write give '
        + 'list name mean means meaning definition short long note notes answer question detail details brief example examples between difference differences compare comparison vs versus').split(' '));
    const MONTH = 'January|February|March|April|May|June|July|August|September|October|November|December';
    let net = null;
    let loading = null;

    function stem(word) {
        let w = word.toLowerCase().replace(/['’]s$/, '');
        if (w.length > 4) w = w.replace(/ies$/, 'y').replace(/(?:ations?|ings?|ments?|ness|edly|ed|es|ly|s)$/, '');
        return w.length > 4 ? w.replace(/e$/, '') : w;
    }

    const pieces = (text) => (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).flatMap((w) => w.toLowerCase().split('-')).filter(Boolean);
    const terms = (text) => pieces(text).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
    const stems = (text) => pieces(text).map(stem);

    /** Signs of what a sentence holds. */
    function marks(s) {
        const out = [];
        if (/\b1\d{3}\b|\b20\d{2}\b/.test(s)) out.push('<year>');
        if (new RegExp(`\\b(?:${MONTH})\\b|\\b\\d{1,4}s\\b|\\bcentury\\b`).test(s)) out.push('<date>');
        if (/\b\d[\d,.]*\b/.test(s) || /\b(?:two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion|dozen)\b/i.test(s)) out.push('<number>');
        if (/\d\s?%|\bpercent\b/.test(s)) out.push('<percent>');
        if (/[$€£₹¥]\s?\d/.test(s)) out.push('<money>');
        if (/[a-z,;]["”)]? ["“(]?[A-Z][a-z]+/.test(s)) out.push('<name>');
        if (/\b(?:because|due to|since|caused?|causes|reasons?|results? (?:from|in|of)|therefore|leads? to|led to|owing to|so that|in order to)\b/i.test(s)) out.push('<cause>');
        if (/\b(?:including|such as|consists? of|namely)\b|, \w+,? and /i.test(s)) out.push('<list>');
        if (/["“]/.test(s)) out.push('<quote>');
        return out;
    }

    const utf8 = new TextEncoder();

    function fnv(text) {
        let h = 2166136261;
        for (const b of utf8.encode(text)) h = Math.imul(h ^ b, 16777619) >>> 0;
        return h >>> 0;
    }

    function questionFeatures(q) {
        const w = pieces(q).slice(0, 40);
        const f = [...w.map((x) => `u:${x}`), ...w.slice(1).map((y, i) => `b:${w[i]} ${y}`), ...w.slice(0, 4).map((x, i) => `p${i}:${x}`), `s:${w.slice(0, 2).join(' ')}`];
        return [...new Set(f.map((x) => fnv(x) % net.buckets))];
    }

    /** Reads the weights. Throws when the file is not what it should be. */
    function parse(buffer) {
        const view = new DataView(buffer);
        const size = view.getUint32(0, true);
        const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, size)));
        const n = { info: head.info, dim: head.dim, buckets: head.buckets, ids: new Map(head.vocab.map((w, i) => [w, i])) };
        let at = 4 + size;
        for (const [name, type, shape, length] of head.arrays) {
            n[name] = type === 'f' ? new Float32Array(buffer, at, length / 4) : new Int8Array(buffer, at, length);
            n[`${name}Shape`] = shape;
            at += length;
        }
        if (at !== buffer.byteLength || n.AShape[0] !== FEATURES) throw new Error('not a mind file');
        n.hidden = n.AShape[1];
        return n;
    }

    function load(url) {
        if (!loading) {
            loading = fetch(url, { credentials: 'same-origin' }).then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.arrayBuffer();
            }).then((b) => { net = parse(b); return true; }).catch(() => {
                loading = null;
                return false;
            });
        }
        return loading;
    }

    /** What a question wants, as a chance for each of TYPES. */
    function typesOf(question) {
        const H = net.W1Shape[1];
        const h = new Float64Array(H);
        for (const r of questionFeatures(question)) for (let k = 0; k < H; k++) h[k] += net.W1[r * H + k] * net.W1s[r];
        const z = TYPES.map((_, t) => {
            let v = net.b[t];
            for (let k = 0; k < H; k++) v += Math.tanh(h[k]) * net.W2[k * TYPES.length + t];
            return v;
        });
        const top = Math.max(...z);
        const e = z.map((v) => Math.exp(v - top));
        const sum = e.reduce((a, b) => a + b, 0);
        return e.map((v) => v / sum);
    }

    /** A question or sentence as a point: words weighted by what training found useful. */
    function encode(words, most, question) {
        const E = question ? net.Eq : net.Es;
        const scale = question ? net.Eqs : net.Ess;
        const weight = question ? net.aq : net.As;
        const out = new Float64Array(net.dim);
        let n = 0;
        for (const w of words) {
            const id = net.ids.get(w);
            if (id === undefined) continue;
            if (n++ >= most) break;
            for (let k = 0; k < net.dim; k++) out[k] += E[id * net.dim + k] * scale[id] * weight[id];
        }
        const norm = Math.sqrt(out.reduce((a, b) => a + b * b, 0)) + 1e-6;
        return out.map((x) => x / norm);
    }

    const dot = (a, b) => {
        let v = 0;
        for (let i = 0; i < a.length; i++) v += a[i] * b[i];
        return v;
    };

    const near = (question, text) => dot(encode(stems(question), 24, true), encode([...marks(text), ...stems(text)], 48, false));

    /**
     * How likely each sentence of one article is the answer, higher is likelier.
     * @param {{text: string, block: number, first: boolean}[]} list in reading order; block tells paragraphs apart
     */
    function score(question, title, list) {
        const types = typesOf(question);
        const wanted = [...new Set(terms(question))];
        const asked = terms(question);
        const pairs = asked.slice(1).map((w, i) => `${asked[i]} ${w}`);
        const proper = (question.match(/(?<=[a-z,] )[A-Z][\w'’]+/g) || []).map(stem);
        const titleset = [...new Set(terms(title))];
        const seen = new Map();
        const info = list.map((s) => {
            const t = terms(s.text);
            const have = new Map();
            for (const w of t) have.set(w, (have.get(w) || 0) + 1);
            for (const w of have.keys()) seen.set(w, (seen.get(w) || 0) + 1);
            return { t, have, mk: marks(s.text) };
        });
        const n = list.length;
        const mean = info.reduce((a, x) => a + x.t.length, 0) / Math.max(1, n);
        const idf = new Map(wanted.map((w) => [w, Math.log(1 + (n - (seen.get(w) || 0) + 0.5) / ((seen.get(w) || 0) + 0.5))]));
        const all = [...idf.values()].reduce((a, b) => a + b, 0) || 1;
        const qv = encode(stems(question), 24, true);
        const bm = info.map(({ t, have }) => wanted.reduce((a, w) => (have.has(w) ? a + idf.get(w) * 2.2 * have.get(w) / (have.get(w) + 1.2 * (0.25 + 0.75 * t.length / Math.max(1, mean))) : a), 0));
        const cov = info.map(({ have }) => wanted.reduce((a, w) => (have.has(w) ? a + idf.get(w) : a), 0) / all);
        const cos = list.map((s, i) => dot(qv, encode([...info[i].mk, ...stems(s.text)], 48, false)));
        const topBm = Math.max(0, ...bm);
        const topCos = Math.max(...cos);
        return list.map((s, i) => {
            const { t, have, mk } = info[i];
            const has = (m) => (mk.includes(m) ? 1 : 0);
            const f = new Float64Array(FEATURES);
            const got = wanted.filter((w) => have.has(w)).length;
            if (got) {
                const mine = new Set(t.slice(1).map((w, k) => `${t[k]} ${w}`));
                f[6] = pairs.filter((p) => mine.has(p)).length / Math.max(1, pairs.length);
                f[18] = proper.length ? proper.filter((w) => have.has(w)).length / proper.length : 0;
            }
            f[0] = bm[i] / (topBm + 1e-6);
            f[1] = Math.min(2, bm[i] / 12);
            f[2] = cos[i];
            f[3] = cos[i] - topCos;
            f[4] = cov[i];
            f[5] = got / Math.max(1, wanted.length);
            if (i && list[i - 1].block === s.block) f[7] = cov[i - 1];
            f[8] = types[0] * has('<name>');
            f[9] = types[1] * has('<name>');
            f[10] = types[2] * (has('<year>') || has('<date>'));
            f[11] = types[3] * has('<number>');
            f[12] = types[4] * has('<cause>');
            f[13] = types[5];
            f[14] = i === 0 ? 1 : 0;
            f[15] = s.first ? 1 : 0;
            f[16] = Math.min(1.5, t.length / 30);
            if (i + 1 < n && list[i + 1].block === s.block) f[17] = cov[i + 1];
            f[19] = titleset.filter((w) => have.has(w)).length / Math.max(1, titleset.length);
            let z = 0;
            for (let h = 0; h < net.hidden; h++) {
                let v = net.c[h];
                for (let k = 0; k < FEATURES; k++) v += (f[k] - net.mu[k]) / net.sd[k] * net.A[k * net.hidden + h];
                z += Math.tanh(v) * net.B[h];
            }
            return z;
        });
    }

    return { TYPES, load, parse, use: (n) => { net = n; }, ready: () => net !== null, info: () => net && net.info, typesOf, near, score };
})();
