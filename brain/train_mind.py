"""Trains the small neural network that reads questions (static/mind.bin). Run once; the site only needs the file it makes.

    python -m brain.train_mind FOLDER static/mind.bin

FOLDER holds train-v1.1.json and dev-v1.1.json of SQuAD 1.1 (CC BY-SA 4.0, rajpurkar.github.io/SQuAD-explorer). Needs numpy.

Three parts, all learned from questions people asked about Wikipedia:
  types     what a question wants: a person, a place, a date, a number, a reason, or something else
  encoder   two tables of word vectors that put a question near the sentences that answer such questions
  ranker    a network with one hidden layer that weighs everything known about a sentence
"""
import json
import math
import re
import struct
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np

DIM, WORDS, BUCKETS, HIDDEN = 48, 16000, 4096, 32
TYPES = ['person', 'place', 'date', 'number', 'reason', 'other']
MARKS = ['<year>', '<date>', '<number>', '<percent>', '<money>', '<name>', '<cause>', '<list>', '<quote>']
STOP = set('''a an the of in on at to for from by with and or but is are was were be been being am do does did has have had can could will would shall should may might must not no what which
who whom whose that this these those when where why how many much it its as about into than then there their they them you your i me my we our us please tell explain describe define write give
list name mean means meaning definition short long note notes answer question detail details brief example examples between difference differences compare comparison vs versus'''.split())
WORD = re.compile(r"[^\W_]+(?:['’-][^\W_]+)*")
MONTH = r'January|February|March|April|May|June|July|August|September|October|November|December'
rng = np.random.default_rng(7)

# ---------- text; static/mind.js does exactly the same ----------


def stem(w):
    w = re.sub(r"['’]s$", '', w.lower())
    if len(w) > 4:
        w = re.sub(r'(?:ations?|ings?|ments?|ness|edly|ed|es|ly|s)$', '', re.sub(r'ies$', 'y', w))
    return re.sub(r'e$', '', w) if len(w) > 4 else w


def pieces(text):
    return [p for w in WORD.findall(text) for p in w.lower().split('-') if p]


def terms(text):
    return [stem(w) for w in pieces(text) if len(w) > 1 and w not in STOP]


def all_stems(text):
    return [stem(w) for w in pieces(text)]


def marks(s):
    out = []
    if re.search(r'\b1\d{3}\b|\b20\d{2}\b', s, re.A): out.append('<year>')
    if re.search(rf'\b(?:{MONTH})\b|\b\d{{1,4}}s\b|\bcentury\b', s, re.A): out.append('<date>')
    if re.search(r'\b\d[\d,.]*\b', s, re.A) or re.search(r'\b(?:two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion|dozen)\b', s, re.I | re.A): out.append('<number>')
    if re.search(r'\d\s?%|\bpercent\b', s, re.A): out.append('<percent>')
    if re.search(r'[$€£₹¥]\s?\d', s): out.append('<money>')
    if re.search(r'[a-z,;]["”)]? ["“(]?[A-Z][a-z]+', s): out.append('<name>')
    if re.search(r'\b(?:because|due to|since|caused?|causes|reasons?|results? (?:from|in|of)|therefore|leads? to|led to|owing to|so that|in order to)\b', s, re.I | re.A): out.append('<cause>')
    if re.search(r'\b(?:including|such as|consists? of|namely)\b|, \w+,? and ', s, re.I | re.A): out.append('<list>')
    if re.search(r'["“]', s): out.append('<quote>')
    return out


def fnv(text):
    h = 2166136261
    for b in text.encode('utf-8'):
        h = ((h ^ b) * 16777619) & 0xffffffff
    return h


def question_features(q):
    w = pieces(q)[:40]
    f = [f'u:{x}' for x in w] + [f'b:{x} {y}' for x, y in zip(w, w[1:])] + [f'p{i}:{x}' for i, x in enumerate(w[:4])]
    f.append('s:' + ' '.join(w[:2]))
    return sorted({fnv(x) % BUCKETS for x in f})


def split(text):
    out, held = [], ''
    for part in re.split(r'(?<=[.!?])\s+(?=["“(]?[A-Z0-9])', text.strip()):
        held = f'{held} {part}' if held else part
        if re.search(r'(?:^|[\s(])(?:Mr|Mrs|Ms|Dr|St|vs|etc|e\.g|i\.e|c|ca|No|Inc|Ltd|Co|U\.S|U\.K|approx|[A-Z])\.$', held):
            continue
        out.append(held)
        held = ''
    return out + ([held] if held else [])


def kind(question, answer):
    """What sort of thing the answer is. Weak, but there are many of them."""
    q, a = question.lower(), answer.strip()
    if re.match(r'why\b|for what reason', q) or re.search(r'\bwhat (?:was|is|were|are) the (?:reason|cause)|\bwhat caused\b|\bwhat reason\b', q): return 4
    if re.fullmatch(rf'(?:in |on |around |by )?(?:(?:{MONTH})\.?\s*)?\d{{0,2}},?\s*(?:1\d{{3}}|20\d{{2}})(?:s)?(?:\s*(?:BC|AD))?', a) or re.search(rf'\b(?:{MONTH})\b', a) and len(a) < 30 or re.search(r'\bcentury\b', a) or re.match(r'when\b', q): return 2
    if re.match(r'(?:about |over |around |approximately |nearly |more than )?[$€£]?\d[\d,.]*(?:\s?%|\s\w+){0,3}$', a) or re.match(r'how (?:many|much|long|old|far|tall|big|large|high)', q): return 3
    if re.match(r'(?:who|whom|whose)\b', q): return 0
    if re.match(r'where\b', q) or re.search(r'\b(?:what|which) (?:city|country|state|place|town|county|region|continent|island|river|street|location|area|nation)\b', q): return 1
    return 5


def load(path):
    out = []
    for a in json.load(open(path, encoding='utf-8'))['data']:
        sents, asked = [], []
        for pi, p in enumerate(a['paragraphs']):
            start, spans = 0, []
            for s in split(p['context']):
                at = p['context'].find(s[:40], start)
                at = start if at < 0 else at
                spans.append((at, len(sents)))
                sents.append((s, pi, len(spans) - 1))
                start = at + len(s)
            for q in p['qas']:
                gold = set()
                for ans in q['answers']:
                    gold.add(max((x for x in spans if x[0] <= ans['answer_start']), default=spans[0])[1])
                asked.append((q['question'].strip(), q['answers'][0]['text'], gold))
        out.append((a['title'].replace('_', ' '), sents, asked))
    return out


class Adam:
    def __init__(self, params, rate):
        self.p, self.rate, self.t = params, rate, 0
        self.m = [np.zeros_like(x) for x in params]
        self.v = [np.zeros_like(x) for x in params]

    def step(self, grads):
        self.t += 1
        for p, g, m, v in zip(self.p, grads, self.m, self.v):
            m += 0.1 * (g - m)
            v += 0.001 * (g * g - v)
            p -= self.rate * (m / (1 - 0.9 ** self.t)) / (np.sqrt(v / (1 - 0.999 ** self.t)) + 1e-8)


# ---------- 1. types ----------


def train_types(train, dev):
    data = [(question_features(q), kind(q, a)) for _, _, qs in train for q, a, _ in qs]
    test = [(question_features(q), kind(q, a)) for _, _, qs in dev for q, a, _ in qs]
    W1 = rng.normal(0, 0.05, (BUCKETS, HIDDEN)).astype(np.float32)
    W2 = rng.normal(0, 0.2, (HIDDEN, len(TYPES))).astype(np.float32)
    b = np.zeros(len(TYPES), np.float32)
    opt = Adam([W1, W2, b], 0.004)

    def forward(rows):
        h = np.tanh(np.stack([W1[r].sum(0) for r in rows]))
        z = h @ W2 + b
        e = np.exp(z - z.max(1, keepdims=True))
        return h, e / e.sum(1, keepdims=True)

    for epoch in range(4):
        for k in np.array_split(rng.permutation(len(data)), len(data) // 256):
            rows, y = [data[i][0] for i in k], np.array([data[i][1] for i in k])
            h, p = forward(rows)
            d = p
            d[np.arange(len(k)), y] -= 1
            d /= len(k)
            g1 = np.zeros_like(W1)
            back = (d @ W2.T) * (1 - h * h)
            for r, x in zip(rows, back):
                g1[r] += x
            opt.step([g1 + 1e-5 * W1, h.T @ d, d.sum(0)])
        guess = np.concatenate([forward([r for r, _ in test[i:i + 512]])[1].argmax(1) for i in range(0, len(test), 512)])
        y = np.array([t for _, t in test])
        print(f'types {epoch}: {100 * (guess == y).mean():.1f}% right on unseen articles', {t: f'{100 * (guess[y == i] == i).mean():.0f}%' for i, t in enumerate(TYPES)}, flush=True)
    return W1, W2, b, float((guess == y).mean())


# ---------- 2. encoder ----------


def bag(ids, table, weight):
    """Weighted mean of word vectors for a batch of padded id rows (0 is padding)."""
    w = weight[ids] * (ids > 0)
    total = (table[ids] * w[..., None]).sum(1)
    norm = np.linalg.norm(total, axis=1, keepdims=True) + 1e-6
    return total, norm, total / norm, w


def train_encoder(train, dev):
    count = Counter()
    for _, sents, qs in train:
        for s, _, _ in sents:
            count.update(set(all_stems(s)))
        for q, _, _ in qs:
            count.update(all_stems(q))
    vocab = ['<pad>'] + MARKS + [w for w, n in count.most_common(WORDS - 1 - len(MARKS)) if n > 2]
    ids = {w: i for i, w in enumerate(vocab)}
    enc = lambda text, n, extra=(): ([ids[w] for w in [*extra, *all_stems(text)] if w in ids] + [0] * n)[:n]
    Q, S, A = [], [], []
    for ai, (_, sents, qs) in enumerate(train):
        for q, _, gold in qs:
            g = min(gold)
            Q.append(enc(q, 24))
            S.append(enc(sents[g][0], 48, marks(sents[g][0])))
            A.append(ai)
    Q, S, A = np.array(Q), np.array(S), np.array(A)
    V = len(vocab)
    total = sum(count.values())
    start = np.array([0.0] + [1.0] * len(MARKS) + [math.log(1 + total / (200 + count[w])) / 4 for w in vocab[1 + len(MARKS):]], np.float32)
    Eq = rng.normal(0, 0.1, (V, DIM)).astype(np.float32)
    Es = (Eq + rng.normal(0, 0.02, (V, DIM))).astype(np.float32)
    aq, As = start.copy(), start.copy()
    opt = Adam([Eq, Es, aq, As], 0.003)
    temp = 14.0
    for epoch in range(5):
        order, losses, t0 = rng.permutation(len(Q)), [], time.time()
        # Half of each batch comes from a few articles, so that the wrong sentences are about the same things.
        for k in np.array_split(order, len(order) // 320):
            if rng.random() < 0.6:
                k = np.flatnonzero(np.isin(A, rng.choice(len(train), 4, replace=False)))
                k = rng.choice(k, min(320, len(k)), replace=False)
            q, s = Q[k], S[k]
            tq, nq, uq, wq = bag(q, Eq, aq)
            ts, ns, us, ws = bag(s, Es, As)
            z = temp * uq @ us.T
            e = np.exp(z - z.max(1, keepdims=True))
            p = e / e.sum(1, keepdims=True)
            # Several questions can share a sentence; those are not wrong answers.
            same = (s[:, None, :12] == s[None, :, :12]).all(-1)
            p = np.where(same & ~np.eye(len(k), dtype=bool), 0, p)
            p /= p.sum(1, keepdims=True)
            losses.append(-np.log(np.diag(p) + 1e-9).mean())
            d = (p - np.eye(len(k))) * temp / len(k)
            gq, gs = d @ us, d.T @ uq
            gq = (gq - (gq * uq).sum(1, keepdims=True) * uq) / nq
            gs = (gs - (gs * us).sum(1, keepdims=True) * us) / ns
            GE, GS, ga, gA = np.zeros_like(Eq), np.zeros_like(Es), np.zeros_like(aq), np.zeros_like(As)
            np.add.at(GE, q, gq[:, None, :] * wq[..., None])
            np.add.at(GS, s, gs[:, None, :] * ws[..., None])
            np.add.at(ga, q, (Eq[q] * gq[:, None, :]).sum(-1) * (q > 0))
            np.add.at(gA, s, (Es[s] * gs[:, None, :]).sum(-1) * (s > 0))
            opt.step([GE, GS, ga, gA])
            np.maximum(aq, 0.02, out=aq)
            np.maximum(As, 0.02, out=As)
        print(f'encoder {epoch}: loss {np.mean(losses):.3f}, {time.time() - t0:.0f}s', flush=True)
        opt.rate *= 0.7
    return vocab, ids, Eq, Es, aq, As


# ---------- 3. ranker ----------

FEATURES = 20


def article_index(sents):
    info = []
    seen = Counter()
    for s, para, pos in sents:
        t = terms(s)
        seen.update(set(t))
        info.append((t, Counter(t), marks(s), para, pos))
    return info, seen, sum(len(x[0]) for x in info) / max(1, len(info))


def features(question, title, sents, index, qvec, svecs, types):
    info, seen, mean = index
    n = len(info)
    wanted = list(dict.fromkeys(terms(question)))
    titleset = set(terms(title))
    idf = {w: math.log(1 + (n - seen[w] + 0.5) / (seen[w] + 0.5)) for w in wanted}
    totalidf = sum(idf.values()) or 1
    pairs = list(zip(terms(question), terms(question)[1:]))
    proper = [stem(w) for w in re.findall(r"(?<=[a-z,] )[A-Z][\w'’]+", question)]
    cos = svecs @ qvec
    bm, cov = np.zeros(n), np.zeros(n)
    F = np.zeros((n, FEATURES), np.float32)
    for i, (t, have, mk, para, pos) in enumerate(info):
        got = [w for w in wanted if w in have]
        bm[i] = sum(idf[w] * 2.2 * have[w] / (have[w] + 1.2 * (0.25 + 0.75 * len(t) / max(1, mean))) for w in got)
        cov[i] = sum(idf[w] for w in got) / totalidf
        if got:
            mine = set(zip(t, t[1:]))
            F[i, 6] = sum(p in mine for p in pairs) / max(1, len(pairs))
            F[i, 18] = sum(w in have for w in proper) / len(proper) if proper else 0
        F[i, 5] = len(got) / max(1, len(wanted))
        has = set(mk)
        F[i, 8] = types[0] * ('<name>' in has)
        F[i, 9] = types[1] * ('<name>' in has)
        F[i, 10] = types[2] * ('<year>' in has or '<date>' in has)
        F[i, 11] = types[3] * ('<number>' in has)
        F[i, 12] = types[4] * ('<cause>' in has)
        F[i, 13] = types[5]
        F[i, 14] = i == 0
        F[i, 15] = pos == 0
        F[i, 16] = min(1.5, len(t) / 30)
        F[i, 19] = sum(w in have for w in titleset) / max(1, len(titleset))
    F[:, 0] = bm / (bm.max() + 1e-6)
    F[:, 1] = np.minimum(2, bm / 12)
    F[:, 2] = cos
    F[:, 3] = cos - cos.max()
    F[:, 4] = cov
    for i in range(n):
        if i and info[i - 1][3] == info[i][3]:
            F[i, 7] = cov[i - 1]
        if i + 1 < n and info[i + 1][3] == info[i][3]:
            F[i, 17] = cov[i + 1]
    return F, bm


def prepare(data, enc, typenet, most):
    vocab, ids, Eq, Es, aq, As = enc
    W1, W2, b, _ = typenet
    out = []
    for title, sents, qs in data:
        index = article_index(sents)
        rows = np.array([([ids[w] for w in [*marks(s), *all_stems(s)] if w in ids] + [0] * 48)[:48] for s, _, _ in sents])
        svecs = bag(rows, Es, As)[2]
        chosen = qs if len(qs) <= most else [qs[i] for i in rng.choice(len(qs), most, replace=False)]
        for q, a, gold in chosen:
            qv = bag(np.array([([ids[w] for w in all_stems(q) if w in ids] + [0] * 24)[:24]]), Eq, aq)[2][0]
            z = np.tanh(W1[question_features(q)].sum(0)) @ W2 + b
            p = np.exp(z - z.max())
            F, bm = features(q, title, sents, index, qv, svecs, p / p.sum())
            # The twenty-four likeliest by the two simple scores, and the right one.
            keep = set(np.argsort(-bm)[:16]) | set(np.argsort(-F[:, 2])[:10]) | gold
            keep = sorted(keep)
            out.append((F[keep], np.array([i in gold for i in keep]), bm[keep], len(gold & set(np.argsort(-bm)[:16]) | gold & set(np.argsort(-F[:, 2])[:10])) > 0))
    return out


def measure(data, score):
    top = np.zeros(3)
    for F, y, bm, reachable in data:
        order = np.argsort(-score(F, bm), kind='stable')
        top += [y[order[:k]].any() and reachable for k in (1, 3, 5)]
    return 100 * top / len(data)


def train_ranker(train, dev, enc, typenet):
    t0 = time.time()
    data, test = prepare(train, enc, typenet, 150), prepare(dev, enc, typenet, 200)
    print(f'ranker: {len(data)} questions to learn from, {len(test)} to test, {time.time() - t0:.0f}s', flush=True)
    mu = np.concatenate([F for F, *_ in data]).mean(0)
    sd = np.concatenate([F for F, *_ in data]).std(0) + 1e-3
    A = rng.normal(0, 0.3, (FEATURES, HIDDEN)).astype(np.float32)
    c = np.zeros(HIDDEN, np.float32)
    B = rng.normal(0, 0.1, HIDDEN).astype(np.float32)
    opt = Adam([A, c, B], 0.004)
    score = lambda F, _=None: np.tanh(((F - mu) / sd) @ A + c) @ B
    base = measure(test, lambda F, bm: bm)
    near = measure(test, lambda F, bm: F[:, 2])
    print('BM25 alone     top 1/3/5:', base.round(1), '\nencoder alone  top 1/3/5:', near.round(1), flush=True)
    for epoch in range(8):
        for k in np.array_split(rng.permutation(len(data)), len(data) // 16):
            gA, gc, gB = np.zeros_like(A), np.zeros_like(c), np.zeros_like(B)
            for i in k:
                F, y, *_ = data[i]
                x = (F - mu) / sd
                h = np.tanh(x @ A + c)
                z = h @ B
                p = np.exp(z - z.max())
                p /= p.sum()
                d = (p - y / y.sum())[:, None]
                back = d * B * (1 - h * h)
                gA += x.T @ back
                gc += back.sum(0)
                gB += (h * d).sum(0)
            opt.step([gA / len(k) + 1e-4 * A, gc / len(k), gB / len(k)])
        print(f'ranker {epoch}: top 1/3/5:', measure(test, score).round(1), flush=True)
        opt.rate *= 0.75
    return mu.astype(np.float32), sd.astype(np.float32), A, c, B, base, measure(test, score)


def squeeze(M):
    """Rows as bytes with one scale for each."""
    scale = np.abs(M).max(1, keepdims=True) / 127 + 1e-9
    return np.rint(M / scale).astype(np.int8), scale[:, 0].astype(np.float32)


def main(folder, target):
    folder = Path(folder)
    train, dev = load(folder / 'train-v1.1.json'), load(folder / 'dev-v1.1.json')
    # The ranker learns from articles the other two parts never saw. On their own articles the encoder is
    # far too sure of itself, and a ranker taught there trusts it too much.
    order = rng.permutation(len(train))
    first, second = [train[i] for i in order[:300]], [train[i] for i in order[300:]]
    typenet = train_types(first, dev)
    enc = train_encoder(first, dev)
    mu, sd, A, c, B, base, final = train_ranker(second, dev, enc, typenet)
    vocab, ids, Eq, Es, aq, As = enc
    W1, W2, b, right = typenet
    blobs = []

    def put(name, x):
        x = np.ascontiguousarray(x)
        blobs.append((name, 'b' if x.dtype == np.int8 else 'f', list(x.shape), x.tobytes()))
    for name, M in (('Eq', Eq), ('Es', Es), ('W1', W1)):
        m, sc = squeeze(M)
        put(name, m)
        put(name + 's', sc)
    for name, x in (('aq', aq), ('As', As), ('W2', W2), ('b', b), ('mu', mu), ('sd', sd), ('A', A), ('c', c), ('B', B)):
        put(name, x.astype(np.float32))
    blobs.sort(key=lambda x: x[1] != 'f')          # floats first, so they are aligned
    info = {'types': TYPES, 'typesRight': round(100 * right, 1), 'bm25': [round(float(x), 1) for x in base], 'network': [round(float(x), 1) for x in final],
            'questions': sum(len(q) for *_, q in train), 'source': 'SQuAD 1.1 (CC BY-SA 4.0)'}
    head = json.dumps({'info': info, 'vocab': vocab, 'dim': DIM, 'buckets': BUCKETS, 'arrays': [[n, t, sh, len(x)] for n, t, sh, x in blobs]}, ensure_ascii=False, separators=(',', ':')).encode()
    head += b' ' * (-(len(head) + 4) % 4)
    Path(target).write_bytes(struct.pack('<I', len(head)) + head + b''.join(x for *_, x in blobs))
    print(json.dumps(info), f'{Path(target).stat().st_size / 1e6:.2f} MB')


if __name__ == '__main__':
    main(*sys.argv[1:3])
