"""The memory of the brain: how often people put English words together.

A 4-gram model with interpolated Kneser-Ney smoothing. The file is memory-mapped, so it opens at once and needs little RAM.
Nothing outside the standard library is used here.
"""
import json
import math
import mmap
import struct
from bisect import bisect_left
from functools import lru_cache

UNK, BOS, EOS = 0, 1, 2
MAGIC = b'VINAS001'


class Model:
    def __init__(self, path):
        with open(path, 'rb') as f:
            self._map = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
        view = memoryview(self._map)
        if bytes(view[:8]) != MAGIC:
            raise ValueError(f'{path} is not a brain file')
        size = struct.unpack('<Q', view[8:16])[0]
        head = json.loads(bytes(view[16:16 + size]))
        self.info = head['info']
        self.ids = {w: i for i, w in enumerate(head['words'])}
        base = 16 + size
        self._a = {name: view[base + at:base + at + length].cast(kind) for name, kind, at, length in head['arrays']}
        self._exp = [math.exp(-i / 4000) for i in range(65536)]
        self.logp = lru_cache(maxsize=100_000)(self._logp)

    def id(self, word):
        return self.ids.get(word, UNK)

    def _get(self, name, key, default):
        keys = self._a[name + 'k']
        i = bisect_left(keys, key)
        return self._exp[self._a[name + 'v'][i]] if i < len(keys) and keys[i] == key else default

    def _logp(self, a, b, c, w):
        """Natural log of P(w | a b c)."""
        p = self._exp[self._a['1v'][w]]
        p = self._get('2', c << 16 | w, 0.0) + self._get('g1', c, 1.0) * p
        p = self._get('3', b << 32 | c << 16 | w, 0.0) + self._get('g2', b << 16 | c, 1.0) * p
        p = self._get('4', a << 48 | b << 32 | c << 16 | w, 0.0) + self._get('g3', a << 32 | b << 16 | c, 1.0) * p
        return math.log(p)

    def score(self, tokens):
        """Log probability of each token, then of the sentence end."""
        ids = [BOS, BOS, BOS, *map(self.id, tokens), EOS]
        return [self.logp(*ids[i - 3:i + 1]) for i in range(3, len(ids))]
