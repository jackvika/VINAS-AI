# VINAS

Ask a question, and get an answer put together from Wikipedia and fourteen open textbooks, with a source for every paragraph. There is no AI service and no key, and nothing is saved.

## What it does

- Reads the question: definition, list, reason, date, number or comparison
- Searches Wikipedia (English, simple English or Hindi) from the visitor's browser and reads up to three articles
- Business questions are looked up first in fourteen open textbooks; definitions, comparisons and everything else in Wikipedia
- Turns a question on the course into one structured query (`Parse.query` in `static/parse.js`): its parts, each a topic with a facet (definition, types, importance, ...) and a weight, the command, marks, words, subject, language and how sure it is. Question numbers, marks, `[CO2]` and filler are taken off, "briefly" and "in detail" set a part's weight, "its" is the topic named before, and the second of two questions with OR between them is offered as a button
- Knows about 970 topics of the course by name, with their other names, short forms, and 160 with Hindi and Hinglish names (`static/glossary.json`): the longest name counts first, so "management science", "scientific management" and "management as a science" are three topics. Spelling is mended only towards a word of a known topic
- Takes quoted statements ("Management is both a science and an art") apart into their claims (`static/statements.json`); a statement that is not listed gets a definition, features and a conclusion, and is marked as not sure
- Says above each answer how the question was read ("Understood as: Planning: definition, types, importance"); each part can be changed or removed there, and other readings are offered
- Marks what it says itself with "Prepared by VINAS", on the page and in the copy, the text file and the PDF, and names a part without a sure answer under "Not found in sources"
- Has a picker for the semester and the subject, remembered in the browser only
- Says plainly that it does not solve numerical problems
- Answers have the form of an exam answer: an introduction that says what the topic is, numbered points, and a conclusion when a source has a sentence that closes. The sentences stay as the sources have them
- `bba.html` has the whole three-year BBA, 88 subjects, by unit and topic; a topic is answered with one click
- Marks set the length: 2 marks 50 words, 3 marks 80, 5 marks 180, 6 marks 220, 7.5 marks 280, 10 marks 400, 12 marks 480, 15 marks 600, 16 marks 640, 20 marks 800, and between them in proportion. Without marks a question on the course gets 400 words, a definition 130, a comparison 260 and a short note 150. Other questions, on any topic, are read as before by their kind
- Textbook lists (levels and functions of management, marketing mix, product life cycle, Maslow and others, in `ITEMS` in `static/ask.js`) are answered item by item, each under its own heading. An item has other names, words that a good answer speaks of, and phrases that only look alike ("line management" is not first-line management), which are kept out; a list opens with a sentence that defines its subject
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


## The textbooks

`static/books/` holds the running text of eight books by [OpenStax](https://openstax.org): *Introduction to Business*, *Principles of Management*, *Organizational Behavior*, *Principles of Marketing*, *Principles of Economics 3e*, *Business Ethics*, *Entrepreneurship* and *Introductory Business Statistics 2e*, without figures, tables, formulas, chapter stories and exercises. `brain/build_book.py` builds them.

**Licence.** OpenStax put most of its books under CC BY-NC-SA on 23 April 2026. The text here comes from earlier commits, named in the builder, at which the collection file, the LICENSE file and the preface of each book all said CC BY 4.0; a licence once given under CC BY 4.0 is not taken back. The builder refuses a book for which one of the three says otherwise. An earlier version of this site used the second edition of *Introduction to Business* under the wrong licence; it was replaced by the first. **Non-commercial books.** *Principles of Accounting* 1 and 2, *Principles of Finance 2e* and *Business Law I Essentials 2e* are under **CC BY-NC-SA 4.0** (`FREE_SITE` in the builder). They are here because the owner keeps this site free and without income. If that ever changes (advertising, fees, selling), delete these four files from `static/books/` and their names from `static/book.js` and `brain/build_bba.py`. The four JSON files are adaptations and stay under CC BY-NC-SA 4.0. OpenStax does not endorse this site, and asks that its books not be used to train, or be fed to, generative AI without permission; this site has none.

Two more books come from `brain/build_open.py`: *Project Management*, 2nd edition, by Adrienne Watt (BCcampus, CC BY 4.0) and *Accounting Principles: A Business Perspective* by Hermanson, Edwards and Maher (CC BY, as LibreTexts and the Open Textbook Library state). The accounting text on LibreTexts is complete only for the first chapters, so only those are here.

**Books of Indian universities.** Looked into and not used: Netaji Subhas Open University offers its books under CC BY-NC-SA, but its site asks automatic programs to stay away; the books of Uttarakhand Open University carry no licence of their own (the Creative Commons note in them is for the cover picture); IGNOU's repository could not be reached and its policy leaves the licence to each item; Odisha State Open University's portal is suspended. Commercial textbooks are under copyright.

## The BBA course

`static/bba.json` is built by `brain/build_bba.py` from the [AICTE model curriculum for the BBA (2024)](https://aud.delhi.gov.in/sites/default/files/2026-06/aicte_bba_syllabus.pdf): the names of subjects, units and topics of semesters 1 to 6 and six specialisations. Universities change the order, and AICTE does not endorse this site. In a test of 30 topics picked at random, the site gave a sure answer to 19 or fewer; a few of those were about another meaning of the words, and for the rest it said "Not sure". Accounting, taxation, Indian law and very narrow topics are the weakest.

**Exam questions.** The question banks that Vardhman Mahaveer Open University publishes were used to check the reading of questions: Management and Economics while it was written, and 42 questions from Business Environment, Statistics and Communication afterwards. The site gave a sure answer to 31 of the 42 (4 of them with one part missing), against 25 before; a few small repairs were made after these were seen, and a sure answer is not always a right one. Of 16 questions on accounting it was sure of 5.

## How the search was chosen

The search was measured on 261 questions that *Introduction to Business* asks itself (second edition), 1,608 passages, with the right section counted among the first 1, 3 and 5. Treat these as a comparison of methods:

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

`python -m tests.evaluate` measures how questions are read and how well answers cover what an examiner expects (it needs Chrome): 190 questions with their expected reading in `tests/parse_cases.json`, 72 of them from past papers of Vardhman Mahaveer Open University, and 42 exam questions with key points in `tests/answer_quality.json`. A fifth of each is kept apart in `tests/held_back.json` for a final check, with 40 questions that a script took, unread, from past papers of Vardhman Mahaveer Open University (2019) and UPES (2024). `--read` prints how a question is read, `--ask` the answer to it, and `--what page` tries what a visitor can do with the line above an answer. `tests/results/` has the figures. The SQuAD part needs `dev-v1.1.json`, and its sample, ten questions spread evenly over each article, is not the one behind the table above; the 65 questions mentioned above were not kept, and `tests/general_cases.json` stands in for them.

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
