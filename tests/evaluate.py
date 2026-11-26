"""Measures how well questions are read and answered. Needs only Python and Chrome.

    python -m tests.evaluate                       parse and quality, on the working set
    python -m tests.evaluate --what parse
    python -m tests.evaluate --what parse,quality,general,squad --squad dev-v1.1.json --out tests/results/step1.json --against tests/results/baseline.json
    python -m tests.evaluate --what books --ask "..."   the book passages a question finds, with the reader's scores
    python -m tests.evaluate --what page          what a visitor can do with the line above an answer
    python -m tests.evaluate --set hindi --what quality   the answers to twenty Hindi questions
    python -m tests.evaluate --set held            only for the final report

The real page runs in Chrome (tests/evaluate.js). What Wikipedia says is kept in tests/.cache, so that two runs see the same sources.
dev-v1.1.json is SQuAD 1.1 (CC BY-SA 4.0), from rajpurkar.github.io/SQuAD-explorer; it is not part of this repository.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROMES = [r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium', 'chromium-browser']


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json'}
    cache = squad = done = None
    box = {}

    def log_message(self, *args):
        pass

    def reply(self, body, code=200, kind='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', f'{kind}; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def kept(self):
        m = re.fullmatch(r'/cache/([0-9a-f]{64})', self.path)
        return self.cache / m[1] if m else None

    def do_GET(self):
        if self.path == '/books':
            return self.reply(json.dumps(sorted(p.name for p in (ROOT / 'static/books').glob('*.json'))).encode())
        if self.path == '/squad.json':
            return self.reply(Path(self.squad).read_bytes())
        if self.path.startswith('/cache/'):
            f = self.kept()
            return self.reply(f.read_bytes()) if f and f.exists() else self.reply(b'', 404)
        return super().do_GET()

    def body(self):
        return self.rfile.read(int(self.headers.get('Content-Length') or 0))

    def do_PUT(self):
        f = self.kept()
        data = self.body()
        if f:
            f.write_bytes(data)
        self.reply(b'{}')

    def do_POST(self):
        data = self.body()
        if self.path == '/progress':
            print('  ' + data.decode('utf-8', 'replace'), file=sys.stderr, flush=True)
        elif self.path == '/result':
            self.box['result'] = json.loads(data)
            self.done.set()
        self.reply(b'{}')


def flat(result):
    """The numbers worth comparing, by name."""
    out = {}
    for part in ('parse', 'quality'):
        for k, v in (result.get(part) or {}).items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out[f'{part} {k}'] = v
    if result.get('general'):
        out['general right'] = result['general']['right']
        out['general wrong without warning'] = result['general']['wrongWithoutWarning']
    for name, tops in (result.get('squad') or {}).items():
        if isinstance(tops, list):
            for n, v in zip((1, 3, 5), tops):
                out[f'squad {name} top {n}'] = v
    return out


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--what', default='parse,quality')
    a.add_argument('--set', default='working', choices=['working', 'held', 'hindi'])
    a.add_argument('--only', default='', help='only the answers to questions that match this pattern')
    a.add_argument('--ask', default='', help='one question: prints what the page shows')
    a.add_argument('--read', default='', help='a question, or @file with one on each line: prints how it is read')
    a.add_argument('--squad', default='')
    a.add_argument('--out', default='')
    a.add_argument('--against', default='')
    a.add_argument('--cache', default=str(ROOT / 'tests/.cache'))
    a.add_argument('--minutes', type=float, default=90)
    o = a.parse_args()
    if o.ask:
        o.what = 'books' if o.what == 'books' else 'ask'
    if o.read:
        o.what = 'read'
        o.ask = Path(o.read[1:]).read_text(encoding='utf-8') if o.read.startswith('@') else o.read
    chrome = next((c for c in [os.environ.get('CHROME', ''), *CHROMES] if c and (Path(c).exists() or shutil.which(c))), None)
    if not chrome:
        sys.exit('Chrome was not found. Set CHROME to its path.')
    if 'squad' in o.what and not Path(o.squad).is_file():
        sys.exit('SQuAD needs --squad with the path of dev-v1.1.json.')
    Handler.cache = Path(o.cache)
    Handler.cache.mkdir(parents=True, exist_ok=True)
    Handler.squad = o.squad
    Handler.done = threading.Event()
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    from urllib.parse import urlencode
    url = f'http://127.0.0.1:{server.server_port}/tests/evaluate.html?' + urlencode({'what': o.what, 'set': o.set, 'only': o.only, 'q': o.ask})
    profile = tempfile.mkdtemp(prefix='vinas-')
    # Nothing is to be slowed down because the window is not seen.
    browser = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', f'--user-data-dir={profile}', url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not Handler.done.wait(o.minutes * 60):
            sys.exit('The evaluation took too long.')
    finally:
        browser.terminate()
        try:
            browser.wait(10)
        except subprocess.TimeoutExpired:
            browser.kill()
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)
    result = Handler.box['result']
    if 'failed' in result:
        sys.exit(result['failed'])
    if o.out:
        Path(o.out).parent.mkdir(parents=True, exist_ok=True)
        Path(o.out).write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8', newline='\n')
    if o.ask:
        return print(*result['answers'].values())
    if 'page' in result:
        print(result['answers']['page'])
        if not all(result['page'].values()):
            sys.exit(1)
    old = flat(json.loads(Path(o.against).read_text(encoding='utf-8'))) if o.against else {}
    print(f"Reader: {'on' if result['reader'] else 'OFF'}; set: {result['set']}")
    for k, v in flat(result).items():
        print(f'{k:34} {v:8g}' + (f'   was {old[k]:g}' if k in old else ''))
    for r in (result.get('quality') or {}).get('rows', []):
        if 'mark' in r:
            print(f"{r['mark']:g}/{r['of']:g}  {r['q'][:80]}\n      {r['lost']}")


if __name__ == '__main__':
    main()
