"""Tests the brain and the server. Run from the main folder: python -m unittest tests.test_brain"""
import hashlib
import math
import random
import re
import time
import unittest
from unittest import mock

import server
from brain.text import TOKEN, norm, sentences

BRAIN = server.rewriter
MODEL = BRAIN.model


def say(text, **options):
    return BRAIN.run(text, **options)['text']


class Knowledge(unittest.TestCase):
    def test_probabilities_add_up(self):
        for context in (('<s>', '<s>', '<s>'), ('i', 'do', "n't"), ('in', 'the', 'middle'), ('<unk>', 'zebra', 'of')):
            ids = [MODEL.id(w) for w in context]
            total = sum(math.exp(MODEL._logp(*ids, w)) for w in range(len(MODEL.ids)))
            self.assertAlmostEqual(total, 1, delta=0.02)

    def test_prefers_human_word_order(self):
        rng = random.Random(1)
        wins = 0
        lines = ['We went to the store to buy some bread and milk.', 'I have no idea what you are talking about.', 'She told me that the train was late again.',
                 'The government said it would not raise taxes this year.', 'If it rains tomorrow, we will stay at home.']
        for line in lines:
            words = [norm(t) for t in TOKEN.findall(line)]
            mixed = words[:]
            rng.shuffle(mixed)
            wins += sum(MODEL.score(words)) > sum(MODEL.score(mixed))
        self.assertEqual(wins, len(lines))

    def test_prefers_what_people_say(self):
        for human, stiff in (('we used the car', 'we utilized the car'), ('a lot of people', 'a plethora of people'), ("i don't know", 'i do not know')):
            self.assertGreater(sum(MODEL.score(human.split())), sum(MODEL.score(stiff.split())))


class Rewriting(unittest.TestCase):
    def test_plain_words(self):
        for text, want in (
            ('We utilize this tool in order to help people.', 'We use this tool to help people.'),
            ('The company purchased 450 units for approximately $1.2 million.', 'The company bought 450 units for about $1.2 million.'),
            ('The methodology demonstrates that a plethora of users benefit.', 'The methodology shows that many users benefit.'),
            ('It was an intricate plan.', 'It was a complicated plan.'),
            ('Numerous individuals reside here.', 'Many people live here.'),
            ('The firm keeps many data.', 'The firm keeps a lot of data.'),
        ):
            self.assertEqual(say(text), want)

    def test_contractions_follow_the_setting(self):
        text = 'I do not know why they will not come.'
        self.assertEqual(say(text), "I don't know why they won't come.")
        self.assertEqual(say(text, contractions=False), text)
        self.assertEqual(say(text, type_='reference'), text)

    def test_left_alone(self):
        for text in (
            'The cat sat on the mat. It was warm.',
            'She said "we utilize numerous tools" and left.',
            'Run `utilize --numerous` and see https://example.com/utilize/numerous now.',
            '# Utilize Numerous Tools', '| utilize | numerous |', '```\nutilize numerous\n```', '---\ntitle: utilize\n---',
            'He works at Robust Systems in Boston.', 'Problems remain.', 'He lives in foster care.', 'The purchase price was high.',
            'We provide the whole team with what they want.', 'What do you think it is?', 'I have a car.', 'Der Zug fährt um 10 Uhr. हिन्दी पाठ यहाँ है।', '🚀', '   ',
        ):
            self.assertEqual(say(text), text)

    def test_turns(self):
        for text, want in (
            ('It has enabled people to talk, thereby allowing users to share.', 'It has let people talk, so users can share.'),
            ('Use it in a mindful manner.', 'Use it in a mindful way.'),
            ('We can help you in achieving your goals.', 'We can help you reach your goals.'),
            ('The tools have showed good results.', 'The tools have shown good results.'),
            ('It has demonstrated that it works.', 'It has shown that it works.'),
            ('It demonstrated that it works.', 'It showed that it works.'),
            ('I look forward to collaborating with you.', 'I look forward to working with you.'),
            ('It is imperative that governments take immediate action.', 'It is important that governments act now.'),
        ):
            self.assertEqual(say(text), want)

    def test_levels(self):
        text = 'The firm will retain the data and proceed with caution in order to enhance and evaluate its robust systems.'
        count = [len(BRAIN.run(text, level=level)['edits']) for level in ('light', 'normal', 'strong')]
        self.assertEqual(count, sorted(count))

    def test_hostile_input_is_quick(self):
        shapes = ('a', '.', '. ', 'A. ', '? ! ', '"', '“', '`', '](', '<a ', '1,', '1.', '/a', './', 'a.', 'a@', '@', "a'", '-', ' ', '\t', 'I do not ', 'in order to ', 'a.b@c.d ',
                  'X ', '1. ', '# ', '\n', '\\', 'C:\\', 'http://', 'www.', '(', '[', '…', '🚀', 'é', 'It is. ', 'It was a man. ', 'in a ', 'plays a ', 'that that ', 'It has "a" ')
        for shape in shapes:
            for text in ((shape * 50_000)[:50_000], 'a ' + (shape * 50_000)[:49_998], (shape * 50_000)[:49_990] + ' end'):
                start = time.perf_counter()
                BRAIN.run(text, sample=text)
                self.assertLess(time.perf_counter() - start, 6, shape)

    def test_no_doubled_words(self):
        for text in ('People who walk on a regular basis often sleep well.', 'It aims at reducing or mitigating the threat.', 'We use and utilize many and numerous tools.'):
            words = [w.lower() for w in TOKEN.findall(say(text))]
            self.assertFalse([a for a, b in zip(words, words[1:]) if a == b], say(text))

    def test_keeps_the_writers_own_words(self):
        self.assertEqual(say('We utilize it.', sample='I utilize a pen.'), 'We utilize it.')

    def test_layout_and_spacing_stay(self):
        text = 'One thing.  Two spaces.\n\n- We utilize it.\n- They know it.\n\n\tEnd.\n'
        self.assertEqual(say(text), text.replace('utilize', 'use'))

    def test_curly_apostrophes(self):
        self.assertEqual(say('It’s late and I do not know.'), 'It’s late and I don’t know.')

    def test_stable(self):
        for text in ('We utilize numerous tools. They facilitate work. They are robust. The team is able to collaborate.', 'Furthermore, it is clear that we do not have sufficient time.'):
            once = say(text)
            self.assertEqual(say(once), once)

    def test_sentences(self):
        line = 'Dr. Smith met J. R. Hill at 5 p.m. on Monday. He left. "Why?" she asked.'
        self.assertEqual([line[a:b] for a, b in sentences(line)], ['Dr. Smith met J. R. Hill at 5 p.m. on Monday.', 'He left.', '"Why?" she asked.'])

    def test_survives_noise(self):
        rng = random.Random(2)
        alphabet = 'ab utilize . , \' " ’ — ( ) [ ] # * - ` \n 1 2 é 漢 🚀 in order to do not I '.split(' ') + [' ', '\x00']
        for _ in range(300):
            BRAIN.run(''.join(rng.choice(alphabet) + rng.choice(['', ' ']) for _ in range(60)))


class Server(unittest.TestCase):
    web = server.app.test_client()

    def setUp(self):
        server.limiter = server.Limiter(1000)

    def test_pages(self):
        for path in ('/', '/index.html', '/humanize.html', '/static/ask.js', '/static/book.js', '/static/books/introduction-business.json', '/static/bba.json', '/static/bba.js', '/static/parse.js', '/bba.html', '/static/judge.js', '/static/judge-worker.js', '/static/wordpiece.js', '/check.html', '/static/site.js', '/style.css', '/static/icon.svg', '/skill/LICENSE.txt'):
            with self.web.get(path) as r:
                self.assertEqual(r.status_code, 200, path)

    def test_private_files(self):
        for path in ('/server.py', '/brain/human.bin', '/brain/rewrite.py', '/.git/config', '/.htaccess', '/render.yaml', '/static/../server.py', '/static/%2e%2e/server.py', '/static/..%5cserver.py', '/static/../.git/config', '/static/C:/Windows/win.ini', '/brain/', '/tests/', '/tests/cases.js', '/skill/SKILL.md', '/README.md', '/requirements.txt', '/static/%00', '/static/', '/skill'):
            with self.web.get(path) as r:
                self.assertEqual(r.status_code, 404, path)

    def test_brain(self):
        r = self.web.post('/api/brain', json={'text': 'We utilize it.', 'type': 'general'})
        self.assertEqual((r.status_code, r.json['text'], r.json['edits']), (200, 'We use it.', [{'before': 'utilize', 'after': 'use'}]))
        self.assertEqual(r.headers['Cache-Control'], 'no-store')

    def test_security_headers(self):
        for path in ('/', '/api/health', '/missing'):
            with self.web.get(path) as r:
                for name in server.HEADERS:
                    self.assertIn(name, r.headers, path)

    def test_hostile_requests(self):
        post = lambda **k: self.web.post('/api/brain', **k)
        self.assertEqual(post(json={'text': 'Hi.'}, headers={'Sec-Fetch-Site': 'cross-site'}).status_code, 403)
        self.assertEqual(post(data='[' * 200_000, content_type='application/json').status_code, 400)
        self.assertEqual(post(data='{"text":' + '9' * 5000 + '}', content_type='application/json').status_code, 400)
        self.assertEqual(post(data='{"text":"Hi \\ud800 there."}', content_type='application/json').status_code, 200)
        self.assertEqual(post(data='text=Hi', content_type='application/x-www-form-urlencoded').status_code, 400)
        self.assertEqual(post(json={'text': 'Hi.', 'type': ['general'], 'level': {}}).status_code, 200)

    def test_rate_limit(self):
        limiter = server.Limiter(3, visitors=10)
        self.assertEqual([limiter.allow('a', t) for t in (0, 1, 2, 3)], [True, True, True, False])
        self.assertTrue(limiter.allow('b', 3))
        self.assertTrue(limiter.allow('a', 62))
        for i in range(100):
            limiter.allow(str(i), 70)
        self.assertLessEqual(len(limiter.seen), 11)

    def test_password(self):
        with mock.patch.object(server, 'PASSWORD', 'correct horse'), mock.patch.object(server, 'KEY', server.make_key('correct horse')), \
                mock.patch.object(server, 'login_limiter', server.Limiter(100)), mock.patch.object(server, 'all_logins', server.Limiter(100)):
            web = server.app.test_client()
            for path in ('/', '/index.html', '/static/site.js', '/humanize.html', '/skill/LICENSE.txt', '/nothing'):
                with web.get(path) as r:
                    self.assertEqual(r.status_code, 401, path)
                    self.assertIn(b'This site is private', r.data)
            for path in ('/api/brain',):
                self.assertEqual(web.post(path, json={'text': 'We utilize it.'}).json, {'error': 'Log in first.'})
            self.assertEqual(web.get('/api/health').json, {'ok': True})
            for path in ('/style.css', '/static/login.js', '/static/icon.svg', '/login.html'):
                with web.get(path) as r:
                    self.assertEqual(r.status_code, 200, path)
            for bad in ({}, {'password': ''}, {'password': 'wrong'}, {'password': 5}, {'password': ['correct horse']}, {'password': 'correct horse '}, []):
                self.assertEqual(web.post('/api/login', json=bad).status_code, 401, bad)
            later = int(time.time()) + 1000
            good = server.ticket(later)
            for bad in ('x', '.', '9' * 11 + '.x', f'{later + 1}.{good.split(".")[1]}', server.ticket(int(time.time()) - 5), good[:-1], f'{later}.', '٣.x', '-1.x'):
                fresh = server.app.test_client()
                fresh.set_cookie('login', bad)
                with fresh.get('/') as r:
                    self.assertEqual(r.status_code, 401, bad)
            self.assertEqual(web.post('/api/login', json={'password': 'correct horse'}, headers={'Sec-Fetch-Site': 'cross-site'}).status_code, 403)
            r = web.post('/api/login', json={'password': 'correct horse'})
            self.assertEqual(r.status_code, 200)
            for part in ('HttpOnly', 'SameSite=Strict', 'Path=/'):
                self.assertIn(part, r.headers['Set-Cookie'])
            with web.get('/') as r:
                self.assertEqual(r.status_code, 200)
            self.assertEqual(web.post('/api/brain', json={'text': 'We utilize it.'}).json['text'], 'We use it.')
            with mock.patch.object(server, 'KEY', server.make_key('changed')), web.get('/') as r:
                self.assertEqual(r.status_code, 401)
        with mock.patch.object(server, 'PASSWORD', 'x'), mock.patch.object(server, 'login_limiter', server.Limiter(3)):
            self.assertEqual([self.web.post('/api/login', json={'password': 'no'}).status_code for _ in range(4)], [401, 401, 401, 429])

    def test_books_are_free_to_use(self):
        import json
        import re
        from brain import build_book
        folder = server.ROOT / 'static' / 'books'
        script = (server.ROOT / 'static' / 'book.js').read_text(encoding='utf-8')
        named = re.findall(r"'([a-z0-9-]+)'", re.search(r'ALL = \[(.*?)\]', script)[1])
        self.assertEqual(sorted(named), sorted(p.stem for p in folder.glob('*.json')))
        pinned = {b[2]: b[1] for b in build_book.BOOKS + build_book.FREE_SITE}
        free = {b[2] for b in build_book.FREE_SITE}
        for path in folder.glob('*.json'):
            book = json.loads(path.read_text(encoding='utf-8'))
            # Later commits of these books are under another licence, so the commit is part of the licence.
            if path.stem in pinned:
                self.assertEqual((book['licence'], book['by'], book['commit']), ('CC BY-NC-SA 4.0' if path.stem in free else 'CC BY 4.0', 'OpenStax', pinned[path.stem]))
                self.assertTrue(book['base'].startswith(f'https://openstax.org/books/{path.stem}/'))
            else:
                self.assertEqual((book['licence'], book['by']), {'project-management': ('CC BY 4.0', 'Adrienne Watt, BCcampus'), 'accounting-principles': ('CC BY', 'Hermanson, Edwards and Maher')}[path.stem])
            self.assertGreater(len(book['modules']), 15)
        page = (server.ROOT / 'index.html').read_text(encoding='utf-8')
        for credit in ('OpenStax', 'CC BY 4.0', 'CC BY-SA 4.0'):
            self.assertIn(credit, page)

    def test_bba_course(self):
        import json
        course = json.loads((server.ROOT / 'static' / 'bba.json').read_text(encoding='utf-8'))
        groups = [c['group'] for c in course['courses']]
        for n in range(1, 7):
            self.assertIn(f'Semester {n}', groups)
        codes = [c['code'] for c in course['courses']]
        self.assertEqual(len(codes), len(set(codes)))
        books = {p.stem for p in (server.ROOT / 'static' / 'books').glob('*.json')}
        for c in course['courses']:
            self.assertTrue(c['title'] and c['units'] and set(c['books']) <= books, c['code'])
            for u in c['units']:
                self.assertTrue(u['title'] and u['topics'], (c['code'], u['title']))
                self.assertFalse([t for t in u['topics'] if any(ord(x) < 32 for x in t)], c['code'])

    def test_vendor_files_are_unchanged(self):
        folder = server.ROOT / 'static' / 'vendor'
        listed = dict(re.findall(r'^\| `([^`]+)` \|.*\| `([0-9a-f]{64})` \|$', (folder / 'README.md').read_text(encoding='utf-8'), re.M))
        here = {p.name for p in folder.iterdir() if p.suffix in ('.mjs', '.wasm', '.onnx') or p.name == 'vocab.txt'}
        self.assertEqual(set(listed), here)
        for name, want in listed.items():
            self.assertEqual(hashlib.sha256((folder / name).read_bytes()).hexdigest(), want, name)

    def test_reader_files(self):
        for path, kind in (('/static/vendor/ort.wasm.min.mjs', 'text/javascript'), ('/static/vendor/ort-wasm-simd-threaded.wasm', 'application/wasm'), ('/static/vendor/minilm-l6.onnx', 'application/octet-stream')):
            with self.web.get(path) as r:
                self.assertEqual((r.status_code, r.mimetype), (200, kind), path)
                self.assertIn('max-age', r.headers['Cache-Control'])
                self.assertEqual(r.headers['Cross-Origin-Embedder-Policy'], 'require-corp')

    def test_no_ai_service_is_left(self):
        for path in ('/api/write', '/api/points', '/api/polish'):
            with self.web.post(path, json={'text': 'Hi.'}) as r:
                self.assertIn(r.status_code, (404, 405), path)
        with self.web.get('/write.html') as r:
            self.assertEqual(r.status_code, 404)
        names = ('server.py', 'render.yaml', 'index.html', 'humanize.html', 'about.html', 'static/site.js', 'static/ask.js')
        for name in names:
            self.assertNotRegex((server.ROOT / name).read_text(encoding='utf-8'), r'(?i)cloudflare(?!-)|datamuse', name)

    def test_policy_matches_the_page(self):
        page = (server.ROOT / 'index.html').read_text(encoding='utf-8')
        meta = re.search(r'Content-Security-Policy" content="([^"]+)"', page)[1]
        sent = server.HEADERS['Content-Security-Policy']
        self.assertEqual(set(meta.split('; ')) | {"frame-ancestors 'none'"}, set(sent.split('; ')))
        self.assertNotIn('unsafe-inline', sent)
        self.assertNotIn("'unsafe-eval'", sent)

    def test_bad_requests(self):
        for body in ([], {}, {'text': ''}, {'text': 5}, {'text': 'a' * 50_001}):
            self.assertEqual(self.web.post('/api/brain', json=body).status_code, 400)
        self.assertEqual(self.web.post('/api/brain', data='x').status_code, 400)
        self.assertEqual(self.web.post('/api/brain', json={'text': 'a' * 600_000}).status_code, 413)
        self.assertEqual(self.web.post('/api/brain', json={'text': 'Hi.', 'type': {}, 'contractions': 'x'}).status_code, 200)
        self.assertEqual(self.web.post('/api/brain', json={'text': 'Hi.', 'sample': 3}).status_code, 400)


if __name__ == '__main__':
    unittest.main()
