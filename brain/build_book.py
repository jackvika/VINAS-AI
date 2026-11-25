"""Makes static/book.json from OpenStax "Introduction to Business" (CC BY 4.0). Run once; the site only needs the file it makes.

    python -m brain.build_book static/book.json

The book's notice says it may not be used to train large language models or be put into generative AI offerings. This site
quotes it with its source and has no generative AI. Keep it that way, or leave the book out.
"""
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

REPO = 'openstax/osbooks-introduction-business'
C = '{http://cnx.rice.edu/cnxml}'
COL = '{http://cnx.rice.edu/collxml}'
MD = '{http://cnx.rice.edu/mdml}'
SKIP_CLASS = re.compile(r'concept-check|exercise|key-terms|summary|ethics|critical-thinking|case|group|hot-links|preparing|skills|assignment|customer|managing-change|expanding|catching|references|working-the-net|team', re.I)


def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'build-book/1.0'}), timeout=40) as r:
                return r.read()
        except OSError:
            time.sleep(1 + attempt)
    raise RuntimeError(url)


HOLE = '\x00'


def text(node):
    out = node.text or ''
    for child in node:
        if child.tag in (C + 'figure', C + 'footnote', C + 'media', C + 'table', C + 'note', C + 'list', C + 'exercise'):
            pass
        elif child.tag == C + 'link' and not (child.text or '').strip():
            # A figure or table that is not here.
            out += HOLE
        else:
            out += text(child)
        out += child.tail or ''
    out = re.sub(r'\s+', ' ', out)
    return out


def whole(t):
    """Takes out what points at a figure, and the sentence when it cannot stand without it."""
    t = re.sub(rf'\s*\([^()]*{HOLE}[^()]*\)|\(\s*\)', '', t)
    t = re.sub(rf',?\s*\b(?:as )?(?:shown|illustrated|seen|described|presented|listed|depicted|summarized|outlined)\s+in\s+{HOLE}(?:\s+and\s+{HOLE})?(?=[.;:])', '', t)
    t = re.sub(rf'^As (?:shown|illustrated|seen|described|presented|depicted) in {HOLE}(?: and {HOLE})?, (\w)', lambda m: m[1].upper(), t)
    t = re.sub(rf'(?<=[.!?] )As (?:shown|illustrated|seen|described|presented|depicted) in {HOLE}(?: and {HOLE})?, (\w)', lambda m: m[1].upper(), t)
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
            if re.match(r'(?:concept check|learning outcomes|key terms|summary|chapter|references|critical|ethics|preparing|working the net|creative|case|hot links|what did you|group)', name, re.I):
                continue
            walk(child, name, out)
        elif child.tag == C + 'para':
            t = whole(text(child))
            if len(t.split()) > 4 and not re.match(r'(?:source|credit|exhibit)\b', t, re.I):
                out.append([section, 'p', t])
            for inner in child.iter(C + 'list'):
                items(inner, section, out)
        elif child.tag == C + 'list':
            items(child, section, out)
        elif child.tag not in (C + 'title', C + 'note', C + 'figure', C + 'table', C + 'exercise', C + 'equation'):
            walk(child, section, out)


def items(node, section, out):
    for item in node.findall(C + 'item'):
        t = whole(text(item))
        if len(t.split()) > 1:
            out.append([section, 'i', t])


def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('’', ''))).strip('-')


def main(target):
    tree = json.loads(get(f'https://api.github.com/repos/{REPO}/git/trees/main?recursive=1'))
    commit = json.loads(get(f'https://api.github.com/repos/{REPO}/commits/main'))['sha']
    coll = next(x['path'] for x in tree['tree'] if x['path'].startswith('collections/') and x['path'].endswith('.xml'))
    raw = lambda path: get(f'https://raw.githubusercontent.com/{REPO}/{commit}/{path}')
    root = ET.fromstring(raw(coll))
    jobs, chapter = [], 0
    for sub in root.iter(COL + 'subcollection'):
        chapter += 1
        name = sub.find(MD + 'title').text.strip()
        for i, m in enumerate(sub.iter(COL + 'module')):
            jobs.append((chapter, name, i, m.get('document')))

    def one(job):
        chapter, name, i, doc = job
        x = ET.fromstring(raw(f'modules/{doc}/index.cnxml'))
        title = whole(text(x.find(C + 'title')))
        ask = [text(a).strip() for a in x.iter(MD + 'abstract')]
        goals = []
        for a in x.iter(MD + 'abstract'):
            goals += [text(it).strip() for it in a.iter(C + 'item')]
        out = []
        walk(x.find(C + 'content'), '', out)
        return {'chapter': chapter, 'in': name, 'title': title, 'slug': f'{chapter}-{i}-{slug(title)}' if i else f'{chapter}-introduction', 'ask': goals or [a for a in ask if a], 'text': out}
    # Each chapter opens with a story, which answers no question.
    with ThreadPoolExecutor(8) as pool:
        modules = list(pool.map(one, [j for j in jobs if j[2]]))
    modules = [m for m in modules if sum(len(t.split()) for _, _, t in m['text']) > 80]
    json.dump({'title': 'Introduction to Business', 'by': 'OpenStax', 'licence': 'CC BY 4.0', 'commit': commit, 'base': 'https://openstax.org/books/introduction-business/pages/', 'modules': modules},
              open(target, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    print(len(modules), 'sections,', sum(len(t.split()) for m in modules for _, _, t in m['text']), 'words')
    for m in modules[:60:6]:
        print(m['slug'], '|', m['ask'][:2], '|', len(m['text']))


if __name__ == '__main__':
    main(sys.argv[1])
