"""Builds static/books/*.json from two open textbooks that are not from OpenStax, both under CC BY.

    python brain/build_open.py static/books

Project Management, 2nd edition, by Adrienne Watt (BCcampus): CC BY 4.0, as its own metadata say.
Accounting Principles: A Business Perspective, by Hermanson, Edwards and Maher: CC BY, as LibreTexts and the Open Textbook
Library say. LibreTexts asks for five seconds between pages, so this takes a while.
"""
import html
import json
import os
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser

SKIP = re.compile(r'(?:attributions?|references|key terms|exercises|demonstration problem|solution|questions|short-answer|business decision case|annual report|ethics|group project|group|using the internet|using the world|answers to self|self-test|alternate|comprehensive|problem|real world|be an accountant|learning objectives|learning outcomes|image description|text attributions|media attributions|media|a manager|an accounting perspective|a broader perspective|uses of technology|appendix|more than you)', re.I)
GONE = re.compile(r'(?:\b(?:exhibit|exhibits|figure|table)\s*\d|\b(?:shown|see|illustrated) (?:below|above|here)|\bthe following (?:figure|table|diagram|exhibit|illustration)|\bas follows:?$)', re.I)


def get(url, wait=0):
    for attempt in range(4):
        try:
            if wait:
                time.sleep(wait)
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'build-book/1.0'}), timeout=60) as r:
                return r.read().decode('utf-8', 'replace')
        except OSError:
            time.sleep(3 + 5 * attempt)
    raise RuntimeError(url)


class Reader(HTMLParser):
    """Headings, paragraphs and list lines of a page, in order."""
    VOID = {'br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'col', 'area', 'embed', 'track'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.kind, self.buf, self.skip = [], None, '', 0

    def flush(self):
        t = re.sub(r'\s+', ' ', self.buf).strip()
        if t and self.kind:
            self.out.append((self.kind, t))
        self.buf, self.kind = '', None

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            if tag == 'br':
                self.buf += ' '
            return
        cls = dict(attrs).get('class') or ''
        if self.skip or tag in ('table', 'figure', 'script', 'style', 'svg', 'math', 'footer', 'nav', 'sup', 'caption') or re.search(r'footnote|wp-caption|mt-sort|autonumber|glossary|licens|toc', cls):
            self.skip += 1
            return
        if tag in ('p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'dd'):
            self.flush()
            self.kind = tag

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if self.skip:
            self.skip -= 1
            return
        if tag in ('p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'dd'):
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.buf += data


def lines(page):
    r = Reader()
    r.feed(page)
    r.flush()
    out, section, drop = [], '', False
    for kind, t in r.out:
        t = html.unescape(t).replace('​', '').replace('\xa0', ' ').strip()
        if kind[0] == 'h':
            section = re.sub(r'^(?:\d+[.:]?)+\s*', '', t).strip()
            drop = bool(SKIP.match(section))
            continue
        if drop or '$$' in t or '\\(' in t:
            continue
        kept = ' '.join(x for x in re.split(r'(?<=[.!?])\s+', t) if not GONE.search(x))
        if len(kept.split()) > (5 if kind == 'p' else 1) and not re.match(r'(?:figure|table|exhibit|source|image|retrieved|licen[cs]e)\b', kept, re.I):
            out.append([section, 'p' if kind in ('p', 'dd') else 'i', kept])
    return out


def save(folder, book):
    seen = set()
    for m in book['modules']:
        m['text'] = [x for x in m['text'] if not (x[2] in seen or seen.add(x[2]))]
    book['modules'] = [m for m in book['modules'] if sum(len(t.split()) for _, _, t in m['text']) > 80]
    path = os.path.join(folder, f"{book['id']}.json")
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(book, f, ensure_ascii=False, separators=(',', ':'))
    print(f"{book['id']:38s} {len(book['modules']):4d} sections {sum(len(t.split()) for m in book['modules'] for _, _, t in m['text']):7d} words {os.path.getsize(path) / 1e6:.2f} MB", flush=True)


def project_management(folder):
    api = 'https://opentextbc.ca/projectmanagement/wp-json/pressbooks/v2/'
    meta = json.loads(get(api + 'metadata'))
    if 'creativecommons.org/licenses/by/4.0' not in json.dumps(meta).replace('\\/', '/'):
        raise SystemExit('the licence of Project Management has changed')
    modules = []
    for part in json.loads(get(api + 'toc'))['parts']:
        for c in part['chapters']:
            page = json.loads(get(f"{api}chapters/{c['id']}", 2))
            title = re.sub(r'^\d+\.\s*', '', html.unescape(c['title']))
            modules.append({'chapter': len(modules) + 1, 'in': 'Project Management', 'title': title, 'slug': c['link'].replace('https://opentextbc.ca/projectmanagement/', ''), 'text': lines(page['content']['rendered'])})
    save(folder, {'id': 'project-management', 'title': 'Project Management, 2nd edition', 'by': 'Adrienne Watt, BCcampus', 'licence': 'CC BY 4.0', 'commit': '', 'source': 'https://opentextbc.ca/projectmanagement/', 'base': 'https://opentextbc.ca/projectmanagement/', 'modules': modules})


def accounting(folder):
    top = 'https://biz.libretexts.org/Under_Construction/Book%3A_Accounting_Principles_-_A_Business_Perspective_(Hermanson_Edwards_and_Maher)'
    first = get(top)
    if 'is shared under a CC BY license' not in re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', first))):
        raise SystemExit('the licence of Accounting Principles has changed')
    base = top + '/'

    def below(page, url):
        found = []
        for link in re.findall(r'href="([^"#?]+)"', page):
            link = html.unescape(link)
            rest = link[len(url) + 1:] if link.startswith(url + '/') else ''
            if rest and '/' not in rest and link not in found and not re.match(r'(?:00|zz)%3A', rest):
                found.append(link)
        return found
    modules = []

    def take(url, chapter, depth):
        page = get(url, 6)
        body = re.search(r'<section class="mt-content-container"[^>]*>(.*?)</section>', page, re.S)
        title = re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S)
        name = re.sub(r'^[\d.]+\s*:?\s*', '', html.unescape(re.sub(r'<[^>]+>', '', title[1])).strip()) if title else ''
        text = lines(body[1]) if body else []
        if text and not SKIP.match(name):
            modules.append({'chapter': chapter[0], 'in': chapter[1] or name, 'title': name, 'slug': url[len(base):], 'text': text})
            print(name[:60], len(text), flush=True)
        if depth < 2:
            for link in below(page, url):
                take(link, (chapter[0], chapter[1] or name), depth + 1)
    for i, link in enumerate(below(first, top)):
        take(link, (i + 1, ''), 0)
    save(folder, {'id': 'accounting-principles', 'title': 'Accounting Principles: A Business Perspective', 'by': 'Hermanson, Edwards and Maher', 'licence': 'CC BY', 'commit': '', 'source': top, 'base': base, 'modules': modules})


if __name__ == '__main__':
    os.makedirs(sys.argv[1], exist_ok=True)
    if len(sys.argv) < 3 or 'pm' in sys.argv:
        project_management(sys.argv[1])
    if len(sys.argv) < 3 or 'acc' in sys.argv:
        accounting(sys.argv[1])
