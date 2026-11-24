"""Serves the website and its brain.

    pip install -r requirements.txt
    python server.py
"""
import hashlib
import hmac
import mimetypes
import os
import secrets
import threading
import time
from collections import OrderedDict, deque
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory
from waitress import serve
from werkzeug.exceptions import HTTPException

from brain.model import Model
from brain.rewrite import LEVELS, LIMIT, TYPES, Rewriter
from brain.writer import CONTEXT_LIMIT, PART_LIMIT, SAMPLE_LIMIT, Writer, WriterError

ROOT = Path(__file__).resolve().parent
# Only these are public, so the code, the model, the tests and the Git folder are not.
PAGES = {'index.html', 'write.html', 'check.html', 'guide.html', 'about.html', 'style.css', 'app.js', 'LICENSE', 'skill/LICENSE.txt'}
MAX_BODY = 8 * LIMIT + 10_000
ON_RENDER = os.environ.get('RENDER') == 'true'
PER_MINUTE = int(os.environ.get('RATE_LIMIT', 30))
PASSWORD = os.environ.get('SITE_PASSWORD', '')       # without one, the site is open to everyone
STAY = 30 * 24 * 3600                                # seconds a login lasts
OPEN = {'/api/health', '/api/login', '/login.html', '/style.css', '/static/login.js', '/static/icon.svg'}
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
login_limiter = Limiter(6)
all_logins = Limiter(60)
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


def make_key(password):
    """Slow on purpose, so a stolen cookie is little help in guessing the password."""
    return hashlib.scrypt(password.encode('utf-8', 'replace'), salt=b'vinas-ai-login', n=2 ** 14, r=8, p=1)


KEY = make_key(PASSWORD) if PASSWORD else b''


def ticket(expires):
    """A login that cannot be made without the password. Changing the password ends every login."""
    return f'{expires}.{hmac.new(KEY, str(expires).encode(), hashlib.sha256).hexdigest()}'


def inside():
    if not PASSWORD:
        return True
    given = request.cookies.get('login') or ''
    expires = given.partition('.')[0]
    if not (expires.isascii() and expires.isdigit() and len(expires) < 12 and int(expires) > time.time()):
        return False
    return hmac.compare_digest(given.encode('utf-8', 'replace'), ticket(int(expires)).encode())


@app.before_request
def gate():
    if request.path in OPEN or inside():
        return None
    if request.path.startswith('/api/'):
        return refuse(401, 'Log in first.')
    response = send_from_directory(ROOT, 'login.html')
    response.status_code = 401
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


@app.get('/login.html')
def login_page():
    return send_from_directory(ROOT, 'login.html')


@app.post('/api/login')
def login():
    if request.headers.get('Sec-Fetch-Site', 'same-origin') not in ('same-origin', 'none'):
        return refuse(403, 'Use this from its own site.')
    if not PASSWORD:
        return refuse(404, 'There is no password.')
    if not login_limiter.allow(visitor()) or not all_logins.allow('login'):
        return refuse(429, 'Too many tries. Wait a minute and try again.')
    try:
        data = request.get_json(silent=True)
    except RecursionError:
        data = None
    given = data.get('password') if isinstance(data, dict) else None
    if not isinstance(given, str) or not secrets.compare_digest(given.encode('utf-8', 'replace'), PASSWORD.encode('utf-8', 'replace')):
        return refuse(401, 'That password is not right.')
    expires = int(time.time()) + STAY
    response = jsonify(ok=True)
    response.set_cookie('login', ticket(expires), max_age=STAY, httponly=True, secure=ON_RENDER, samesite='Strict', path='/')
    return response


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
    return jsonify(ok=True, writer=writer.ready) if inside() else jsonify(ok=True)


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


def ask_writer(work):
    """Checks a request for the AI writer, then runs work(data, text) and returns its answer."""
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
    clean = {}
    for name, most in (('text', PART_LIMIT), ('hint', 1000), ('sample', SAMPLE_LIMIT), ('notes', SAMPLE_LIMIT), ('context', CONTEXT_LIMIT)):
        value = data.get(name) or ''
        if not isinstance(value, str) or len(value) > most:
            return refuse(400, f'Keep the {name} under {most:,} characters.')
        clean[name] = value.encode('utf-8', 'replace').decode()
    if not clean['text'].strip():
        return refuse(400, 'Send some text.')
    if not writing.acquire(timeout=30):
        return refuse(503, 'The AI writer is busy. Try again in a moment.')
    try:
        return jsonify(work(data, clean))
    except WriterError as error:
        app.logger.warning('writer: %s', error)
        return refuse(error.status, str(error))
    finally:
        writing.release()


@app.post('/api/write')
def write():
    """One new version of one part of a text."""
    def work(data, clean):
        kind, level, attempt = data.get('type'), data.get('level'), data.get('attempt')
        return writer.write(
            clean['text'], kind if isinstance(kind, str) else 'general', level if isinstance(level, str) else 'normal', data.get('contractions') is not False, clean['hint'],
            attempt if type(attempt) is int and 0 <= attempt < 9 else 0, visitor(), clean['sample'], clean['notes'], clean['context'], data.get('items') is True)
    return ask_writer(work)


@app.post('/api/points')
def points():
    """What a text says, as notes for someone who will write it themselves."""
    return ask_writer(lambda data, clean: writer.points(clean['text'], visitor()))


@app.post('/api/polish')
def polish():
    """The visitor's own writing, proofread or put into English."""
    return ask_writer(lambda data, clean: writer.polish(clean['text'], data.get('english') is True, visitor()))


if __name__ == '__main__':
    serve(
        app, host='0.0.0.0' if ON_RENDER else '127.0.0.1', port=int(os.environ.get('PORT', 8000)), threads=12, ident=None,
        max_request_body_size=MAX_BODY, max_request_header_size=16_384, channel_timeout=240, connection_limit=200,
    )
