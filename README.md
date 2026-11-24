# VINAS

Ask a question, and get an answer put together from Wikipedia, with a source for every sentence. No AI model is used, there is no key, and nothing is saved.

## What it does

- Reads the question: definition, list, reason, date, number or comparison
- Searches Wikipedia (English, simple English or Hindi) from the visitor's browser and reads up to three articles
- Ranks every sentence with BM25, with bonuses for section, place and kind of answer
- Puts the best sentences in reading order, with headings, sources, and a warning when little was found
- Works out sums such as `15% of 2400`, without running any code
- Copy, text and PDF, always with the sources

It quotes; it does not reason or write new sentences, and it knows only what Wikipedia says.

## Other pages

- `humanize.html`: plainer words for stiff English, by fixed rules and a word brain
- `check.html`: compares two versions of a text
- `guide.html`: 26 signs of AI writing

## Run it

```
pip install -r requirements.txt
python server.py
```

Then open <http://localhost:8000>. On Render, choose **New > Blueprint** and pick the repository.

Set `SITE_PASSWORD` to put the whole site behind a password.

## Test it

`python -m unittest tests.test_brain` for the server. Open `tests/index.html` in a browser for the rest.

## The word brain

A 4-gram language model with Kneser-Ney smoothing, trained by `brain/train.py` on 2,073,129 sentences people wrote or said. For each sentence it compares the wordings it knows and takes the likeliest. See `brain/SOURCES.md`.

## Security

- Only the pages, scripts and styles are served. A strict content security policy allows no inline scripts and no site but this one and three Wikipedias.
- Text from Wikipedia is added as text, never as HTML.
- The calculator reads sums itself and never evaluates code.
- The server has limits on size and rate, and its patterns cannot be frozen by hostile text.

## License and credits

VINAS is under the [MIT License](LICENSE). Answers are Wikipedia text under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Wikipedia is a trademark of the Wikimedia Foundation, which does not endorse this site.

The rules and the files in `skill/` come from [blader/humanizer](https://github.com/blader/humanizer), copyright 2025 Siqi Chen, under its own [MIT License](skill/LICENSE.txt).
