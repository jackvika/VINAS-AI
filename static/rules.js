// Phrases and patterns to fix or highlight, from skill/SKILL.md (blader/humanizer, MIT) plus Human mode.
// Keys are pattern numbers. Patterns are regular expressions; write apostrophes as ' and the engine also matches the curly form.
const RULES = {
    "patterns": {
        "1": [
            "Not X but Y",
            "State the positive point directly."
        ],
        "2": [
            "One-line closers",
            "Cut a closer that only repeats the point."
        ],
        "3": [
            "Sayings that sound deep",
            "Replace the saying with the specific claim."
        ],
        "4": [
            "Staged run-up",
            "Remove the run-up and state the point."
        ],
        "5": [
            "Arguing with no one",
            "Remove the unraised objection; keep any real claim."
        ],
        "6": [
            "Forced triads",
            "Use only as many items as the meaning needs."
        ],
        "7": [
            "Repeated sentence openings",
            "Merge the sentences or change the subject."
        ],
        "8": [
            "Dashes everywhere",
            "Use a period, comma, colon or parentheses."
        ],
        "9": [
            "Stacked qualifiers",
            "Keep one qualifier at most."
        ],
        "10": [
            "Hyphenated pairs",
            "Drop the hyphen after the noun."
        ],
        "11": [
            "Missing subjects",
            "Name who does the action if it makes it clearer."
        ],
        "12": [
            "Overused AI words",
            "Use a plainer word."
        ],
        "13": [
            "Inflated significance",
            "Keep the fact and drop the significance."
        ],
        "14": [
            "Vague connection",
            "Name the actual relationship if you know it."
        ],
        "15": [
            "Shallow -ing phrases",
            "Keep it only if it adds a supported fact."
        ],
        "16": [
            "Sales language",
            "Say plainly what the thing is."
        ],
        "17": [
            "Borrowed authority",
            "Name the source and what it said, or cut the claim."
        ],
        "18": [
            "Avoiding is, are, has",
            "Use is, are or has."
        ],
        "19": [
            "Bold as decoration",
            "Remove the bold."
        ],
        "20": [
            "Decorative headings",
            "Use sentence case; remove emojis, arrows and rules."
        ],
        "21": [
            "Curly quotation marks",
            "Use straight quotes."
        ],
        "22": [
            "Chatbot residue",
            "Remove the chatbot wrapper."
        ],
        "23": [
            "Knowledge-limit disclaimers",
            "Say what the source does not show, or cut it."
        ],
        "24": [
            "Heading repeated",
            "Cut the line that repeats the heading."
        ],
        "25": [
            "Writing about the document",
            "Describe the subject instead."
        ],
        "26": [
            "Re-explaining what the reader knows",
            "Lead with the decision; cut background the reader already has."
        ],
        "27": [
            "Plain words",
            "Use the short, everyday word."
        ],
        "28": [
            "Filler and connectors",
            "Cut the warm-up and start with the point."
        ],
        "29": [
            "Contractions",
            "Write it the way people say it."
        ],
        "30": [
            "Sentence rhythm",
            "Break a long sentence so lengths vary."
        ]
    },
    "delete": {
        "2": [
            "let that sink in",
            "read that again",
            "that(?:'s| is) the real win",
            "that distinction matters"
        ],
        "4": [
            "let's dive (?:right )?in",
            "let's break (?:this|it) down",
            "here's what you need to know",
            "let's explore"
        ],
        "13": [
            "the future (?:looks|is) bright(?: for [^.!?\\n\\d]{1,60})?",
            "exciting times (?:lie |are )?ahead(?: [^.!?\\n\\d]{1,80})?"
        ],
        "22": [
            "great question",
            "(?:you're|you are) absolutely right",
            "certainly(?=!)",
            "of course(?=!)",
            "absolutely(?=!)",
            "(?:i )?hope this helps",
            "let me know if you(?:'d like| would like| want) me to [^.!?\\n]{1,120}",
            "(?:would you like|do you want|want) me to [^.!?\\n]{1,120}(?=\\?)",
            "should i continue(?=\\?)",
            "here(?:'s| is) an? (?:overview|summary|breakdown|rewritten version|revised version) of [^.!?:\\n]{1,80}(?=[.:])"
        ]
    },
    "strip": {
        "3": [
            "at its core,",
            "fundamentally,"
        ],
        "4": [
            "here's the thing[:.,]",
            "the thing is[:,]",
            "honestly\\?",
            "real talk[:.]",
            "without further ado,",
            "let's be honest[:,.]",
            "(?:and )?the best part\\?",
            "the result\\?",
            "look,(?= (?:the|this|it|we|you|i)\\b)"
        ],
        "5": [
            "don't get me wrong[,.:]"
        ],
        "12": [
            "actually,"
        ],
        "23": [
            "as of my last (?:training |knowledge )?(?:update|cutoff)(?: in [^,.\\n]{1,30})?,"
        ]
    },
    "swap": {
        "9": {
            "could potentially possibly": "could",
            "(could|might|may) (?:potentially|possibly)": "$1",
            "might arguably": "might"
        },
        "12": {
            "additionally,": "also,",
            "deep dive": "close look",
            "delve into": "look at",
            "delves into": "looks at",
            "delved into": "looked at",
            "delving into": "looking at",
            "showcase(?= (?:the|a|an|our|their|its|his|her|your|how|what)\\b)": "show",
            "showcases(?= (?:the|a|an|our|their|its|his|her|your|how|what)\\b)": "shows",
            "showcased": "showed",
            "showcasing": "showing",
            "meticulously": "carefully",
            "meticulous": "careful",
            "crucial": "important",
            "pivotal": "important",
            "garners": "gets",
            "garnered": "got",
            "garnering": "getting",
            "garner": "get",
            "bolstered": "strengthened",
            "intricacies": "details",
            "intricate": "complex",
            "vibrant": "lively",
            "enduring": "lasting",
            "enhances": "improves",
            "enhanced": "improved",
            "enhancing": "improving",
            "enhance": "improve",
            "underscores(?= (?:the|a|an|its|how|that)\\b)": "shows",
            "underscored(?= (?:the|a|an|its|how|that)\\b)": "showed"
        },
        "13": {
            "(?:stands as|serves as|is) an? (?:lasting |enduring |true )?testament to": "shows",
            "plays an? (?:crucial|key|pivotal|vital|significant|important) role in": "plays a role in",
            "play an? (?:crucial|key|pivotal|vital|significant|important) role in": "play a role in"
        },
        "16": {
            "nestled in the heart of": "in",
            "nestled (?:in|within)": "in",
            "nestled (among|between|beneath)": "$1",
            "a diverse array of": "many"
        },
        "18": {
            "(to|can|could|will|would|may|might|must|should) serve as": "$1 be",
            "serves as": "is",
            "stands as": "is",
            "(?:functions|operates) as(?= (?:a|an|the)\\b)": "is",
            "(?:boasts|features)(?= (?:a|an|over|more than|\\d+|two|three|four|five|six|seven|eight|nine|ten)\\b)": "has",
            "boasts": "has"
        }
    },
    "strong_delete": {
        "2": [
            "(?:this|that) (?:shows|highlights|demonstrates) the importance of [^.!?\\n\\d]{1,80}",
            "it was a lesson in [^.!?\\n\\d]{1,40}"
        ],
        "4": [
            "let's (?:dive into|explore|take a look at|look at) [^.!?\\n]{1,80}"
        ],
        "5": [
            "an? (?:tempting|obvious) approach would be [^.!?\\n\\d]{1,200}",
            "this isn't (?:mainly |really )?about [^.!?\\n,]{1,80}"
        ],
        "13": [
            "despite (?:these|its|the) challenges,? [^.!?\\n\\d]{0,160}(?:continues? to thrive|remains? resilient)[^.!?\\n\\d]{0,80}"
        ]
    },
    "strong_strip": {
        "2": [
            "the message was clear:"
        ],
        "4": [
            "i'm (?:thrilled|excited|delighted|proud) to (?:announce|share) that",
            "the (?:hard|slow|tricky|best|new) part is that",
            "let me tell you,"
        ],
        "5": [
            "to be clear,",
            "i'm not saying [^.,!?\\n]{2,80}, but",
            "some might say [^.,!?\\n]{2,100}, but",
            "you might think [^.,!?\\n]{2,100}, but"
        ]
    },
    "strong_swap": {
        "1": {
            "(it|this|that)('s| is) not [^.;,!?\\n]{2,60}[,;.] (?:it|this|that)(?:'s| is)": "$1$2",
            "(is|are|was|were)(?:n't| not) (?:a|an|the|about) [^.;,!?\\n—–]{2,50}\\s*[;.,—–]\\s*(?:it|they)(?:'s|'re| is| are| was| were)(?= (?:a|an|the|about)\\b)": "$1"
        },
        "3": {
            "the real question is": "the question is",
            "what (?:really|truly) (matters|makes)": "what $1"
        },
        "4": {
            "and let me tell you,": "and"
        },
        "16": {
            "hidden gem": "place",
            "rich (cultural|history|heritage|tradition)": "$1",
            "in the heart of": "in"
        },
        "18": {
            "represents(?= (?:an?|one of)\\b)": "is"
        }
    },
    "hype": "breathtaking|stunning|iconic|unforgettable|beloved|must-see|must-visit|renowned|groundbreaking|awe-inspiring",
    "human_strip": {
        "28": [
            "(?:it is|it's) (?:important|worth|essential|crucial|vital|also important|also worth) (?:to note|noting|to mention|mentioning|to remember|remembering) that",
            "it should be noted that",
            "needless to say,",
            "as we all know,",
            "as a matter of fact,",
            "it goes without saying that",
            "in today's (?:fast-paced |digital |modern |ever-changing |competitive )*(?:world|age|era|landscape),",
            "in (?:conclusion|summary|closing),",
            "to (?:conclude|summarize|sum up),",
            "all in all,",
            "moreover,",
            "furthermore,",
            "in addition,",
            "notably,",
            "importantly,",
            "interestingly,",
            "indeed,",
            "at its heart,",
            "ultimately,",
            "at the end of the day,",
            "i am writing to inform you that"
        ]
    },
    "human_open": {
        "that being said,": "Still,",
        "having said that,": "Still,",
        "nevertheless,": "Still,",
        "nonetheless,": "Still,",
        "consequently,": "So",
        "therefore,": "So",
        "thus,": "So",
        "as a result,": "So",
        "first and foremost,": "First,"
    },
    "human_swap": {
        "27": {
            "in order to": "to",
            "so as to": "to",
            "due to the fact that": "because",
            "for the reason that": "because",
            "in light of the fact that": "because",
            "in spite of the fact that": "although",
            "regardless of the fact that": "although",
            "at this point in time": "now",
            "at the present time": "now",
            "in the event that": "if",
            "until such time as": "until",
            "with (?:regard|respect) to": "about",
            "with the exception of": "except",
            "for the purpose of": "for",
            "by means of": "by",
            "prior to": "before",
            "subsequent to": "after",
            "in close proximity to": "near",
            "in the near future": "soon",
            "on a daily basis": "every day",
            "on a weekly basis": "every week",
            "on a regular basis": "regularly",
            "a (?:large number|wide range|wide variety|wide array|multitude|plethora|myriad) of": "many",
            "the (?:vast )?majority of": "most",
            "a significant amount of": "a lot of",
            "numerous": "many",
            "individuals": "people",
            "approximately(?= \\d)": "about",
            "subsequently": "later",
            "(?\u003C!will )(?\u003C!would )(?\u003C!may )(?\u003C!might )(?\u003C!must )(?\u003C!should )(?\u003C!could )(?\u003C!can )(?\u003C!to )(?:has|have) the ability to": "can",
            "(?:is|are) able to": "can",
            "(?:is|are) (?:not able|unable) to": "cannot",
            "(?:allows|enables|empowers) (users|people|teams|you|us|them|developers|customers|businesses|companies|students|employees|readers|visitors|writers|everyone|anyone|organizations|teachers|patients|workers) to": "lets $1",
            "(?:allow|enable|empower) (users|people|teams|you|us|them|developers|customers|businesses|companies|students|employees|readers|visitors|writers|everyone|anyone|organizations|teachers|patients|workers) to": "let $1",
            "utilize": "use",
            "utilizes": "uses",
            "utilized": "used",
            "utilizing": "using",
            "the utilization of": "using",
            "leverage(?= (?:the|a|an|our|their|your|its|this|these)\\b)": "use",
            "leverages(?= (?:the|a|an|our|their|your|its|this|these)\\b)": "uses",
            "leveraging": "using",
            "commence": "start",
            "commences": "starts",
            "commenced": "started",
            "endeavor to": "try to",
            "ascertain": "find out",
            "demonstrates": "shows",
            "demonstrated": "showed",
            "demonstrate": "show",
            "facilitates": "supports",
            "facilitate": "support",
            "facilitated": "supported",
            "assists": "helps",
            "assisted": "helped",
            "assist": "help",
            "assistance": "help",
            "ensures that": "makes sure",
            "ensure that": "make sure",
            "ensuring that": "making sure",
            "seamlessly": "smoothly",
            "seamless": "smooth",
            "effortlessly": "easily",
            "comprehensive(?= (?:guide|list|overview|review|report|plan|set|range|analysis)\\b)": "full",
            "(is|are) paramount": "$1 very important",
            "streamlines": "simplifies",
            "streamlined": "simplified",
            "streamlining": "simplifying",
            "streamline": "simplify",
            "fosters(?= (?:better|more|strong|trust|growth|innovation|creativity|collaboration|a culture|a sense)\\b)": "encourages",
            "foster(?= (?:better|more|strong|trust|growth|innovation|creativity|collaboration|a culture|a sense)\\b)": "encourage",
            "cutting-edge": "modern",
            "state-of-the-art": "modern",
            "the optimal": "the best",
            "each and every": "every",
            "end result": "result",
            "future plans": "plans",
            "past history": "history",
            "basic fundamentals": "basics",
            "completely eliminate": "eliminate",
            "makes a decision": "decides",
            "made a decision": "decided",
            "make a decision": "decide",
            "conducted an analysis of": "analyzed",
            "conduct an analysis of": "analyze",
            "provides an explanation of": "explains",
            "provide an explanation of": "explain",
            "takes into consideration": "considers",
            "take into consideration": "consider",
            "is indicative of": "shows",
            "came to the conclusion that": "concluded that",
            "at your earliest convenience": "when you can",
            "please (?:do not|don't) hesitate to (?:reach out|contact (?:me|us)|get in touch)": "please get in touch",
            "should you have any": "if you have any",
            "i would (?:greatly |really )?appreciate it if you could": "please",
            "i am writing to follow up on": "i'm following up on",
            "regarding": "about"
        }
    },
    "vague": [
        "many (?:people|experts|companies|businesses|users|studies|organizations)",
        "in recent years",
        "countless",
        "various (?:ways|reasons|factors|benefits|industries|aspects)",
        "(?:a )?significant(?:ly)? (?:increase|increased|improvement|improved|impact|reduction|reduced|growth|change|changed)",
        "a lot of (?:people|time|money)",
        "studies (?:show|suggest|have shown)",
        "research (?:shows|suggests)",
        "better results",
        "a better experience",
        "higher productivity"
    ],
    "tips": {
        "vague": "Add a number, name, date or example you know.",
        "long": "Read it aloud. If you run out of breath, split it.",
        "even": "These sentences are about the same length. Shorten one or join two.",
        "detail": "The text has no number, name or date. Add one true detail only you would know.",
        "self": "The text never says \"I\" or \"we\". Add what you did, saw or think."
    },
    "prompt": "Also write naturally: vary sentence length, use contractions where the kind of text allows, prefer short everyday words, use active voice, and start with the point. Keep every fact. Do not invent facts, experiences or quotations, and do not add mistakes on purpose. If a detail would help and you do not have it, ask me for it.",
    "hyphens": "high-quality|well-known|well-documented|long-term|real-time",
    "flag": {
        "1": [
            "(?:is|are|was|were)(?:n't| not) [^.;,!?\\n]{2,60}[,;.] (?:it|they|this|that)(?:'s|'re| is| are| was| were)",
            "(?\u003C=\\w)'s not [^.;,!?\\n]{2,60}[,;.] (?:it|they|this|that)(?:'s|'re| is| are| was| were)",
            "does(?:n't| not) mean [^.!?\\n]{2,100}[.;] it means",
            "not (?:just|only|merely|simply) [^.;!?\\n]{2,80}?,? but",
            ", no (?:guessing|fuss|hassle|surprises|exceptions)(?=[.!])",
            "(?:don't|doesn't|didn't) [^.;,!?\\n]{2,50}, they"
        ],
        "2": [
            "(?:this|that) (?:shows|highlights|demonstrates) the importance of",
            "the message was clear",
            "it was a lesson in",
            "(?:overall|ultimately)(?=,)",
            "\\w+\\. (?:single|damn)\\. \\w+\\."
        ],
        "3": [
            "the real question is",
            "what (?:really|truly) (?:matters|makes)",
            "the deeper issue",
            "the heart of the matter",
            "at its core",
            "the (?:language|currency|architecture) of (?:trust|power|success|change)",
            "becomes a trap",
            "at its heart",
            "nothing would ever be the same",
            "everything was about to change"
        ],
        "4": [
            "let's (?:dive|take a look|look at|explore)[^.!?\\n]{0,60}",
            "the (?:hard|slow|new|best|tricky) part is",
            "the part (?:that|worth)",
            "let me tell you",
            "i'm (?:thrilled|excited|delighted|proud) to (?:announce|share)",
            "here's (?:why|how)(?=[:.])",
            "here's what changed[^.!?\\n]{0,30}",
            "here's the truth"
        ],
        "5": [
            "this isn't (?:mainly |really )?about",
            "i'm not (?:saying|arguing)",
            "to be clear",
            "this is not to say",
            "some might say",
            "an? (?:tempting|obvious) approach would be",
            "one might be tempted",
            "you might think",
            "it would be easy to just"
        ],
        "11": [
            "no [a-z]+(?: [a-z]+)? (?:needed|required)(?=[.!])"
        ],
        "12": [
            "aligns? with",
            "aligned with",
            "interplay",
            "tapestry",
            "testament",
            "(?:evolving|digital|cultural|culinary|competitive|current|business|political|media) landscape",
            "robust",
            "valuable",
            "quietly",
            "actually",
            "key (?:point|role|factor|aspect|part|element|component|insight|takeaway|driver|feature)s?",
            "highlight(?:s|ed|ing)? (?:the|how|that)",
            "gat(?:ed|ing) behind",
            "underscor(?:e|es|ed|ing)",
            "showcases?",
            "pivotal",
            "crucial",
            "delv(?:e|es|ed|ing)"
        ],
        "13": [
            "(?:pivotal|crucial|defining) moment",
            "turning point",
            "setting the stage for",
            "indelible mark",
            "lasting legacy",
            "reflects? a broader",
            "despite (?:these|its|the) challenges",
            "continues to thrive",
            "step in the right direction",
            "pav(?:e|es|ed|ing) the way for",
            "one of the most (?:pressing|important|significant)",
            "for generations to come",
            "greener tomorrow",
            "bygone era",
            "in that moment"
        ],
        "14": [
            "associated with the",
            "in association with",
            "in connection with"
        ],
        "15": [
            ", (?:highlighting|underscoring|emphasi[sz]ing|ensuring|reflecting|symboli[sz]ing|contributing to|cultivating|fostering|encompassing|showing|showcasing)[^.;!?\\n]{0,80}"
        ],
        "16": [
            "breathtaking",
            "stunning",
            "groundbreaking",
            "renowned",
            "must-visit",
            "must-see",
            "iconic",
            "hidden gems?",
            "unforgettable",
            "capture the magic",
            "simply divine",
            "savor every moment",
            "would be complete without",
            "stole my heart",
            "truly special",
            "natural beauty",
            "in the heart of",
            "rich (?:cultural|history|heritage|tradition|tapestry)",
            "profound(?:ly)?",
            "exemplifies",
            "commitment to (?:excellence|quality|innovation)",
            "unparalleled",
            "the ultimate",
            "elevat(?:e|es|ing) (?:any|your|the)",
            "peace of mind",
            "say goodbye to",
            "look no further",
            "game[- ]chang(?:er|ing)",
            "world-class",
            "best-in-class",
            "innovative",
            "sleek",
            "fascinating",
            "you won't regret",
            "designed with [^.,\\n]{2,30} in mind",
            "with every \\w+(?=[.!])"
        ],
        "17": [
            "experts (?:believe|argue|say|agree)",
            "observers (?:have|note|say)",
            "industry reports",
            "some critics",
            "several publications",
            "(?:cited|featured|profiled) in(?-i:(?= (?:the |The )?[A-Z]))",
            "active social media presence"
        ],
        "18": [
            "served as an?",
            "represents an?",
            "marks an?"
        ],
        "23": [
            "as an ai(?: language model)?",
            "based on (?:the )?available information",
            "not (?:\\w+ )?(?:publicly available|widely documented|widely disclosed)",
            "(?:provided|available) sources",
            "keeps? (?:\\w+ )?personal details private",
            "maintains a low profile",
            "likely (?:grew up|studied|began)",
            "it is believed that",
            "specific details [^.!?\\n]{0,50}are (?:limited|not)"
        ],
        "25": [
            "was added to replace",
            "(?:are|is|was|were) (?:drawn|compiled|generated) from",
            "flagged rather than guessed",
            "(?:the )?(?:table|figures?|section) below (?:compares|shows|are|is)",
            "this (?:section|document|article) (?:is organi[sz]ed|will|explores|covers)"
        ],
        "22": [
            "drop (?:it|them|your \\w+) in the comments",
            "i hope this (?:email|message|note) finds you well"
        ]
    },
    "human_delete": {
        "28": [
            "i (?:hope|trust) this (?:email|message|note|letter) finds you well"
        ]
    }
};
