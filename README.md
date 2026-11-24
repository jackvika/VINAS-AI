# VINAS AI

**Use it now: <https://jackvika.github.io/VINAS-AI/>**

A website that makes AI-written English read more like a person wrote it. The pages are plain HTML, CSS and JavaScript. A small Python server adds a brain that learned English from text people wrote.

Paste text, choose your settings, press Humanize, then copy the result or download a PDF. Fixed rules in the browser fix the known signs of AI writing. Then, in Human mode, the brain on the site's own server picks the wording people use most. It needs no database, AI service or key. The text is not saved, and you can turn the brain off.

It checks text for common forms of 26 signs of AI writing, fixes the ones a program can fix, and highlights the rest for the writer.

## Features

- Careful mode for safe fixes, Strong mode, which also cuts hype, and Human mode, which also uses plain words, contractions and varied sentence rhythm; every change is listed
- A brain trained on 2 million human sentences, which chooses wording by context and points out stiff sentences
- A finishing editor: pick, remove, keep or retype each phrase that is left, add your own details where a claim is vague, and undo any step
- Sentence variety and reading ease scores
- First rewrite, the tells that survived it, and the final version
- Voice matching from a writing sample
- Settings for general, personal, technical, informal and reply text
- `.txt` and `.md` upload that leaves code, links, tables and front matter alone
- A warning when a number, link or likely name goes missing
- Copy, text download and PDF download in any script
- A page that checks any rewrite against its original
- A guide to all 26 patterns, with examples

## Run it

With the brain (Python 3.12):

```
pip install -r requirements.txt
python server.py
```

Then open <http://localhost:8000>.

Without it, open `index.html` in a browser or use any static host, such as GitHub Pages. The site then uses its rules alone.

## Put it on Render

1. Push this folder to GitHub, including `brain/human.bin` (45 MB).
2. In Render, choose **New > Blueprint** and pick the repository. `render.yaml` sets everything.
3. Open the address Render gives you.

The free plan sleeps when nobody visits. The first visit after that can take about a minute.

## The brain

It is a language model in the older sense: it remembers how often people put words together, up to four at a time. It learned from 2,073,129 sentences (25 million words and marks), most of them speech and everyday sentences, all from before ChatGPT.

For each sentence it lists the other wordings it knows, then searches for the version of the whole sentence that people are most likely to write. It cannot invent words or facts, because it only picks from a reviewed list. Names, numbers, quotations, links and code are locked.

On 1,500 human sentences it had not seen, it changed about 0.7 things per 100 words. On the AI-style samples written for testing it changes 10 to 20.

To teach it again, see `brain/train.py`. Its sources are in `brain/SOURCES.md`.

It needs a current browser. On Safari, that means 16.4 or newer.

## Test it

Run `python -m unittest tests.test_brain` for the brain and server. For the rules, open `tests/index.html` in a browser. The [live copy](https://jackvika.github.io/VINAS-AI/tests/) runs the same tests.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Humanizer |
| `check.html` | Compares two versions of a text |
| `guide.html`, `about.html` | Pattern guide and how it works |
| `static/rules.js` | Phrases and patterns to fix or highlight |
| `static/engine.js` | Rewriting engine |
| `static/brain.js` | Sentence rebuilding for Human mode |
| `server.py` | Serves the pages and the brain |
| `brain/model.py`, `brain/human.bin` | What the brain learned |
| `brain/rewrite.py`, `brain/phrases.py` | How it rewrites, and the wordings it can choose |
| `brain/train.py` | Teaches it |
| `static/pdf.js` | PDF writer |
| `static/site.js`, `app.js` | Page behavior and buttons |
| `static/content.js` | Examples, size limit and font widths |
| `tests/` | Tests |
| `skill/` | Files from the original Humanizer project |

The earlier PHP version is on the [`php` branch](https://github.com/jackvika/VINAS-AI/tree/php). It is kept for reference and does not get new features.

## Security

- Only the pages, scripts and styles are served. The code, model, tests and hidden files are not.
- A strict content security policy blocks inline scripts, other sites and framing, and all text is escaped before it is shown.
- The brain accepts up to 50,000 characters, 30 requests a minute from each visitor, and no requests from other sites' pages.
- Patterns are written so that hostile text cannot freeze the server. `tests/test_brain.py` checks this.
- Text is not saved or logged. Visitor addresses are held in memory for a minute to count requests.

## Limits

- The rules match known phrasings, and the brain chooses among listed wordings. It does not rebuild whole paragraphs, and it misses tells worded another way.
- It works on English only.
- It does not try to get past AI detectors, and it cannot certify that text is human written.
- PDF text in Western European characters can be selected. Other scripts, symbols and emoji are drawn as pictures, so it cannot.

## License and credits

VINAS AI is under the [MIT License](LICENSE).

The rules and the files in `skill/` come from [blader/humanizer](https://github.com/blader/humanizer), copyright 2025 Siqi Chen, under its own [MIT License](skill/LICENSE.txt). Keep that notice and credit in any copy. This project is not affiliated with it.
