# VINAS AI

**Use it now: <https://jackvika.github.io/VINAS-AI/>**

A website that makes AI-written English read more like a person wrote it. It runs on PHP, or entirely in the browser on hosts without PHP. It needs no API key, database or Composer packages.

It checks text for common forms of 26 signs of AI writing, fixes the ones a program can fix safely, and highlights the rest for the writer.

## Features

- Careful mode for safe fixes, and Strong mode, which also cuts hype and lists every cut
- First rewrite, the tells that survived it, and the final version
- Voice matching from a writing sample
- Settings for general, personal, technical, informal and reply text
- `.txt` and `.md` upload that leaves code, links, tables and front matter alone
- A warning when a number, link or likely name goes missing
- Copy, text download and PDF download
- A page that checks any rewrite against its original
- A guide to all 26 patterns, with examples

## Run it

You need PHP 8.1 or newer with the `mbstring` and `iconv` extensions. It was tested on PHP 8.2 with XAMPP on Windows.

With XAMPP, copy this folder to `htdocs/humanizer`, start Apache, and open <http://localhost/humanizer/>.

Without Apache, run this in the folder and open <http://localhost:8000/>:

```
php -S localhost:8000
```

The `.htaccess` files work on Apache only. On another server, block `src`, `tests`, `tools` and `.git` yourself.

## Two versions

| Version | Where it runs | Entry page |
|---|---|---|
| PHP | XAMPP or any PHP host | `index.php` |
| Browser | GitHub Pages or any static host; text is not uploaded | `index.html` |

The `.html` pages and `static/data.js` are built from the PHP files. After you change a page, a rule or a file in `skill/`, run:

```
php tools/build.php
```

`static/engine.js` and `static/pdf.js` are written by hand. If you change `src/Humanizer.php` or `src/Pdf.php`, make the same change there.

## Test it

```
php tests/run.php
php tools/build.php --tests
```

The second command writes `tests/cases.js`. Then run `php -S localhost:8000` and open <http://localhost:8000/tests/browser.html> to compare the browser version with PHP.

## Files

| Path | Purpose |
|---|---|
| `index.php` | Rewrite page |
| `check.php` | Compares a rewrite with its original |
| `guide.php`, `about.php` | Pattern guide and how it works |
| `pdf.php`, `src/Pdf.php` | PDF download |
| `src/Humanizer.php` | Rewriting engine |
| `src/rules.php` | Phrases and patterns to fix or highlight |
| `static/` | Browser version of the engine, PDF writer and pages |
| `tools/build.php` | Builds the browser version |
| `skill/` | Files from the original Humanizer project |

## Limits

- It matches known phrasings. It does not rebuild whole paragraphs, and it misses tells worded another way.
- It works on English only.
- It does not try to get past AI detectors, and it cannot certify that text is human written.
- PDF download covers Western European characters. For other scripts, the result page offers the browser's print window.

## Put it online

GitHub Pages serves the browser version from the root of the `main` branch. GitHub cannot run the PHP version. For that, use a host that supports PHP 8.1 or newer and leave out `.git`, `tests` and `tools`.

## License and credits

VINAS AI is under the [MIT License](LICENSE).

The rules and the files in `skill/` come from [blader/humanizer](https://github.com/blader/humanizer), copyright 2025 Siqi Chen, under its own [MIT License](skill/LICENSE.txt). Keep that notice and credit in any copy. This project is not affiliated with it.
