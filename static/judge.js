// The page's side of the reader in static/judge-worker.js. It loads only when someone asks, and a page without it still answers.
const Judge = (() => {
    let worker = null;
    let ready = false;
    let loading = null;
    let serial = 0;
    let told = () => {};
    const waiting = new Map();
    const able = () => typeof Worker === 'function' && typeof WebAssembly === 'object' && /^https?:$/.test(location.protocol);

    function stop() {
        if (worker) worker.terminate();
        worker = null;
        ready = false;
        loading = null;
        for (const job of waiting.values()) job.reject(new Error('stopped'));
        waiting.clear();
    }

    function ask(message, ms) {
        return new Promise((resolve, reject) => {
            const id = ++serial;
            const timer = setTimeout(() => {
                waiting.delete(id);
                reject(new Error('slow'));
            }, ms);
            const end = (fn) => (value) => {
                clearTimeout(timer);
                waiting.delete(id);
                fn(value);
            };
            waiting.set(id, { resolve: end(resolve), reject: end(reject) });
            worker.postMessage({ ...message, id });
        });
    }

    /** Loads once, 37 MB, kept by the browser. Resolves to false where it cannot run. */
    function load(progress = () => {}) {
        told = progress;
        if (ready) return Promise.resolve(true);
        if (!able()) return Promise.resolve(false);
        if (!loading) {
            try {
                worker = new Worker('static/judge-worker.js', { type: 'module' });
            } catch {
                return Promise.resolve(false);
            }
            worker.onerror = stop;
            worker.onmessage = ({ data }) => {
                const job = waiting.get(data.id);
                if (data.type === 'progress') told(data.part);
                else if (job && data.type === 'error') job.reject(new Error(String(data.message)));
                else if (job) job.resolve(data.scores);
            };
            loading = ask({ type: 'load' }, 180000).then(() => {
                ready = true;
                return true;
            }, () => {
                stop();
                return false;
            });
        }
        return loading;
    }

    /** How likely each text answers the question, from 0 to 1, or null when the reader is not there. */
    async function score(question, texts) {
        if (!ready || !texts.length) return null;
        try {
            const z = await ask({ type: 'score', question, texts }, 30000);
            return Array.isArray(z) && z.length === texts.length && z.every(Number.isFinite) ? z.map((x) => 1 / (1 + Math.exp(-x))) : null;
        } catch {
            return null;
        }
    }

    return { able, load, score, ready: () => ready };
})();
