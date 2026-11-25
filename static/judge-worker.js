// Runs the reader, a small neural network, in its own thread. It reads a question and a sentence together
// and says how likely the sentence is an answer. Everything comes from this site; nothing is sent anywhere.
import * as ort from './vendor/ort.wasm.min.mjs';
import { Tokenizer } from './wordpiece.js';

const here = (path) => new URL(path, import.meta.url).href;
ort.env.wasm.wasmPaths = here('./vendor/');
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)) : 1;
ort.env.logLevel = 'error';

const MOST = 176;     // pieces of question and sentence together
const BATCH = 8;
let tokenizer = null;
let session = null;

async function bytes(url, told) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(String(r.status));
    const total = Number(r.headers.get('Content-Length')) || 23200000;
    const parts = [];
    let got = 0;
    for (const reader = r.body.getReader(); ;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        told(Math.min(1, got / total));
    }
    const out = new Uint8Array(got);
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

async function load() {
    if (session) return;
    const vocab = await fetch(here('./vendor/vocab.txt'), { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
    });
    const model = await bytes(here('./vendor/minilm-l6.onnx'), (part) => postMessage({ type: 'progress', part }));
    tokenizer = new Tokenizer(vocab);
    session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
}

async function score(question, texts) {
    const rows = texts.map((t) => tokenizer.pair(question, t, MOST));
    // Sentences of like length go together, so that little is spent on padding.
    const order = [...rows.keys()].sort((a, b) => rows[a].ids.length - rows[b].ids.length);
    const out = new Array(texts.length);
    for (let i = 0; i < order.length; i += BATCH) {
        const some = order.slice(i, i + BATCH);
        const width = Math.max(...some.map((k) => rows[k].ids.length));
        const make = (fill) => {
            const data = new BigInt64Array(some.length * width);
            some.forEach((k, r) => fill(rows[k]).forEach((v, c) => { data[r * width + c] = BigInt(v); }));
            return new ort.Tensor('int64', data, [some.length, width]);
        };
        const feeds = { input_ids: make((x) => x.ids), attention_mask: make((x) => x.ids.map(() => 1)), token_type_ids: make((x) => x.types) };
        const result = await session.run(Object.fromEntries(session.inputNames.map((n) => [n, feeds[n]])));
        const z = result[session.outputNames[0]].data;
        some.forEach((k, r) => { out[k] = z[r * (z.length / some.length)]; });
    }
    return out;
}

let queue = Promise.resolve();
self.onmessage = ({ data }) => {
    queue = queue.then(async () => {
        try {
            if (data.type === 'load') {
                await load();
                postMessage({ type: 'ready', id: data.id });
            } else if (data.type === 'score' && session && typeof data.question === 'string' && Array.isArray(data.texts)) {
                postMessage({ type: 'scores', id: data.id, scores: await score(data.question, data.texts.slice(0, 60).map(String)) });
            } else throw new Error('not ready');
        } catch (error) {
            postMessage({ type: 'error', id: data.id, message: String((error && error.message) || error).slice(0, 200) });
        }
    });
};
