"""Builds static/books/*.json, the running text of OpenStax books that are free to use under CC BY 4.0.

    python brain/build_book.py static/books

OpenStax changed the licence of most of its books to CC BY-NC-SA on 23 April 2026. Each book here is therefore taken from
a commit at which the collection, the LICENSE file and the book's own preface all said CC BY 4.0; a book for which one of
the three says otherwise is refused. Do not move a book to a later commit without reading its licence.

OpenStax also asks that its books not be used to train, or be fed to, generative AI without permission. This site has no
generative AI. Keep it that way, or leave the books out.
"""
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

# repository, commit, collection, title
BOOKS = [
    ('introduction-business', '2a1439ce58906256ec7ca01765799688ef574617', 'introduction-business', 'Introduction to Business'),
    ('principles-of-management-bundle', 'a995241fbc161854a1fab15bdd3bec3f98dfd64b', 'principles-management', 'Principles of Management'),
    ('principles-of-management-bundle', 'a995241fbc161854a1fab15bdd3bec3f98dfd64b', 'organizational-behavior', 'Organizational Behavior'),
    ('principles-marketing', '40369d8ce3adb160cf8d2cc6528cd00be6a472eb', 'principles-marketing', 'Principles of Marketing'),
    ('principles-economics-bundle', 'e4e9214723e75ef6dbc0097083543e643dfc4661', 'principles-economics-3e', 'Principles of Economics 3e'),
    ('business-ethics', 'd64573e2807a1e7ba5d7dec8c36cd815a942b5c7', 'business-ethics', 'Business Ethics'),
    ('entrepreneurship', '9c7af23de65620b26586fd12249b3838282f555a', 'entrepreneurship', 'Entrepreneurship'),
    ('introductory-statistics-bundle', '77ae6260c6dc0903baf7a6dc748feb69f8a85122', 'introductory-business-statistics-2e', 'Introductory Business Statistics 2e'),
]
C = '{http://cnx.rice.edu/cnxml}'
COL = '{http://cnx.rice.edu/collxml}'
MD = '{http://cnx.rice.edu/mdml}'
M = '{http://www.w3.org/1998/Math/MathML}'
SKIP_CLASS = re.compile(r'concept-check|exercise|key-terms|key-equations|summary|critical-thinking|case|hot-links|preparing|skills|assignment|managing-change|expanding|catching|references|working-the-net|team|review|problem|practice|homework|solution|free-response|self-check|multiple-choice|suggested', re.I)
SKIP_NAME = re.compile(r'(?:concept check|learning outcomes|learning objectives|key (?:terms|equations|concepts)|summary|chapter (?:review|summary)|references|critical thinking|preparing|working the net|creative|case\b|hot links|what did you|group|review questions|self-check|homework|solutions|practice|problems|check your understanding|discussion questions|suggested resources|bibliography|endnotes|footnotes|try it|marketing in practice|marketing dashboard|closing company|building a)', re.I)
HOLE = '\x00'


def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'build-book/1.0'}), timeout=40) as r:
                return r.read()
        except OSError:
            time.sleep(1 + attempt)
    raise RuntimeError(url)


def text(node):
    out = node.text or ''
    for child in node:
        if child.tag in (C + 'figure', C + 'footnote', C + 'media', C + 'table', C + 'note', C + 'list', C + 'exercise'):
            pass
        elif child.tag in (M + 'math', C + 'equation') or (child.tag == C + 'link' and not ''.join(child.itertext()).strip()):
            # A formula, figure or table that is not here.
            out += HOLE
        else:
            out += text(child)
        out += child.tail or ''
    return re.sub(r'\s+', ' ', out)


def whole(t):
    """Takes out what points at a figure, and the sentence when it cannot stand without it."""
    seen = r'(?:shown|illustrated|seen|described|presented|listed|depicted|summarized|outlined)'
    t = re.sub(rf'\s*\([^()]*{HOLE}[^()]*\)|\(\s*\)', '', t)
    t = re.sub(rf',?\s*\b(?:as )?{seen}\s+in\s+{HOLE}(?:\s+and\s+{HOLE})?(?=[.;:])', '', t)
    t = re.sub(rf'(^|(?<=[.!?] ))As {seen} in {HOLE}(?: and {HOLE})?, (\w)', lambda m: m[2].upper(), t)
    t = ' '.join(x for x in re.split(r'(?<=[.!?])\s+', t) if HOLE not in x)
    return re.sub(r'\s+', ' ', t).strip()


def walk(node, section, out):
    for child in node:
        kind = child.get('class') or ''
        if child.tag == C + 'section':
            if SKIP_CLASS.search(kind):
                continue
            title = child.find(C + 'title')
            name = whole(text(title)) if title is not None else section
            if SKIP_NAME.match(name):
                continue
            walk(child, name, out)
        elif child.tag == C + 'para':
            t = whole(text(child))
            if len(t.split()) > 4 and not re.match(r'(?:source|credit|exhibit|figure|table)\b', t, re.I):
                out.append([section, 'p', t])
            for inner in child.iter(C + 'list'):
                items(inner, section, out)
        elif child.tag == C + 'list':
            items(child, section, out)
        elif child.tag not in (C + 'title', C + 'note', C + 'figure', C + 'table', C + 'exercise', C + 'equation', C + 'example', C + 'glossary'):
            walk(child, section, out)


def items(node, section, out):
    for item in node.findall(C + 'item'):
        t = whole(text(item))
        if len(t.split()) > 1:
            out.append([section, 'i', t])


def glossary(root, out):
    """The terms a module defines, as sentences of their own."""
    for d in root.iter(C + 'definition'):
        term, meaning = d.find(C + 'term'), d.find(C + 'meaning')
        if term is None or meaning is None:
            continue
        t, m = whole(text(term)), whole(text(meaning)).rstrip('.')
        if t and len(m.split()) > 3:
            out.append(['Key terms', 'p', f'{t[0].upper() + t[1:]}: {m}.'])


def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('’', ''))).strip('-')


def build(repo, commit, name, title, folder):
    def raw(path):
        return get(f'https://raw.githubusercontent.com/openstax/osbooks-{repo}/{commit}/{path}')
    source = raw(f'collections/{name}.collection.xml')
    root = ET.fromstring(source)
    licences = {'collection': 'creativecommons.org/licenses/by/4.0' in source.decode(), 'LICENSE': raw('LICENSE').decode().startswith('Attribution 4.0 International')}
    first = next(root.iter(COL + 'module')).get('document')
    preface = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', raw(f'modules/{first}/index.cnxml').decode()))
    said = re.search(r'licensed under an? Creative Commons ([\w -]*?) ?4\.0', preface)
    licences['preface'] = bool(said) and said[1].strip() == 'Attribution'
    if not all(licences.values()):
        raise SystemExit(f'{name}: not plainly CC BY 4.0: {licences}')
    jobs, chapter = [], 0
    for sub in root.iter(COL + 'subcollection'):
        content = sub.find(COL + 'content')
        mods = content.findall(COL + 'module')
        if not mods:    # a part, which holds chapters
            continue
        chapter += 1
        # The first module of a chapter is a story or an overview, which answers no question.
        jobs += [(chapter, sub.find(MD + 'title').text.strip(), i, m.get('document')) for i, m in enumerate(mods) if i]

    def one(job):
        at, within, i, doc = job
        x = ET.fromstring(raw(f'modules/{doc}/index.cnxml'))
        head = whole(text(x.find(C + 'title')))
        out = []
        walk(x.find(C + 'content'), '', out)
        glossary(x, out)
        seen, kept = set(), []
        for line in out:
            if line[2] not in seen:
                seen.add(line[2])
                kept.append(line)
        return {'chapter': at, 'in': within, 'title': head, 'slug': f'{at}-{i}-{slug(head)}', 'text': kept}
    with ThreadPoolExecutor(8) as pool:
        modules = list(pool.map(one, jobs))
    modules = [m for m in modules if sum(len(t.split()) for _, _, t in m['text']) > 80 and not SKIP_NAME.match(m['title'])]
    path = os.path.join(folder, f'{name}.json')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'id': name, 'title': title, 'by': 'OpenStax', 'licence': 'CC BY 4.0', 'commit': commit, 'source': f'https://github.com/openstax/osbooks-{repo}/tree/{commit}',
                   'base': f'https://openstax.org/books/{name}/pages/', 'modules': modules}, f, ensure_ascii=False, separators=(',', ':'))
    print(f"{name:38s} {len(modules):4d} sections {sum(len(t.split()) for m in modules for _, _, t in m['text']):7d} words {os.path.getsize(path) / 1e6:.2f} MB", flush=True)


if __name__ == '__main__':
    os.makedirs(sys.argv[1], exist_ok=True)
    for book in BOOKS:
        if len(sys.argv) < 3 or book[2] in sys.argv[2:]:
            build(*book, sys.argv[1])
