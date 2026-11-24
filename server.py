"""Serves the website and its brain.

    pip install -r requirements.txt
    python server.py
"""
import mimetypes
import os
import threading
import time
from collections import OrderedDict, deque
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory
from waitress import serve
from werkzeug.exceptions import HTTPException

from brain.model import Model
from brain.rewrite import LEVELS, LIMIT, TYPES, Rewriter
from brain.writer import PART_LIMIT, Writer, WriterError

ROOT = Path(__file__).resolve().parent
# Only these are public, so the code, the model, the tests and the Git folder are not.
PAGES = {'index.html', 'check.html', 'guide.html', 'about.html', 'style.css', 'app.js', 'LICENSE', 'skill/LICENSE.txt'}
MAX_BODY = 8 * LIMIT + 10_000
ON_RENDER = os.environ.get('RENDER') == 'true'
PER_MINUTE = int(os.environ.get('RATE_LIMIT', 30))
HEADERS = {
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
                               "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), display-capture=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
}

mimetypes.add_type('text/javascript', '.js')

rewriter = Rewriter(Model(ROOT / 'brain' / 'human.bin'))
app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = MAX_BODY


class Limiter:
    """Counts recent requests per visitor. Addresses stay in memory for a minute and are never written down."""

    def __init__(self, per_minute, visitors=5000):
        self.per_minute, self.visitors = per_minute, visitors
        self.seen, self.lock = OrderedDict(), threading.Lock()

    def allow(self, who, now=None):
        now = time.monotonic() if now is None else now
        with self.lock:
            while self.seen and (len(self.seen) > self.visitors or now - next(iter(self.seen.values()))[-1] > 60):
                self.seen.popitem(last=False)
            times = self.seen.setdefault(who, deque())
            while times and now - times[0] > 60:
                times.popleft()
            if len(times) >= self.per_minute:
                return False
            times.append(now)
            self.seen.move_to_end(who)
            return True


writer = Writer()
limiter = Limiter(PER_MINUTE)
write_limiter = Limiter(2 * PER_MINUTE)
thinking = threading.BoundedSemaphore(2)    # more at once would only make everyone wait
writing = threading.BoundedSemaphore(4)     # leaves threads free for the pages


def visitor():
    # Render's front door sets this header itself. Anywhere else a visitor could forge it.
    return (request.headers.get('CF-Connecting-IP') if ON_RENDER else None) or request.remote_addr or ''


def refuse(status, message):
    response = jsonify(error=message)
    response.status_code = status
    if status in (429, 503):
        response.headers['Retry-After'] = '20'
    return response


@app.after_request
def headers(response):
    for name, value in HEADERS.items():
        response.headers[name] = value
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    else:
        response.headers['Cache-Control'] = 'no-cache'
    return response


@app.errorhandler(HTTPException)
def http_error(error):
    return refuse(error.code, error.name) if request.path.startswith('/api/') else (f'{error.code} {error.name}', error.code, {'Content-Type': 'text/plain'})


@app.errorhandler(Exception)
def failure(error):
    # The text is left out of the log on purpose.
    app.logger.error('%s at %s', type(error).__name__, request.path)
    return refuse(500, 'Something went wrong.')


@app.get('/')
@app.get('/<path:name>')
def page(name='index.html'):
    parts = name.split('/')
    # A part that starts with a dot is hidden, or climbs out of its folder.
    if any(p.startswith('.') or '\\' in p or ':' in p or '\0' in p for p in parts) or (name not in PAGES and parts[0] != 'static'):
        abort(404)
    return send_from_directory(ROOT, name)


@app.get('/api/health')
def health():
    return jsonify(ok=True, writer=writer.ready)


@app.post('/api/brain')
def brain():
    # Other sites may not use this server through their visitors' browsers.
    if request.headers.get('Sec-Fetch-Site', 'same-origin') not in ('same-origin', 'none'):
        return refuse(403, 'Use this from its own site.')
    if not limiter.allow(visitor()):
        return refuse(429, 'Too many requests. Wait a minute and try again.')
    try:
        data = request.get_json(silent=True)
    except RecursionError:
        data = None
    if not isinstance(data, dict):
        return refuse(400, 'Send JSON.')
    text, sample = data.get('text'), data.get('sample') or ''
    if not isinstance(text, str) or not text.strip() or len(text) > LIMIT:
        return refuse(400, f'Send between 1 and {LIMIT:,} characters of text.')
    if not isinstance(sample, str) or len(sample) > LIMIT:
        return refuse(400, f'Keep the sample under {LIMIT:,} characters.')
    kind, level, short = data.get('type'), data.get('level'), data.get('contractions')
    if not thinking.acquire(timeout=20):
        return refuse(503, 'The brain is busy. Try again in a moment.')
    try:
        return jsonify(rewriter.run(
            text, kind if kind in TYPES else 'general', sample,
            short if isinstance(short, bool) else None, level if isinstance(level, str) and level in LEVELS else 'normal',
        ))
    finally:
        thinking.release()


@app.post('/api/write')
def write():
    """One new version of one part of a text, from the AI writer."""
    if request.headers.get('Sec-Fetch-Site', 'same-origin') not in ('same-origin', 'none'):
        return refuse(403, 'Use this from its own site.')
    if not writer.ready:
        return refuse(503, 'The AI writer is not set up on this server.')
    if not write_limiter.allow(visitor()):
        return refuse(429, 'Too many requests. Wait a minute and try again.')
    try:
        data = request.get_json(silent=True)
    except RecursionError:
        data = None
    if not isinstance(data, dict):
        return refuse(400, 'Send JSON.')
    text, hint = data.get('text'), data.get('hint') or ''
    if not isinstance(text, str) or not text.strip() or len(text) > PART_LIMIT:
        return refuse(400, f'Send between 1 and {PART_LIMIT:,} characters of text.')
    if not isinstance(hint, str):
        return refuse(400, 'The hint must be text.')
    kind, level, attempt = data.get('type'), data.get('level'), data.get('attempt')
    if not writing.acquire(timeout=30):
        return refuse(503, 'The AI writer is busy. Try again in a moment.')
    try:
        return jsonify(writer.write(
            text.encode('utf-8', 'replace').decode(), kind if isinstance(kind, str) else 'general', level if isinstance(level, str) else 'normal',
            data.get('contractions') is not False, hint.encode('utf-8', 'replace').decode(), attempt if type(attempt) is int and 0 <= attempt < 9 else 0, visitor()))
    except WriterError as error:
        app.logger.warning('writer: %s', error)
        return refuse(error.status, str(error))
    finally:
        writing.release()


if __name__ == '__main__':
    serve(
        app, host='0.0.0.0' if ON_RENDER else '127.0.0.1', port=int(os.environ.get('PORT', 8000)), threads=12, ident=None,
        max_request_body_size=MAX_BODY, max_request_header_size=16_384, channel_timeout=240, connection_limit=200,
    )
