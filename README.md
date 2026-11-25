# VINAS

Ask a question, and get an answer put together from Wikipedia and an open business textbook, with a source for every paragraph. There is no AI service and no key, and nothing is saved.

## What it does

- Reads the question: definition, list, reason, date, number or comparison
- Searches Wikipedia (English, simple English or Hindi) from the visitor's browser and reads up to three articles
- Business questions are looked up first in OpenStax *Introduction to Business*; definitions, comparisons and everything else in Wikipedia
- Reads exam wording: "examine", "discuss", "in a large business organization" are set aside, and "(10 marks)" sets the length (3 marks 80 words, 6 marks 220, 10 marks 400)
- Textbook lists (levels and functions of management, marketing mix, product life cycle, Maslow and others, in `ITEMS` in `static/ask.js`) are answered item by item, each under its own heading
- Ranks every sentence with a neural network and BM25, with bonuses for section, place and kind of answer
- Puts the best sentences in reading order, with headings, sources, and a warning when little was found
- Checks that a sentence really answers: a height for "how tall", a doer for "who", a date of that event for "when". If none does, it says "Not sure: no right answer was found" and folds the closest sentences away; the warning is also in the copy and the PDF
- Works out sums such as `15% of 2400`, without running any code
- Copy, text and PDF, always with the sources

It quotes; it does not reason or write new sentences, and it knows only what Wikipedia says.

## Other pages

- `humanize.html`: plainer words for stiff English, by fixed rules and a word brain
- `check.html`: compares two versions of a text
- `guide.html`: 26 signs of AI writing

## The reader

A MiniLM cross-encoder, [`cross-encoder/ms-marco-MiniLM-L6-v2`](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2) (Apache-2.0), reads the question together with each of the likeliest sentences and says how likely the sentence is an answer. It also helps to choose the articles. `static/judge-worker.js` runs it in the browser with ONNX Runtime Web, in its own thread. It is a 37 MB download from this site, the first time someone asks, and the files and their hashes are in `static/vendor/`.

On 480 questions from SQuAD 1.1 about 48 articles, choosing among all the sentences of the article:

| | First choice right | In the first 3 | In the first 5 |
|---|---|---|---|
| BM25 | 72.3% | 88.3% | 91.7% |
| Reader on the best candidates | **81.9%** | **91.0%** | **94.0%** |

On 65 real questions asked through the page, an answer that held the expected word came up for 61: 44 of 45 that were at hand during the work, and 17 of 20 asked afterwards for the first time. Of those 20, the other three were wrong without a warning.

An earlier network trained for this site is gone. Its figures here had been measured on sentences already sifted by BM25; among all sentences its first choice was right only 61.7% of the time, worse than BM25 alone.

Hindi questions use patterns and BM25, as does a browser that cannot run the reader.


## The textbook

`static/book.json` holds the running text of [*Introduction to Business*](https://openstax.org/details/books/introduction-business) by OpenStax (CC BY 4.0), without figures, tables, chapter stories and exercises. `brain/build_book.py` builds it from OpenStax's own repository. OpenStax does not endorse this site. OpenStax asks that the book not be used to train, or be fed to, generative AI without permission; this site has none, so keep it that way or leave the book out. *Principles of Management* and *Organizational Behavior* are under a non-commercial licence and are not used.

The search was measured on 261 questions the book itself asks, 1,608 passages, with the right section counted among the first 1, 3 and 5. The book has since lost its chapter stories, so treat these as a comparison of methods:

| Method | 1 | 3 | 5 |
|---|---|---|---|
| BM25, no titles | 34.5% | 58.6% | 69.3% |
| BM25, with titles | 38.3% | 60.5% | 70.1% |
| multi-qa-MiniLM-L6-cos-v1 | 43.7% | 59.4% | 68.6% |
| BM25 and multi-qa together | 44.8% | 65.1% | 72.4% |
| BM25 with titles, then the reader (used) | 47.5% | 63.6% | 72.0% |
| BM25 and multi-qa, then the reader | 46.7% | 64.4% | 74.7% |

With the reader in place, the second model would cost another 23 MB download and not find the right section first more often, so it is not used.

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
