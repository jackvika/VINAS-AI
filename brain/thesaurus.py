"""Finds overused words in a text and looks up other words for them in a public dictionary, Datamuse.

Only single words from the list below are ever sent there, one at a time. The text is not.
"""
import json
import os
import re
import threading
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

from .phrases import VERBS as KNOWN_VERBS, WORDS as KNOWN_WORDS, forms, lines
from .text import TOKEN, norm

# Words that language models overuse. None is wrong; a plainer or more exact one is often better.
VERBS = '''delve underscore showcase foster bolster garner leverage harness streamline elevate empower navigate unlock unleash embark encompass facilitate utilize
exemplify epitomize transcend resonate captivate revolutionize spearhead illuminate elucidate orchestrate cultivate amplify reimagine redefine unveil
underpin necessitate mitigate optimize enhance emphasize highlight ensure demonstrate implement'''.split()
WORDS = '''crucial pivotal vital paramount multifaceted intricate nuanced comprehensive robust seamless seamlessly meticulous meticulously vibrant bustling profound profoundly
innovative groundbreaking transformative unprecedented invaluable indispensable holistic dynamic compelling noteworthy commendable unwavering steadfast tapestry testament realm
landscape beacon cornerstone interplay synergy paradigm plethora myriad intricacies endeavor endeavors notably ultimately essentially fundamentally undoubtedly
increasingly significantly actionable impactful insightful timeless enduring numerous various distinct effectively efficiently'''.split()
STOCK = {w: (w, 0, 'word') for w in WORDS}
for _verb in VERBS:
    for _form, _word in enumerate(forms(_verb)):
        STOCK.setdefault(_word, (_verb, _form, 'verb'))
# Choices that were read through by hand come before the dictionary's.
REVIEWED = {key: [c for c in choices if c] for block in (KNOWN_VERBS, KNOWN_WORDS) for key, choices in lines(block)}
QUOTED = re.compile(r'"[^"\n]{1,400}"|“[^”\n]{1,400}”|https?://\S+')
MOST = 12           # lookups for one part
TIMEOUT = 5


def find(text):
    """The overused words in a text, in order, as written there. Names, quotations and links do not count."""
    skip = [m.span() for m in QUOTED.finditer(text)]
    found, before = [], ''
    for m in TOKEN.finditer(text):
        word = m[0]
        name = word[0].isupper() and before[-1:].isalpha()
        if norm(word) in STOCK and not name and not any(a <= m.start() < b for a, b in skip):
            found.append(word)
        before = word
    return found


class Thesaurus:
    def __init__(self, known=(), env=os.environ):
        self.known = known      # the brain's vocabulary: a word it never met is no plainer choice
        self.key = env.get('DATAMUSE_KEY', '').strip()
        self.on = env.get('THESAURUS', 'on').strip().lower() != 'off'
        self._cache, self._lock = OrderedDict(), threading.Lock()
        self._open = urllib.request.build_opener(urllib.request.ProxyHandler({})).open
        self._pool = ThreadPoolExecutor(4)

    def _fetch(self, word):
        query = {'rel_syn': word, 'max': 20, 'md': 'pf'}
        if self.key:
            query['key'] = self.key
        with self._open('https://api.datamuse.com/words?' + urllib.parse.urlencode(query), timeout=TIMEOUT) as r:
            return json.loads(r.read(100_000))

    def _base(self, base, kind):
        """Other words for the base form, the commonest first. An empty list when the dictionary is away."""
        with self._lock:
            if base in self._cache:
                self._cache.move_to_end(base)
                return self._cache[base]
        try:
            rows = self._fetch(base)
        except (OSError, ValueError):
            return []
        out = []
        for row in rows if isinstance(rows, list) else []:
            word, tags = (row.get('word'), row.get('tags') or []) if isinstance(row, dict) else (None, [])
            if not isinstance(word, str) or not re.fullmatch(r'[a-z]{2,20}', word) or word in STOCK or (self.known and word not in self.known):
                continue
            # Words that are mainly nouns, such as "case" for "showcase", make poor verbs.
            role = next((t for t in tags if t in ('n', 'v', 'adj', 'adv')), '')
            if kind == 'verb' and role != 'v':
                continue
            often = max((float(t[2:]) for t in tags if isinstance(t, str) and re.fullmatch(r'f:\d+(?:\.\d+)?', t)), default=0.0)
            if often >= 3:
                out.append((often, word))
        words = [w for _, w in sorted(out, reverse=True)][:6]
        with self._lock:
            self._cache[base] = words
            while len(self._cache) > 3000:
                self._cache.popitem(last=False)
        return words

    def options(self, words):
        """{word: other words in the same form} for overused words."""
        if not self.on:
            return {}
        wanted = list(OrderedDict.fromkeys(norm(w) for w in words if norm(w) in STOCK))[:MOST]
        found = list(self._pool.map(lambda w: self._base(*STOCK[w][::2]), wanted))
        out = {}
        for word, bases in zip(wanted, found):
            base, form, kind = STOCK[word]
            bases = list(OrderedDict.fromkeys([*REVIEWED.get(base, []), *bases]))[:7]
            choices = [forms(b)[form] if kind == 'verb' and len(b) > 1 else b for b in bases]
            if choices:
                out[word] = choices
        return out
