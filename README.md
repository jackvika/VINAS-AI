# VINAS AI

A PHP website that makes AI-written English read more like a person wrote it. It needs no API key, database or Composer packages.

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

The `.htaccess` files in `src` and `tests` work on Apache only. On another server, block those two folders yourself.

## Test it

```
php tests/run.php
```

## Files

| Path | Purpose |
|---|---|
| `index.php` | Rewrite page |
| `check.php` | Compares a rewrite with its original |
| `guide.php`, `about.php` | Pattern guide and how it works |
| `pdf.php`, `src/Pdf.php` | PDF download |
| `src/Humanizer.php` | Rewriting engine |
| `src/rules.php` | Phrases and patterns to fix or highlight |
| `skill/` | Files from the original Humanizer project |

## Limits

- It matches known phrasings. It does not rebuild whole paragraphs, and it misses tells worded another way.
- It works on English only.
- It does not try to get past AI detectors, and it cannot certify that text is human written.
- PDF download covers Western European characters. For other scripts, the result page offers the browser's print window.

## Credits

The rules come from [blader/humanizer](https://github.com/blader/humanizer), copyright 2025 Siqi Chen, under the [MIT License](skill/LICENSE.txt). That license covers the files in `skill/`. This project is not affiliated with it.
