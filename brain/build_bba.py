"""Builds static/bba.json, the subjects, units and topics of the three-year BBA, from the text of AICTE's model curriculum.

    python brain/build_bba.py aicte.pdf static/bba.json      (needs pypdf)

Only the names of subjects, units and topics are kept. The document is at
https://aud.delhi.gov.in/sites/default/files/2026-06/aicte_bba_syllabus.pdf
"""
import json
import re
import sys

from pypdf import PdfReader

LOAD = r'\d ?L ?: ?\d ?T ?: ?\d ?P'
HEAD = re.compile(rf'^ ?(?:((?:CC|AEC|MDE|VAC|SEC) ?\d{{3}}|DSE ?[–-]? ?[A-Za-z]+ ?[–-]? ?\d+)\s*)(.*)$')
END = re.compile(r'^\s*(?:text ?books?|suggested|references?|readings?|reflective|recommended|reference books|essential readings|pedagogy|course outcomes?|learning outcomes|practical|teaching|cases?\b|list of|additional|web ?sources|note\s*:|lab\b|activit|project work|evaluation|experiential|assessment|for (?:more )?case|key text)', re.I)
UNIT = re.compile(r'^\s*(?:unit|module)\s*[–—:-]?\s*([0-9]+|[IVX]+)\b\s*[–—:.-]*\s*(.*)$', re.I)
GROUPS = {'BA': 'Business Analytics', 'IB': 'International Business', 'FIN': 'Finance', 'HRM': 'Human Resource Management', 'MR': 'Marketing', 'SCM': 'Supply Chain Management'}
YEARS = {'1': 'Semester 1', '2': 'Semester 2', '3': 'Semester 3', '4': 'Semester 4', '5': 'Semester 5', '6': 'Semester 6'}
OR = {'VAC401': ['Business Environment and Public Policy', 'Enterprise System and Platforms', 'Geo Politics and Impact on Business', 'Public Health and Management'],
      'VAC301': ['Yoga and Physical Fitness', 'Sports and Physical Education', 'Sports and Physical Education: Second Course', 'Physical Education and Health']}
# These units are written as prose in the document, so their topics are named here by hand.
HAND = {
    'CC402': [['Operations management', 'Production systems', 'Operations strategy', 'Functions of operations management'], ['Process design', 'Flowcharts and process maps', 'Plant layout', 'Capacity planning', 'Continuous improvement'],
              ['Quality management', 'Total Quality Management (TQM)', 'Six Sigma', 'Lean manufacturing'], ['Sustainable operations', 'Global operations management', 'Artificial intelligence and IoT in operations']],
    'CC502': [['Supply chain management', 'Strategic fit in the supply chain', 'Supply chain drivers and metrics'], ['Distribution networks', 'Supply chain network design', 'Global supply chain'], ['Sourcing decisions', 'Pricing in the supply chain', 'Revenue management', 'E-commerce and the supply chain'],
              ['Demand forecasting', 'Aggregate planning', 'Sales and operations planning', 'Supply chain coordination']],
    'DSESCM01': [['Management science', 'Decision models in business'], ['Linear programming', 'Simplex method', 'Dynamic programming'], ['Game theory', 'Zero-sum and cooperative games', 'Nash equilibrium', 'Decision making under uncertainty', 'Queuing theory'], ['Inventory management', 'Economic order quantity (EOQ)', 'Reorder point and safety stock', 'Just-in-time (JIT)']],
    'DSESCM02': [['Operations strategy', 'Alignment of operations and business strategy'], ['Operations in manufacturing industries', 'Operations in service industries'], ['Blockchain in the supply chain', 'Internet of things in operations'], ['Supply chain risk', 'Risk mitigation', 'Social responsibility in operations']],
    'DSESCM03': [['Quality management', 'Evolution of quality management'], ['Statistical quality control', 'Control charts', 'Process capability analysis'], ['Total Quality Management (TQM)', "Deming's 14 points", 'Six Sigma', 'DMAIC and DMADV', 'FMEA', 'SIPOC diagram'], ['Value stream mapping', 'Lean management']],
}
IKS = {'code': 'MDE101', 'title': 'Indian Knowledge System', 'group': 'Semester 1', 'books': [], 'units': [{'title': 'Indian Knowledge Systems and Traditions', 'topics': [
    'Indian knowledge system', 'Indian culture and civilization', 'Ancient Indian chemistry', 'Ancient Indian metallurgy', 'Ancient Indian mathematics', 'Ancient Indian astronomy', 'Indian astronomical instruments', 'Ayurveda', 'Gandharva Veda',
    'Vedangas', 'Vastu shastra', 'Indian temple architecture', 'Indian town planning', 'Indian philosophy']}]}
BOOKS = [
    (r'environment(?:al)? science|constitution|knowledge system|health|yoga|sports|english|language|media literacy|geo politics', []),
    (r'marketing|consumer|retail|sales|brand|advertis|media', ['principles-marketing', 'introduction-business']),
    (r'econom', ['principles-economics-3e', 'introduction-business']),
    (r'ethic|legal|governance|sustainab', ['business-ethics', 'introduction-business', 'principles-management']),
    (r'entrepreneur|startup|design thinking|family business', ['entrepreneurship', 'introduction-business']),
    (r'statistic|research|analytics|decision models|visuali', ['introductory-business-statistics-2e', 'introduction-business']),
    (r'human|behavio|hrd|hrm|\bhr\b|training|negotiat|team|compensation|coaching|talent|employee|organizational development|performance', ['organizational-behavior', 'principles-management', 'introduction-business']),
    (r'business environment', ['principles-economics-3e', 'introduction-business', 'principles-management', 'business-ethics']),
    (r'international accounting', ['accounting-principles', 'introduction-business']),
    (r'international|global|transnational|exim|cross', ['introduction-business', 'principles-management', 'principles-economics-3e', 'principles-marketing']),
    (r'account', ['accounting-principles', 'introduction-business']),
    (r'financ|tax|bank|invest|valuation|derivative', ['introduction-business', 'accounting-principles', 'principles-economics-3e']),
    (r'project', ['project-management', 'principles-management', 'introduction-business']),
    (r'communication', ['organizational-behavior', 'principles-management', 'introduction-business']),
    (r'', ['principles-management', 'introduction-business', 'organizational-behavior']),
]


PROSE = re.compile(r'^(?:this unit|in this|students|learners|demonstration of|know |address |knowing |participat|practice of|practical|preparing |visit|any \w+ of|key topics include|are also|along with|focusing on|covering|including|involving|ensuring|providing|leading to|leveraging|reduce |reorder|any two|chapter|unit )|\b(?:is|are|will|covers?|explores?|focuses|delves|gives|helps|undertakes|dwells|includes|aims|introduces|provides|highlighted|textbook|practice exercises|case stud(?:y|ies)|participation in|examined|elaborates|equips?|enables? (?:students|learners))\b', re.I)


def clean(t):
    t = t.replace('­', '').replace('Startegic', 'Strategic').replace('Mangement', 'Management')
    t = re.sub(r'(\w)- (?=[a-z])', r'\1-', t)
    t = re.sub(r'\s+([,;:.)])', r'\1', re.sub(r'\s+', ' ', t)).replace('( ', '(')
    return t.strip(' -–—:;,.•')


def split(t, marks):
    """Cuts at marks that stand outside brackets."""
    out, cur, deep = [], '', 0
    for i, c in enumerate(t):
        deep += (c in '([') - (c in ')]')
        deep = max(0, deep)
        if c in marks and not deep and not (c == '.' and i + 1 < len(t) and t[i + 1] != ' '):
            out.append(cur)
            cur = ''
        else:
            cur += c
    return [x.strip() for x in out + [cur] if x.strip(' -–')]


def topics(t):
    t = ' '.join(x for x in re.split(r'(?<=[.])\s+', t) if not re.match(r'(?:the )?(?:objectives?|aim) of (?:the|this) unit|(?:it|this unit|the unit|unit \d|students will|the final unit)\b', x, re.I))
    t = re.sub(r'(\w) -(?=[a-z])', r'\1-', t)
    t = re.sub(r'\b([B-HJ-Z]) (?=[a-z]{3,})', r'\1', t)
    t = re.sub(r'\bi\.e\.|\be\.g\.', '', re.sub(r'\bvs\.', 'vs', t, flags=re.I)).replace('•', ';').replace('', ';').replace('➢', ';').replace('●', ';').replace('*', '')
    out = []
    for part in split(t, ';.'):
        bits = [x for c in split(part, ',') for x in re.split(r'\s+[–—]\s+|\s+-\s*(?=[A-Z])', c) if x.strip()]
        held = []
        here = []
        for b in bits:
            words = b.split()
            if len(words) < 2 or re.match(r'(?:and|or|of|in|its|their|with|for|to)\b', b, re.I):
                if here and (':' in here[-1] or re.match(r'(?:and|or|of|in|its|their|with|for|to)\b', b, re.I)) and not held:
                    here[-1] += ', ' + b
                else:
                    held.append(b)
                continue
            here.append(', '.join(held + [b]))
            held = []
        if held:
            if here:
                here[-1] += ', ' + ', '.join(held)
            else:
                here.append(', '.join(held))
        out += here
    seen, kept = set(), []
    for x in out:
        x = clean(re.sub(r', (and|or) ', r' \1 ', x))
        x = re.sub(r'^(?:and|or)\s+', '', x)
        if 4 <= len(x) <= 150 and not PROSE.search(x) and re.search('[A-Za-z]{3}', x) and x.lower() not in seen:
            seen.add(x.lower())
            kept.append(x[0].upper() + x[1:])
    return kept


def main(pdf, target):
    lines = []
    for page in PdfReader(pdf).pages:
        for line in (page.extract_text() or '').split('\n'):
            s = line.strip()
            if s and not re.fullmatch(r'\d{1,3}', s) and not s.startswith('Model curriculum for UG'):
                lines.append(s)
    start = max(i for i, x in enumerate(lines) if re.match(r'CC ?101\b', x))
    lines = lines[start:]
    courses, cur, unit, on, done = [], None, None, False, False
    for i, s in enumerate(lines):
        load = re.search(LOAD, s)
        head = HEAD.match(s)
        near = ' '.join(lines[i:i + 10])
        if head and not on_list(s) and re.search(LOAD, near[:230]):
            title = s if load else near[:re.search(LOAD, near).start()]
            code = re.sub(r'[\s–-]+', '', head[1]).upper()
            name = clean(re.sub(LOAD + '.*', '', title)[len(head[1]):])
            cur = {'code': code, 'title': name, 'units': []}
            courses.append(cur)
            unit, on, done = None, False, False
            continue
        if cur is None:
            continue
        if re.match(r'course contents?\b', s, re.I):
            # A second content under one code is another choice, or a subject whose code is missing.
            if cur['units']:
                more = OR.get(cur['code'])
                n = cur.get('choice', 0) + 1
                cur = {'code': cur['code'], 'title': more[n], 'units': [], 'choice': n} if more and n < len(more) else {'code': '', 'title': '', 'units': []}
                courses.append(cur)
            on, unit, done = True, None, False
            continue
        m = UNIT.match(s)
        if m and not done:
            on = True
            rest = m[2]
            if rest and lines[i + 1:] and len(rest) > 50 and not re.search(r'[.;,:]', rest) and len(lines[i + 1].split()) <= 4 and not re.search(r'[.,;]', lines[i + 1]):
                rest += ' ' + lines[i + 1]
                lines[i + 1] = ''
            unit = {'title': clean(rest), 'raw': ''}
            cur['units'].append(unit)
            continue
        if END.match(s):
            unit, on = None, False
            # Readings can stand between units; books and outcomes come after the last one.
            done = done or bool(cur['units'] and re.match(r'\s*(?:text ?books?|course outcomes?|reference)', s, re.I))
            continue
        if on and unit is not None:
            unit['raw'] += (' ' if unit['raw'] else '') + s
    out = []
    for c in courses:
        sem = re.search(r'(\d)\d\d$', c['code'])
        dse = re.match(r'DSE([A-Z]+?)\d+$', c['code'])
        group = YEARS.get(sem[1]) if sem and not dse else GROUPS.get(dse[1]) if dse else None
        if not group:
            continue
        units = []
        for u in c['units'][:8]:
            title = u['title']
            if len(title) > 90:     # the topics stand on the line of the unit
                u['raw'], title = f"{title}. {u['raw']}", ''
            t = HAND[c['code']][len(units)] if c['code'] in HAND and len(units) < len(HAND[c['code']]) else topics(u['raw'])
            if t:
                units.append({'title': title or t[0].split(':')[0], 'topics': t})
        if not units:
            continue
        if c['code'] in OR and not c.get('choice'):
            c['title'] = OR[c['code']][0]
        low = c['title'].lower()
        out.append({'code': c['code'] + (chr(65 + c['choice']) if c.get('choice') else ''), 'title': c['title'].title() if c['title'].isupper() else c['title'], 'group': group, 'books': next(b for p, b in BOOKS if re.search(p, low)), 'units': units})
    out.append(IKS)
    seen = set()
    for c in out:
        while c['code'] in seen:
            c['code'] += 'B'
        seen.add(c['code'])
    order = list(YEARS.values()) + list(GROUPS.values())
    out.sort(key=lambda c: order.index(c['group']))
    json.dump({'title': 'Model Curriculum for UG Degree in BBA', 'by': 'AICTE, 2024', 'url': 'https://aud.delhi.gov.in/sites/default/files/2026-06/aicte_bba_syllabus.pdf', 'courses': out},
              open(target, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    for c in out:
        print(f"{c['group']:26s} {c['code']:8s} {c['title'][:60]:60s} {len(c['units'])} units {sum(len(u['topics']) for u in c['units'])} topics {c['books'][:1]}")
    print(len(out), 'subjects', sum(len(u['topics']) for c in out for u in c['units']), 'topics')


def on_list(s):
    return bool(re.search(r'\d \d \d \d$', s))


if __name__ == '__main__':
    main(*sys.argv[1:3])
