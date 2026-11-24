"""Rewrites text the way people write it.

For each sentence the brain lists every other wording it knows, then searches for the whole sentence people would be most
likely to write. It never invents words outside its list, and it leaves names, numbers, quotations, links and code alone.
"""
import re
from collections import deque

from . import phrases
from .model import BOS, EOS, UNK
from .text import TOKEN, norm, sentences

TYPES = ('general', 'personal', 'reference', 'informal', 'reply')
BEAM = 10
LEVELS = {'light': 0.4, 'normal': 1.6, 'strong': 3.2}    # how much the brain dislikes leaving a stiff wording, in nats
REPEAT_COST = 0.9       # how much it dislikes a choice it has just used
LIMIT = 50_000

PROTECTED = re.compile(
    r'`[^`\n]{1,2000}`|(?<=\])\([^()\s]{1,2000}\)|https?://[^\s<>)\]]+|www\.\S+|</?[a-zA-Z][^<>\n]{0,2000}>'
    r'|(?<![\w.+-])[\w.+-]{1,64}+@[\w-]{1,255}(?:\.\w{1,63}){1,8}|\b[A-Za-z]:\\[^\s"]+|(?<![\w/])\.{0,2}/[\w.-]{1,255}/[\w./-]+'
    r'|"[^"\n]{1,400}"|“[^”\n]{1,400}”')
SKIP_LINE = re.compile(r'\s*(?:#|>|\||\$ |---|\*\*\*|___|<)')
LEAD = re.compile(r'\s*(?:[-*•] |\d+[.)] )?')
FACT = re.compile(r'\d[\d.,]*\d|\d|https?://[^\s<>)\]]+')
NAME = re.compile(r"(?<=[^\W\d_]\s)[A-Z][\w'’-]*|(?<=[,;)]\s)[A-Z][\w'’-]*")
FUNCTION = set('''a an the and or but nor so yet if because as while when where which who whom whose that this these those to of in on at by for from with about into over under
 between through during before after above below is are was were be been being am has have had do does did can could will would shall should may might must not no
 it its he his she her they their them we our us you your i my me what how why than then there here also too just only even still all each every both any some such
 unless until since though although whether without within across against toward towards like up down out off again'''.split())
VERB_AFTER = set('to can could will would may might must shall should we you they i who that and or not help helps let lets also'.split())
NO_SHORT_AFTER = set('what where how who why when as than whatever wherever'.split())
BAD_AFTER_ARTICLE = {'many', 'lots', 'several', 'most', 'enough', 'all', 'a', 'an', 'the', 'some', 'not', 'more'}
THAT_VERBS = set('think thinks thought know knows knew say says said believe believes hope hopes feel feels felt mean means sure glad'.split())
HAVE_BE = set('have has had having is are was were be been being am'.split())
PRONOUNS = set('i you he she it we they there'.split())


def article(word):
    return 'an' if re.match(r'[aeiou]|hour|honest', word) and not re.match(r'uni|use|one\b|eu', word) else 'a'


def is_word(token):
    return token[0].isalpha()


def protected_map(text):
    """One byte per character: 1 where the text must not change."""
    out = bytearray(len(text))
    for m in PROTECTED.finditer(text):
        out[m.start():m.end()] = b'\1' * (m.end() - m.start())
    return out


def facts(text):
    names = {re.sub(r"['’]s$", '', n).lower() for n in NAME.findall(text) if not re.match(r"I(?:['’]|$)", n)}
    return sorted(FACT.findall(text)), names


class Rewriter:
    def __init__(self, model):
        self.model = model
        self.table = phrases.build()
        self.longest = max(map(len, self.table))
        self.turns = [(re.compile(p, re.I if not p.startswith(r'\bI ') else 0), r) for p, r in phrases.TURNS]

    # ---- one sentence ----

    def options(self, words, locked, type_, short_forms, own):
        """Every edit that fits: (start, end, replacement tokens, kind)."""
        found = []
        n = len(words)
        for i in range(n):
            if locked[i]:
                continue
            for size in range(min(self.longest, n - i), 0, -1):
                j = i + size
                entry = self.table.get(tuple(words[i:j]))
                if not entry or any(locked[i:j]) or (entry['kind'] != 'contract' and own and f' {" ".join(words[i:j])} ' in own):
                    continue
                before = words[i - 1] if i else ''
                after = words[j] if j < n else ''
                if not self.fits(entry, words[i:j], before, after, short_forms, i == 0):
                    continue
                # Technical and legal words are chosen on purpose, so only long phrases are shortened there.
                if type_ == 'reference' and entry['kind'] != 'phrase':
                    continue
                # "problems remain" is not "problems stay"
                if words[i].startswith('remain') and not (after and is_word(after)):
                    continue
                # "provide people with help" is not "give people with help"
                if words[i].startswith('provid') and 'with' in words[j:j + 7]:
                    continue
                near = {w for w in words[max(0, i - 4):i] + words[j:j + 4] if is_word(w) and w not in FUNCTION}
                choices = entry['choices']
                if entry['kind'] == 'past':
                    # "have shown" and "was shown", but "it showed"
                    perfect = any(w in HAVE_BE or w.endswith(("'ve", "'re", "'s")) for w in words[max(0, i - 3):i])
                    choices = [c for c, part in choices if part is None or part == perfect]
                for choice in choices:
                    # Technical text should not start speaking to the reader.
                    if type_ == 'reference' and {'you', 'we', 'us', 'i', 'people'}.intersection(choice):
                        continue
                    if not short_forms and any("'" in t for t in choice):
                        continue
                    if near.intersection(choice) - set(words[i:j]):    # "often often"
                        continue
                    start, new = i, choice
                    if before in ('a', 'an') and entry['kind'] != 'contract' and not locked[i - 1]:
                        if choice[0] in BAD_AFTER_ARTICLE:
                            continue
                        start, new = i - 1, (article(choice[0]), *choice)
                    elif choice[-1] == 'that' and after == 'that':
                        continue
                    found.append((start, j, new, entry['kind']))
        if type_ != 'reference':
            for i in range(1, n - 1):
                if words[i] == 'that' and words[i - 1] in THAT_VERBS and words[i + 1] in PRONOUNS and not locked[i]:
                    found.append((i, i + 1, (), 'that'))
        return found

    def fits(self, entry, source, before, after, short_forms, first):
        kind = entry['kind']
        # "Therefore," opens a sentence; "is, therefore, to" does not
        if source[-1] == ',' and not first:
            return False
        if after in entry['not_before'] or (entry['only_before'] and after not in entry['only_before']):
            return False
        if kind == 'contract':
            if not short_forms or after in ('only', 'just'):
                return False
            if source[-1] == 'not' or source == ['cannot']:
                return True
            if not after or not is_word(after) or after in ('and', 'or', 'but', 'nor', 'not', 'today', 'now', 'because', 'if', 'when'):
                return False
            if before in NO_SHORT_AFTER or (source[0] == 'that' and not first):
                return False
            # "you have a car" is not "you've a car"
            return source[-1] != 'have' or after in ('been', 'already', 'seen', 'made', 'done', 'never', 'always', 'become', 'found', 'learned', 'got') or after.endswith('ed')
        if kind == 'verb' and source[0] in phrases.ALSO_NOUNS:
            return before in VERB_AFTER or first or (source[0].endswith('s') and after in ('a', 'an', 'the', 'over', 'some'))
        if kind == 'noun':
            # A noun used as a describing word is nearly always singular.
            return source[0].endswith('s') or not after or not is_word(after) or after in FUNCTION
        if kind in ('verb', 'past') and after and is_word(after) and before in ('the', 'this', 'its', 'their', 'our', 'your', 'his', 'her') and after not in FUNCTION:
            # "the required documents": only a swap that stays an adjective would do, so leave it
            return False
        return True

    def search(self, words, options, recent, keep_cost):
        """The likeliest way to write the sentence, as a list of (start, end, replacement or None, kind)."""
        logp, get = self.model.logp, self.model.id
        at = {}
        stiff = {}
        for o in options:
            at.setdefault(o[0], []).append(o)
            if o[3] not in ('contract', 'that'):
                # The cost of keeping sits on the last word of the phrase, which every way of keeping it passes.
                stiff[o[1] - 1] = keep_cost
        n = len(words)
        beams = [dict() for _ in range(n + 1)]
        beams[0][(BOS, BOS, BOS)] = (0.0, None)
        ids = [get(w) for w in words]

        def push(end, state, score, path):
            old = beams[end].get(state)
            if old is None or old[0] < score:
                beams[end][state] = (score, path)

        for i in range(n):
            ranked = sorted(beams[i].items(), key=lambda kv: -kv[1][0])[:BEAM]
            for (a, b, c), (score, path) in ranked:
                w = ids[i]
                push(i + 1, (b, c, w), score + logp(a, b, c, w) - stiff.get(i, 0.0), (path, (i, i + 1, None, '')))
                for start, end, new, kind in at.get(i, ()):
                    s, state = score, (a, b, c)
                    for token in new:
                        t = get(token)
                        s += logp(*state, t)
                        state = (state[1], state[2], t)
                    s -= REPEAT_COST * recent.count(new)
                    push(end, state, s, (path, (start, end, new, kind)))
        best = max(beams[n].items(), key=lambda kv: kv[1][0] + logp(*kv[0], EOS))
        steps, path = [], best[1][1]
        while path:
            path, step = path
            steps.append(step)
        return steps[::-1]

    def sentence(self, text, protected, type_, short_forms, own, recent, keep_cost):
        """Returns the new sentence and its edits as (before, after)."""
        marks = [m.span() for m in TOKEN.finditer(text)]
        if not marks:
            return text, []
        raw = [text[a:b] for a, b in marks]
        words = [norm(t) for t in raw]
        first = next((i for i, t in enumerate(raw) if is_word(t)), 0)
        locked = [
            any(protected[s:e])
            or (i != first and is_word(t) and t[0].isupper() and words[i] not in ('i',) and not words[i].startswith("i'"))
            or (is_word(t) and len(t) > 1 and t.isupper())
            for i, ((s, e), t) in enumerate(zip(marks, raw))
        ]
        options = self.options(words, locked, type_, short_forms, own)
        if not options:
            return text, []
        steps = self.search(words, options, recent, keep_cost)
        out, edits, at = [], [], 0
        for start, end, new, kind in steps:
            if new is None:
                continue
            a, b = marks[start][0], marks[end - 1][1]
            old = text[a:b]
            now = re.sub(r' ([,.;:!?])', r'\1', ' '.join(new))
            now = re.sub(r"\bi(?=$|['’ ])", 'I', now)
            if old[0].isupper() and now:
                now = now[0].upper() + now[1:]
            if '’' in text:
                now = now.replace("'", '’')
            out.append(text[at:a])
            at = b
            if not now and text[at:at + 1] == ' ':
                at += 1
            out.append(now)
            edits.append((old, now))
            if kind != 'contract':
                recent.append(new)
        out.append(text[at:])
        result = ''.join(out)
        if facts(result) != facts(text):
            return text, []
        return result, edits

    # ---- rhythm ----

    @staticmethod
    def join(parts):
        """Joins two short sentences inside a run of even ones. parts are (text, gap after it)."""
        edits = []
        count = lambda s: len(re.findall(r"[\w'’-]+", s))
        i = 0
        while i + 2 < len(parts):
            a, b, c = (p[0] for p in parts[i:i + 3])
            na, nb, nc = count(a), count(b), count(c)
            m = re.match(r'(It|They|He|She|We|You) (?=[a-z])', b)
            even = 4 <= min(na, nb, nc) and max(na, nb, nc) <= 13 and max(na, nb, nc) - min(na, nb, nc) <= 3
            if even and m and re.fullmatch(r"[^?!.;:()\"“”]+\.", a) and re.fullmatch(r"[^?!.;:()\"“”]+\.", b) \
                    and not re.search(r'\b(?:and|but|or|so|because)\b', a) and not re.match(r'(?:If|When|While|Although)\b', a):
                new = f'{a[:-1]}, and {b[0].lower()}{b[1:]}'
                edits.append((f'{a} {b}', new))
                parts[i:i + 2] = [(new, parts[i + 1][1])]
                i += 2
            else:
                i += 1
        return edits

    # ---- whole text ----

    def run(self, text, type_='general', sample='', contractions=None, level='normal'):
        type_ = type_ if type_ in TYPES else 'general'
        short_forms = type_ != 'reference' if contractions is None else contractions
        own = f' {" ".join(norm(t) for t in TOKEN.findall(sample))} ' if sample.strip() else ''
        keep_cost = LEVELS.get(level, LEVELS['normal'])
        edits, out, fence, front = [], [], False, False
        recent = deque(maxlen=6)
        for number, line in enumerate(text.split('\n')):
            if line.strip() == '---' and (number == 0 or front):
                front = not front
            elif line.lstrip().startswith('```'):
                fence = not fence
            elif not fence and not front and line.strip() and not SKIP_LINE.match(line):
                line, changes = self.line(line, type_, short_forms, own, recent, keep_cost)
                edits += changes
            out.append(line)
        result = '\n'.join(out)
        return {'text': result, 'edits': [{'before': a, 'after': b} for a, b in edits], 'stiff': self.stiff(result, type_)}

    def turn(self, body, own):
        """Reshapes set expressions that are more than a swap of words."""
        edits, now = [], body
        for pattern, new in self.turns:
            if not pattern.search(now):
                continue
            closed = protected_map(now)

            def swap(m):
                if any(closed[m.start():m.end()]) or (own and m[0].lower() in own):
                    return m[0]
                out = new(m) if callable(new) else m.expand(new)
                if m[0][0].isupper():
                    out = out[0].upper() + out[1:]
                edits.append((m[0].strip(' ,'), out.strip(' ,')))
                return out
            now = pattern.sub(swap, now)
        return (now, edits) if facts(now) == facts(body) else (body, [])

    def line(self, line, type_, short_forms, own, recent, keep_cost):
        lead = LEAD.match(line).end()
        body = line[lead:]
        edits = []
        if type_ != 'reference':
            body, edits = self.turn(body, own)
        protected = protected_map(body)
        marks = sentences(body)
        parts = []
        for k, (a, b) in enumerate(marks):
            new, changes = self.sentence(body[a:b], protected[a:b], type_, short_forms, own, recent, keep_cost)
            edits += changes
            parts.append((new, body[b:marks[k + 1][0]] if k + 1 < len(marks) else body[b:]))
        if type_ != 'reference' and lead == 0:
            edits += self.join(parts)
        return line[:lead] + ''.join(t + gap for t, gap in parts), edits

    def stiff(self, text, type_='general'):
        """Up to three sentences that are further from everyday English than 19 in 20 human ones."""
        bar = self.model.info['marks']['talk' if type_ == 'informal' else 'written'][19]
        found, fence = [], False
        for line in text.split('\n'):
            if line.lstrip().startswith('```'):
                fence = not fence
            if fence or SKIP_LINE.match(line):
                continue
            for a, b in sentences(line):
                tokens = [norm(t) for t in TOKEN.findall(line[a:b])]
                if sum(map(is_word, tokens)) < 8:
                    continue
                logs = self.model.score(tokens)
                # Names and rare terms say what the text is about, not how it is written.
                known = [x for t, x in zip(tokens, logs) if self.model.id(t) != UNK]
                cost = -(sum(known) + logs[-1]) / (len(known) + 1)
                if cost > bar:
                    found.append((cost, line[a:b]))
        return [s for _, s in sorted(found, reverse=True)[:3]]
