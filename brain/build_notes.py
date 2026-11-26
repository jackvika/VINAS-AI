"""Builds static/books/notes-*.json from the site owner's own BBA Semester 1 notes, given as PDF files.

    python brain/build_notes.py <folder of PDFs> static/books

Each PDF is read with its fonts: a line set larger than the running text is a heading, a whole line in bold at the size of the
text is a small heading ("Objectives of management"), a line that starts with a bullet or a number is a point, and a table
becomes one point per row ("Efficiency - Main focus: ..."). Page headers and footers, contents pages, word lists, questions,
answer keys and case studies are left out. The notes of one subject go into one book, a chapter for each unit.
"""
import json
import os
import re
import sys
from collections import Counter

import pymupdf

SUBJECTS = [
    ('notes-management', 'Principles and Practices of Management', r'\bmanagement\b|administration'),
    ('notes-business-law', 'Business Law', r'business law|partnership act|sale of goods'),
    ('notes-accounting', 'Financial Accounting', r'accounting'),
    ('notes-economics', 'Business Economics', r'economics|inflation|business cycle'),
    ('notes-communication', 'Business Communication', r'communication|listening'),
]
# Parts that teach nothing to a reader of answers.
SKIP = re.compile(r'^(?:what the difficult words mean|difficult words|check yourself|answers?\b|answer key|self[- ]assessment|terminal questions|table of contents|contents|learning objectives|keywords|key words|key vocabulary|key terminology|glossary|references|suggested readings|further reading|case stud|case let|case \d|case questions|case-based|activity|model question|questions? for|mcqs?\b|multiple choice|summary|how to read|how to prepare|answer word limits|understanding your exam|exam practice|exam tips?|important questions|important definitions for quick|final exam priority|fill in the blanks|true or false|unit end|practice questions|review questions|mark scheme|section a\b|additional practice mcq|section b: exam-ready|section c: long-answer preparation|revised answers|complete exam-oriented|additional topics required|background|problems|challenges|result \(|lesson:|what management did|questions$|short answer questions|long answer questions)', re.I)
# The units, as each subject's syllabus names them.
UNITS = {
    'notes-management': ['Introduction to Management', 'Functions and Processes of Management', 'Management and Administration'],
    'notes-business-law': ['Introduction to Business Law', 'Sale of Goods Act, 1930', 'Indian Partnership Act, 1932'],
    'notes-accounting': ['Introduction to Accounting and its Role in Business', 'Principles and Concepts of Accounting', 'Double-Entry Accounting System'],
    'notes-economics': ['Introduction to Economics', 'Business Cycle', 'Inflation and Recession'],
    'notes-communication': ['Introduction to Business Communication', 'Formal and Informal Communication', 'Reading and Listening Skills'],
}
BULLET = re.compile(r'^\s*(?:[●•▪◦■□➢➤✓✔\-–*]|\(?\d{1,2}[.)]|\(?[a-hivx]{1,4}\))[\s​]+')
NOISE = re.compile(r'^(?:page \d+(?: of \d+)?|\d{1,3}|bba semester 1.*|bachelor of business administration|semester 1)$', re.I)


def clean(t):
    t = t.replace('​', ' ').replace('\xad', '').replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def lines_of(page, tables):
    """The lines of a page outside its tables, with size, boldness and where they start."""
    out = []
    for b in page.get_text('dict')['blocks']:
        for line in b.get('lines', []):
            spans = [s for s in line['spans'] if s['text'].strip()]
            if not spans:
                continue
            x0, y0, x1, y1 = line['bbox']
            if any(t[0] - 2 <= x0 and x1 <= t[2] + 2 and t[1] - 2 <= y0 and y1 <= t[3] + 2 for t in tables):
                continue
            text = clean(''.join(s['text'] for s in line['spans']))
            if not text:
                continue
            chars = sum(len(s['text'].strip()) for s in spans)
            bold = sum(len(s['text'].strip()) for s in spans if s['flags'] & 16 or 'bold' in s['font'].lower()) >= 0.8 * chars
            size = max(round(s['size'], 1) for s in spans)
            out.append({'text': text, 'size': size, 'bold': bold, 'y': y0, 'x': x0, 'page': page.number})
    return out


def table_rows(page):
    """Each table as points, a row at a time, with the heads of its columns."""
    found, boxes = [], []
    try:
        tabs = page.find_tables().tables
    except Exception:
        return found, boxes
    for tab in tabs:
        # Each cell read from the page, so that the words keep their spaces.
        rows = [[clean(page.get_text('text', clip=c)) if c else '' for c in r.cells] for r in tab.rows]
        rows = [r for r in rows if any(r)]
        if len(rows) < 2 or len(rows[0]) < 2:
            continue
        boxes.append(tab.bbox)
        head = rows[0]
        if any(re.search(r'fig no|saq|page no|sl\.? ?no', h, re.I) for h in head) or re.match(r'(?:word|term)s?$', head[0], re.I):
            continue
        for r in rows[1:]:
            if not r[0] or r == head:
                continue
            # A row is one line: the sentences of a cell are joined, so that no sentence is taken without its row's name.
            r = [re.sub(r'\.\s+(?=[A-Z(])', '; ', v).rstrip(' .') for v in r]
            rest = [f'{h}: {v}' if h else v for h, v in zip(head[1:], r[1:]) if v]
            if len(head) == 2 and r[1]:
                # "Lack of training: treating listening as ...": the second column's head adds nothing.
                found.append((tab.bbox[1], f'{r[0]}: {r[1]}'))
            elif rest:
                found.append((tab.bbox[1], f"{r[0]} - {'; '.join(rest)}"))
    return found, boxes


def sentence(t):
    t = re.sub(r'\s+([,.;:])', r'\1', t).strip()
    return t if re.search(r'[.!?:)]$', t) else t + '.'


def read_pdf(path):
    doc = pymupdf.open(path)
    every = []
    for page in doc:
        rows, boxes = table_rows(page)
        got = lines_of(page, boxes)
        got += [{'text': t, 'size': 0, 'bold': False, 'y': y, 'x': 0, 'page': page.number, 'row': True} for y, t in rows]
        got.sort(key=lambda l: l['y'])
        every += got
    # The running text is the size most of the letters are set in.
    weight = Counter()
    for l in every:
        if not l.get('row'):
            weight[l['size']] += len(l['text'])
    body = weight.most_common(1)[0][0]
    # Lines on most pages at the same words are headers and footers.
    again = Counter(re.sub(r'\d+', '#', l['text']) for l in every)
    pages = doc.page_count
    big = sorted({l['size'] for l in every if l['size'] >= body + 1.4 and len(l['text'].split()) <= 16}, reverse=True)
    # A chapter heading is the size that most "Part 2: ..." and "3. NATURE ..." headings are set in.
    # "Part 2: ..." when the notes have parts; else "3. NATURE ...".
    tops = Counter(l['size'] for l in every if l['size'] >= body + 1.4 and re.match(r'^part\s+\d+\s*:', l['text'], re.I))
    tops = tops or Counter(l['size'] for l in every if l['size'] >= body + 1.4 and re.match(r'^(?:part\s+\d+|\d+\.\s+\w)', l['text'], re.I))
    top = max(tops, key=lambda k: (tops[k], k)) if tops else (big[1] if len(big) > 1 else big[0] if big else body + 99)
    return every, body, again, pages, top


def title_of(every):
    for l in every[:12]:
        if re.match(r'unit \d', l['text'], re.I):
            return l
    return None


def build(path):
    every, body, again, pages, top = read_pdf(path)
    unit = None
    first = ' '.join(l['text'] for l in every[:30])
    m = re.search(r'Unit\s*(\d)\s*[:\-–]\s*([^|]+?)(?:\s+[–-]\s+Simple English Notes|\s+Simple English Notes|\s+\d+\s|\s+BBA|\s+Business|\s+Principles|\s+Financial|$)', first)
    if m:
        unit = (int(m.group(1)), clean(m.group(2)).rstrip(' .–-'))
    # Merge the lines into headings, points and paragraphs.
    out = []  # [level, text] or ['p'|'i', text]
    cur, kind = [], None
    heads = []

    def flush():
        nonlocal cur, kind
        if cur:
            out.append([kind, clean(' '.join(cur))])
        cur, kind = [], None

    prev = None
    parts = any(re.match(r'^part\s+\d+\s*:', l['text'], re.I) and l['size'] >= body + 1.4 for l in every)
    for l in every:
        t = l['text']
        if not l.get('row') and (NOISE.match(t) or (again[re.sub(r'\d+', '#', t)] >= max(3, pages * 0.4) and len(t) < 90) or l['size'] < body - 1.2):
            continue
        if l.get('row'):
            flush()
            out.append(['i', t])
            prev = l
            continue
        level = None
        words = len(t.split())
        if l['size'] >= body + 1.4 and words <= 16 and (l['bold'] or l['size'] >= body + 3):
            # Larger than a chapter heading is the title page.
            level = 0 if l['size'] > top + 0.6 else 1 if l['size'] >= top - 0.3 else 2
            if re.match(r'^\d+\.\d+\s', t):
                level = 2
            elif re.match(r'^part\s+\d+\s*[:—–-]', t, re.I) and level:
                level = 1
            elif parts and level == 1:
                # Notes in parts: only "Part 2: ..." opens a chapter.
                level = 2
        elif (l['bold'] and words <= 10 and len(t) < 70 and l['size'] >= body - 0.2 and not BULLET.match(t) and not re.search(r'[.,;]$', t)
              and l['x'] < 120 and re.match(r'[A-Z0-9(]', t) and (prev is None or l['page'] != prev['page'] or not cur or re.search(r'[.:!?]$', cur[-1]))):
            level = 3
        elif re.match(r'^\d{1,2}\.\d{1,2}\s+[A-Z][^.;:]{3,60}\.?$', t) and words <= 10 and not BULLET.match(t):
            # "9.3 Duties of the buyer." set as text is still the heading of what follows.
            level = 3
        if level == 0:
            flush()
            prev = l
            continue
        if level:
            # A heading that runs over two lines.
            if prev is not None and out and isinstance(out[-1][0], int) and not cur and abs(prev['size'] - l['size']) < 0.2 and prev['bold'] == l['bold'] and l['page'] == prev['page'] and l['y'] - prev['y'] < l['size'] * 1.8 and not re.match(r'^(?:part \d|\d+(?:\.\d+)*\s)', t, re.I):
                out[-1][1] = clean(out[-1][1] + ' ' + t)
            else:
                flush()
                out.append([level, t])
            prev = l
            continue
        if BULLET.match(t):
            flush()
            kind = 'i'
            cur = [BULLET.sub('', t)]
        else:
            # A new paragraph when the gap is large, or after a line that ends a sentence and a short line.
            gap = prev is not None and (l['page'] != prev['page'] or l['y'] - prev['y'] > l['size'] * 1.9)
            if kind is None or (kind == 'p' and gap and cur and re.search(r'[.:!?]$', cur[-1])):
                flush()
                kind = 'p'
            elif kind == 'p' and cur and re.search(r'[.!?]$', cur[-1]) and len(cur[-1]) < 60:
                flush()
                kind = 'p'
            cur.append(t)
        prev = l
    flush()
    return unit, out


def modules_of(unit, out, chapter):
    """One module for each top heading, its smaller headings as the sections."""
    mods = []
    mod = None
    sec, sub = '', ''
    skipping = 0  # the level of a heading whose part is left out
    seen_top = False
    for kind, t in out:
        if isinstance(kind, int):
            name = re.sub(r'^(?:part\s+\d+\s*[:—–-]\s*|\d+(?:\.\d+)*\.?\s+)', '', t, flags=re.I).strip(' :.')
            name = re.sub(r'\s*\((?:Part \d+|from the PDF)\)$|^Q\d+\.\s*|^[A-H]\.\s+', '', name, flags=re.I)
            name = re.sub(r'^PART \d+ [—–-] |\s*\(?from the PDF\)?', '', name, flags=re.I).strip(' :.')
            if skipping and kind > skipping:
                continue
            skipping = 0
            if SKIP.match(name) or SKIP.match(t) or re.match(r'^unit \d', t, re.I) or not name:
                if not re.match(r'^unit \d', t, re.I):
                    skipping = kind
                continue
            if kind == 1 or mod is None:
                mod = {'title': name.title() if name.isupper() else name, 'text': []}
                mods.append(mod)
                sec, sub = '', ''
                seen_top = True
            elif kind == 2:
                sec, sub = (name.title() if name.isupper() else name), ''
            else:
                sub = name
            continue
        if skipping or mod is None:
            continue
        # "Check yourself (Part 4)" set as text: what follows is questions until the next heading.
        if len(t) < 60 and SKIP.match(t):
            skipping = 9
            continue
        # The notes speak of the book they were made from; an answer does not.
        t = re.sub(r'\s*\((?:The|the) PDF[^)]*\)', '', t)
        t = ' '.join(x for x in re.split(r'(?<=[.!?])\s+', t) if not re.search(r'\b(?:in detail in|covered in|discussed in) Unit \d|see the note', x))
        t = re.sub(r"\bThe PDF(?:'s main text)? (?:lists|gives|names) ", 'There are ', t)
        t = re.sub(r'\bThe PDF groups them into ', 'They fall into ', t)
        t = re.sub(r'\bThe PDF (?:says|notes|explains|adds|states) (?:that )?(\w)', lambda m: m[1].upper(), t)
        t = re.sub(r'\s*\(?\b(?:from|in|of) the (?:PDF|notes)\)?', '', t)
        t = re.sub(r'\s*\(as the PDF (?:states|says|notes)\)', '', t)
        # Whatever still speaks of "the PDF" is about the notes, not the subject.
        t = ' '.join(x for x in re.split(r'(?<=[.!?])\s+', t) if not re.search(r'\bPDF\b', x))
        if not t.strip():
            continue
        # "Duration: Business cycles recur ... Their length varies ...": a short point with a name stays one line, so that
        # no sentence of it is taken without its name.
        if kind == 'i' and re.match(r'^[^:.;]{2,40}: ', t) and len(t.split()) <= 55:
            t = re.sub(r'\.\s+(?=[A-Z(])', '; ', t.strip()).rstrip('.') + '.'
        t = re.sub(r'\s+[○◦▪]\s+', '; ', t)
        # A figure, a table or a formula that is not here.
        if re.search(r'\b(?:figure|fig\.|table|chart|exhibit) \d|\bthe (?:table|figure|diagram) (?:here|below|above)|\$\\|\\frac', t, re.I):
            continue
        t = sentence(t)
        words = len(t.split())
        if words < 3 or t.endswith('?') or re.search(r'\(a\).{0,120}\(b\)|\bAnswer:', t) or re.search(r'\b(?:your (?:model )?paper|your unit|uploaded|I\'ve|in this unit you|after this unit|you should be able|answer key)\b', t, re.I):
            continue
        section = sub if sub and not sec else (f'{sec}: {sub}' if sub and sub.lower() not in ('example', 'examples') else sec)
        if sub.lower() in ('example', 'examples', 'indian example') and not t.lower().startswith(('for example', 'example')):
            first = t.split(' ', 1)[0]
            t = ('For example, ' + (t[0].lower() + t[1:] if first in ('The', 'A', 'An', 'If', 'Suppose', 'When', 'In', 'Consider', 'Imagine', 'This', 'Its', 'On', 'At', 'After') else t)) if kind == 'p' else t
        mod['text'].append([section, kind, t])
    keep = []
    for m in mods:
        if sum(len(t.split()) for _, _, t in m['text']) < 40:
            continue
        keep.append(m)
    return keep


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:70]


def main(src, folder):
    books = {b[0]: {'id': b[0], 'title': b[1], 'by': 'BBA Semester 1 class notes', 'licence': '', 'base': 'notes:', 'modules': []} for b in SUBJECTS}
    seen = set()
    for f in sorted(os.listdir(src)):
        if not f.lower().endswith('.pdf'):
            continue
        unit, out = build(os.path.join(src, f))
        first = pymupdf.open(os.path.join(src, f))[0].get_text()[:600]
        which = next((b for b in SUBJECTS[1:] if re.search(b[2], first, re.I)), None) or SUBJECTS[0]
        if re.search(r'business law', first, re.I):
            which = SUBJECTS[1]
        elif re.search(r'financial accounting', first, re.I):
            which = SUBJECTS[2]
        elif re.search(r'business economics', first, re.I):
            which = SUBJECTS[3]
        elif re.search(r'business communication', first, re.I):
            which = SUBJECTS[4]
        elif re.search(r'management', first, re.I):
            which = SUBJECTS[0]
        book = books[which[0]]
        chapter = unit[0] if unit else 1
        name = UNITS[which[0]][chapter - 1]
        for m in modules_of(unit, out, chapter):
            # The same part from two sets of notes is kept once.
            key = (book['id'], m['title'].lower(), m['text'][0][2][:60] if m['text'] else '')
            if key in seen:
                continue
            seen.add(key)
            book['modules'].append({'chapter': chapter, 'in': f'Unit {chapter}: {name}', 'title': m['title'], 'slug': f"{book['id']}/{len(book['modules']) + 1}-{slug(m['title'])}", 'text': m['text'], 'file': f})
        print(f'{f}: {which[0]:22s} unit {chapter} {name[:50]:50s} {sum(1 for _ in out)} blocks', flush=True)
    for b in books.values():
        b['modules'].sort(key=lambda m: m['chapter'])
        for m in b['modules']:
            m.pop('file', None)
        path = os.path.join(folder, f"{b['id']}.json")
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(b, fh, ensure_ascii=False, separators=(',', ':'))
        words = sum(len(t.split()) for m in b['modules'] for _, _, t in m['text'])
        print(f"{b['id']:22s} {len(b['modules']):4d} parts {words:7d} words {os.path.getsize(path) / 1e6:.2f} MB")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
