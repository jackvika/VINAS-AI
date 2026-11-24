# VINAS AI

**Use it now: <https://jackvika.github.io/VINAS-AI/>**

A website that makes AI-written English read more like a person wrote it. It is plain HTML, CSS and JavaScript with no database or build step, plus a small PHP API for full rewrite.

There are two ways to run it:

- **Quick clean** works anywhere, including GitHub Pages. Fixed rules run in the browser, and no text is uploaded.
- **Full rewrite** works when the site runs on a server with an AI key. The server sends the text and the rules in `skill/SKILL.md` to an AI model. Visitors need no key.

It checks text for common forms of 26 signs of AI writing, fixes the ones a program can fix, and highlights the rest for the writer.

## Features

- Careful mode for safe fixes, Strong mode, which also cuts hype, and Human mode, which also uses plain words, contractions and varied sentence rhythm; every change is listed
- A finishing editor: pick, remove, keep or retype each phrase that is left, add your own details where a claim is vague, and undo any step
- Sentence variety and reading ease scores
- First rewrite, the tells that survived it, and the final version
- Voice matching from a writing sample
- Settings for general, personal, technical, informal and reply text
- `.txt` and `.md` upload that leaves code, links, tables and front matter alone
- A warning when a number, link or likely name goes missing
- Copy, text download and PDF download
- A page that checks any rewrite against its original
- A guide to all 26 patterns, with examples

## Run it

Open `index.html` in a browser, or serve the folder from any web host. GitHub Pages serves it from the root of the `main` branch.

It needs a current browser. On Safari, that means 16.4 or newer.

## Host it with full rewrite

The `Dockerfile` runs the site on PHP and Apache. On [SnapDeploy](https://snapdeploy.dev):

1. Create a free key in [Google AI Studio](https://aistudio.google.com/apikey), or at [OpenRouter](https://openrouter.ai/settings/keys).
2. Connect this GitHub repository as a new container. Use the `Dockerfile` and port 8080.
3. Add the key as a secret named `GEMINI_API_KEY` or `OPENROUTER_API_KEY`. With both set, OpenRouter is the fallback.
4. Deploy, then open `/api/health.php`. It must show `"ai":true`.

Never put a key in a file or a commit. Optional settings: `HOURLY_LIMIT` (calls per visitor, default 30), `DAILY_LIMIT` (calls for the whole site, default 200). One rewrite uses one to three calls. The counts reset when the container restarts.

On Gemini's free tier, Google may use and review the text, visitors must be 18 or over, and the site must not be offered in the EEA, Switzerland or the UK. Use a paid key for those.

## Test it

Open `tests/index.html` in a browser. The [live copy](https://jackvika.github.io/VINAS-AI/tests/) runs the same tests.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Humanizer |
| `check.html` | Compares two versions of a text |
| `guide.html`, `about.html` | Pattern guide and how it works |
| `static/rules.js` | Phrases and patterns to fix or highlight |
| `static/engine.js` | Rewriting engine |
| `static/brain.js` | Sentence rebuilding for Human mode |
| `static/pdf.js` | PDF writer |
| `static/site.js`, `app.js` | Page behavior and buttons |
| `static/content.js` | Examples, size limit and font widths |
| `static/full.js` | Full rewrite, in the browser |
| `api/` | Full rewrite, on the server |
| `Dockerfile` | Server image |
| `tests/` | Tests |
| `skill/` | Files from the original Humanizer project |

The earlier PHP version is on the [`php` branch](https://github.com/jackvika/VINAS-AI/tree/php). It is kept for reference and does not get new features.

## Limits

- It matches known phrasings. It does not rebuild whole paragraphs, and it misses tells worded another way.
- It works on English only.
- It does not try to get past AI detectors, and it cannot certify that text is human written.
- PDF download covers Western European characters. For other scripts, the result page offers the browser's print window.

## License and credits

VINAS AI is under the [MIT License](LICENSE).

The rules and the files in `skill/` come from [blader/humanizer](https://github.com/blader/humanizer), copyright 2025 Siqi Chen, under its own [MIT License](skill/LICENSE.txt). Keep that notice and credit in any copy. This project is not affiliated with it.
