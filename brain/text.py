"""Splits English into sentences and tokens. Training and rewriting must use the same code."""
import re

TOKEN = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*|\d[\d.,:]*\d|\d|[^\w\s]|_")
ABBREV = re.compile(r"(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|No|Inc|Ltd|Co|Fig|e\.g|i\.e|U\.S|a\.m|p\.m)|\b[A-Z])\.$")
# The "++" never gives characters back, so a long run of dots or spaces stays quick.
SENTENCE_END = re.compile(r"(?<![.!?])[.!?]++[\"'”’)\]]*+(?=\s++[\"'“‘(\[]?[A-Z0-9])")
NUMBER = '<n>'
PLAIN = str.maketrans('’‘“”–—', "''\"\"--")


def norm(token):
    """The form a token has inside the model."""
    return NUMBER if token[0].isdigit() else token.lower().translate(PLAIN)


def sentences(line):
    """(start, end) of every sentence in one line."""
    out, start = [], 0
    for m in SENTENCE_END.finditer(line):
        if ABBREV.search(line[max(start, m.end() - 12):m.end()]):
            continue
        out.append((start, m.end()))
        start = m.end()
        while start < len(line) and line[start].isspace():
            start += 1
    if line[start:].strip():
        out.append((start, len(line)))
    return out
