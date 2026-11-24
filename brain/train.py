"""Teaches the brain from text people wrote. Run once; the server only needs the file this makes.

    python -m brain.train DATA_FOLDER brain/human.bin

DATA_FOLDER holds oanc.zip (Open American National Corpus) and eng.tsv.bz2 (English Tatoeba sentences).
Needs numpy and about 4 GB of memory.
"""
import bz2
import json
import math
import re
import struct
import sys
import zipfile
from collections import Counter
from pathlib import Path

import numpy as np

from .model import BOS, EOS, MAGIC, UNK, Model
from .text import NUMBER, TOKEN, norm, sentences

VOCAB = 50_000
KEEP = {2: 2, 3: 2, 4: 3}       # n-grams seen fewer times than this are dropped
LAST_HUMAN_ID = 11_000_000      # Tatoeba ids rise with time; this one is from before ChatGPT
HELD_OUT = 50                   # one block in this many is kept back for testing


def tatoeba(path):
    with bz2.open(path, 'rt', encoding='utf-8') as f:
        for line in f:
            number, _, text = line.rstrip('\n').split('\t')[:3]
            if int(number) < LAST_HUMAN_ID:
                yield int(number) // 100, 'talk', text


def oanc(path):
    with zipfile.ZipFile(path) as z:
        for block, name in enumerate(sorted(n for n in z.namelist() if n.endswith('.txt'))):
            # Biomedical papers are full of terms few people use.
            if '/data/' not in name or 'biomed' in name.lower() or 'plos' in name.lower():
                continue
            raw = z.read(name)
            text = raw.decode('utf-16' if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else 'utf-8', 'replace')
            kind = 'talk' if '/spoken/' in name else 'written'
            for para in re.split(r'\n\s*\n' if kind == 'written' else r'\n', text):
                para = ' '.join(para.split())
                for a, b in sentences(para):
                    yield block, kind, para[a:b]


def usable(tokens):
    words = sum(t[0].isalpha() for t in tokens)
    return 3 <= len(tokens) <= 80 and words >= 0.6 * len(tokens)


def pack(values):
    """Probabilities as 16-bit logs: ln p is about -value / 4000."""
    return np.clip(np.rint(-np.log(np.maximum(values, 1e-8)) * 4000), 0, 65535).astype('<u2')


def starts_of(sorted_keys):
    return np.flatnonzero(np.r_[True, sorted_keys[1:] != sorted_keys[:-1]])


def shorter(keys, counts, bits):
    """Kneser-Ney: a shorter n-gram counts once for each different word seen before it."""
    tail = keys & np.uint64((1 << bits) - 1)
    rank = np.argsort(tail, kind='stable')
    tail, counts = tail[rank], counts[rank]
    starts = starts_of(tail)
    before = np.diff(np.r_[starts, len(tail)])
    raw = np.add.reduceat(counts, starts)
    tail = tail[starts]
    # Nothing can come before a start marker, so those keep their plain count.
    return tail, np.where((tail >> np.uint64(bits - 16)) == BOS, raw, before)


def discounted(keys, counts, keep):
    """Kept n-grams with their probability, and the weight each context leaves for shorter ones."""
    ones, twos = (counts == 1).sum(), (counts == 2).sum()
    d = ones / (ones + 2 * twos)
    ctx = keys >> np.uint64(16)
    starts = starts_of(ctx)
    sizes = np.diff(np.r_[starts, len(ctx)])
    alpha = np.maximum(counts - d, 0) / np.repeat(np.add.reduceat(counts, starts), sizes)
    alpha[counts < keep] = 0
    gamma = 1 - np.add.reduceat(alpha, starts)
    held, used = alpha > 0, gamma < 1 - 1e-9
    print(f'  kept {held.sum():,} of {len(keys):,}, discount {d:.2f}', flush=True)
    return keys[held], alpha[held], ctx[starts][used], gamma[used]


def write(path, info, vocab, arrays):
    table, blobs, at = [], [], 0
    for name in sorted(arrays, key=lambda n: -arrays[n].itemsize):    # widest first, so all are aligned
        blob = arrays[name].tobytes()
        table.append((name, 'Q' if arrays[name].itemsize == 8 else 'H', at, len(blob)))
        blobs.append(blob)
        at += len(blob)
    head = json.dumps({'info': info, 'words': vocab, 'arrays': table}, separators=(',', ':')).encode()
    head += b' ' * (-len(head) % 8)
    with open(path, 'wb') as f:
        f.write(MAGIC + struct.pack('<Q', len(head)) + head)
        f.writelines(blobs)


def main(folder, target):
    folder = Path(folder)
    seen, words, kinds, train, held = set(), Counter(), Counter(), [], []
    for source in (tatoeba(folder / 'eng.tsv.bz2'), oanc(folder / 'oanc.zip')):
        for block, kind, text in source:
            tokens = [sys.intern(norm(t)) for t in TOKEN.findall(text)]
            key = hash(tuple(tokens))
            if not usable(tokens) or key in seen:
                continue
            seen.add(key)
            if block % HELD_OUT == 7:
                held.append((kind, text))
                continue
            train.append(' '.join(tokens))
            words.update(tokens)
            kinds[kind] += len(tokens)
    del seen
    print(f'{len(train):,} sentences, {sum(kinds.values()):,} tokens {dict(kinds)}, {len(held):,} held out', flush=True)

    vocab = ['<unk>', '<s>', '</s>', NUMBER] + [w for w, n in words.most_common(VOCAB) if n > 2 and w != NUMBER]
    ids = {w: i for i, w in enumerate(vocab)}
    stream = np.fromiter((i for s in train for i in (BOS, BOS, BOS, *(ids.get(t, UNK) for t in s.split(' ')), EOS)), dtype=np.uint64)
    n_sentences = len(train)
    del train, words
    ends = np.flatnonzero(stream != BOS)
    keys4 = stream[ends]
    for back in (1, 2, 3):
        keys4 |= stream[ends - back] << np.uint64(16 * back)
    del stream, ends
    keys4.sort()
    starts = starts_of(keys4)
    n4 = np.diff(np.r_[starts, len(keys4)])
    keys4 = keys4[starts]
    keys3, n3 = shorter(keys4, n4, 48)
    keys2, n2 = shorter(keys3, n3, 32)
    keys1, n1 = shorter(keys2, n2, 16)
    uni = np.full(len(vocab), 0.2)
    uni[keys1.astype(int)] += n1
    uni[BOS] = 1e-3
    uni[UNK] *= 0.02            # it stands for a great many different words
    arrays = {'1v': pack(uni / uni.sum())}
    for n, keys, counts in ((2, keys2, n2), (3, keys3, n3), (4, keys4, n4)):
        k, a, c, g = discounted(keys, counts, KEEP[n])
        arrays |= {f'{n}k': k.astype('<u8'), f'{n}v': pack(a), f'g{n - 1}k': c.astype('<u8'), f'g{n - 1}v': pack(g)}

    info = {'sentences': n_sentences, 'words': dict(kinds), 'sources': ['Open American National Corpus', 'Tatoeba (CC BY 2.0 FR)']}
    draft = folder / 'draft.bin'
    write(draft, info, vocab, arrays)
    (folder / 'held.json').write_text(json.dumps(held), encoding='utf-8')

    # What ordinary human sentences score, so a new one can be placed among them.
    model = Model(draft)
    total, count, marks, lengths = 0.0, 0, {'talk': [], 'written': []}, {'talk': [], 'written': []}
    for kind, text in held:
        tokens = [norm(t) for t in TOKEN.findall(text)]
        s = model.score(tokens)
        total += sum(s)
        count += len(s)
        lengths[kind].append(sum(t[0].isalpha() for t in tokens))
        if len(tokens) >= 8:
            marks[kind].append(-sum(s) / len(s))
    info['perplexity'] = round(math.exp(-total / count), 1)
    info['marks'] = {k: [round(float(x), 3) for x in np.percentile(v, range(0, 101, 5))] for k, v in marks.items()}
    info['length'] = {k: {'mean': round(float(np.mean(v)), 1), 'spread': round(float(np.std(v)), 1)} for k, v in lengths.items()}
    write(target, info, vocab, arrays)
    print(json.dumps(info), f'{Path(target).stat().st_size / 1e6:.1f} MB')


if __name__ == '__main__':
    main(*sys.argv[1:3])
