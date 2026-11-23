# VINAS AI

**Use it now: <https://jackvika.github.io/VINAS-AI/>**

A website that makes AI-written English read more like a person wrote it. It is plain HTML, CSS and JavaScript with no server code, database or build step.

There are two ways to use it. **AI rewrite** rebuilds the text with a Gemini or OpenRouter key that each visitor supplies, then checks the answer and sends problems back. **Quick clean** runs in the browser without AI and uploads nothing.

It checks text for common forms of 26 signs of AI writing, fixes the ones a program can fix, and highlights the rest for the writer.

## Features

- AI rewrite with automatic fact and style checks; the key goes only to the chosen service and is kept in the visitor's browser
- Careful mode for safe fixes, Strong mode, which also cuts hype, and Human mode, which also uses plain words, contractions and varied sentence rhythm; every change is listed
- Tips on where the writer should add a real detail, plus sentence variety and reading ease scores
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

## Test it

Open `tests/index.html` in a browser. The [live copy](https://jackvika.github.io/VINAS-AI/tests/) runs the same tests.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Rewrite page |
| `check.html` | Compares a rewrite with its original |
| `guide.html`, `about.html` | Pattern guide and how it works |
| `static/rules.js` | Phrases and patterns to fix or highlight |
| `static/engine.js` | Rewriting engine |
| `static/ai.js` | AI rewrite |
| `static/pdf.js` | PDF writer |
| `static/site.js`, `app.js` | Page behavior and buttons |
| `static/content.js` | Examples, size limit, rewrite prompt and font widths |
| `tests/` | Tests |
| `skill/` | Files from the original Humanizer project |

The earlier PHP version is on the [`php` branch](https://github.com/jackvika/VINAS-AI/tree/php). It is kept for reference and does not get new features.

## Limits

- Quick clean matches known phrasings. It does not rebuild whole paragraphs, and it misses tells worded another way.
- AI rewrite depends on the chosen model and its free limits, and it can change meaning.
- It works on English only.
- It does not try to get past AI detectors, and it cannot certify that text is human written.
- PDF download covers Western European characters. For other scripts, the result page offers the browser's print window.

## License and credits

VINAS AI is under the [MIT License](LICENSE).

The rules and the files in `skill/` come from [blader/humanizer](https://github.com/blader/humanizer), copyright 2025 Siqi Chen, under its own [MIT License](skill/LICENSE.txt). Keep that notice and credit in any copy. This project is not affiliated with it.
