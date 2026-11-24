"""Other ways to say stiff things. The model decides which one fits the sentence, or keeps the original.

Each line is "original = choice | choice". Verbs and nouns are given in their base form and inflected here.
A choice must keep the meaning in any context where the original is likely.
"""

VERBS = """
utilize = use
facilitate = help | support
demonstrate = show
implement = set up | carry out
enhance = improve
optimize = improve
commence = start | begin
terminate = end | stop
endeavor = try
ascertain = find out
necessitate = call for
elucidate = explain
underscore = show | stress
showcase = show
foster = encourage | build
bolster = strengthen | support
garner = get | win | earn
elevate = raise | improve
empower = help
embark = start
harness = use
encompass = include | cover
possess = have
require = need
obtain = get
acquire = get | buy
purchase = buy
retain = keep
reside = live
inform = tell
inquire = ask
assist = help
attempt = try
illustrate = show
exhibit = show
highlight = point out
emphasize = stress
ensure = make sure
mitigate = reduce | lessen | limit
alleviate = ease | relieve
exacerbate = worsen
accelerate = speed up
expedite = speed up
diminish = reduce | shrink
augment = increase
cultivate = build | grow
navigate = get through | deal with
transform = change
revolutionize = change
streamline = simplify
incorporate = include | add
collaborate = work together
participate = take part
analyze = study | look at
examine = look at
investigate = look into
determine = find out | decide
establish = set up
construct = build
modify = change
alter = change
select = choose | pick
allocate = set aside
utilise = use
anticipate = expect
encounter = run into
strive = try
aspire = hope | want
leverage = use
delve = look | dig
boast = have
resonate = connect
surpass = beat
provide = give | offer
receive = get
remain = stay
depict = show
convey = express | get across
articulate = explain | say
accomplish = do | finish
achieve = reach
attain = reach
maximize = make the most of
minimize = cut | reduce
eliminate = get rid of | remove
initiate = start | begin
proceed = go on | go ahead
relocate = move
respond = reply
discover = find
"""

# A verb is left alone before these words, where the swap would break the sentence.
NOT_BEFORE = {
    'respond': {'that'}, 'require': {'that'}, 'remain': {'in', 'the', 'a', 'an', 'one', 'to', 'of'}, 'conclude': {'that'},
    'proceed': {'with', 'to'}, 'establish': {'that'}, 'collaborate': {'to', 'with'}, 'provide': {'for', 'that', 'with'},
    'boast': {'about', 'of', 'that'}, 'transform': {'into'}, 'alter': {'ego'}, 'receive': {'from'}, 'participate': {'that'}, 'achieve': {'', 'when', 'in', 'by', 'for', 'and', 'if', 'is'},
    'foster': {'care', 'home', 'parents', 'child', 'children', 'family', 'mother', 'parent'},
}
# A verb that fits only before these words.
ONLY_BEFORE = {
    'ensure': {'that', 'you', 'we', 'they', 'it', 'he', 'she', 'everyone', 'everything', 'nothing'},
    'ascertain': {'whether', 'if', 'what', 'how', 'why', 'that'}, 'embark': {'on', 'upon'}, 'delve': {'into', 'deeper'}, 'resonate': {'with'},
    'determine': {'what', 'whether', 'how', 'if', 'why', 'which', 'who', 'where', 'when'}, 'strive': {'to', 'for'}, 'aspire': {'to'},
    'endeavor': {'to'}, 'attempt': {'to'}, 'inquire': {'about', 'whether', 'if'},
}
# These are also nouns, so they count as verbs only after a word like "to" or "we".
ALSO_NOUNS = {
    'leverage', 'attempt', 'highlight', 'exhibit', 'foster', 'purchase', 'showcase', 'harness', 'boast', 'attempts', 'highlights', 'exhibits',
    'purchases', 'endeavor', 'endeavors', 'showcases', 'boasts',
}

NOUNS = """
individual = person
challenge = problem | issue
utilization = use
methodology = method
component = part
objective = goal | aim
requirement = need
assistance = help
opportunity = chance
commencement = start
residence = home
endeavor = effort
realm = area | field | world
paradigm = model | idea
tapestry = mix
cornerstone = basis | core
enhancement = improvement
modification = change
occupation = job
remuneration = pay
inception = start
implication = effect
ramification = result | effect
discrepancy = difference | gap
facet = side | part
aspect = part | side
"""

WORDS = """
subsequently = later | then
primarily = mainly | mostly
predominantly = mainly | mostly
approximately = about | around
sufficient = enough
insufficient = not enough
numerous = many
various = different
substantial = big | large
substantially = greatly
significant = big | major
significantly = greatly
considerably = greatly | much
crucial = important
pivotal = important
paramount = very important
comprehensive = complete | thorough
robust = strong | solid
intricate = complex | complicated
multifaceted = complex
nuanced = subtle
seamless = smooth | easy
seamlessly = smoothly | easily
meticulous = careful
meticulously = carefully
vibrant = lively
bustling = busy
profound = deep
profoundly = deeply
innovative = new
cutting-edge = new | modern | latest
state-of-the-art = modern | new | latest
groundbreaking = new
remarkable = great | impressive
remarkably = very | really
exceptional = great | excellent
exceptionally = very | really
incredibly = very | really
extremely = very | really
highly = very
particularly = especially
firstly = first
secondly = second
thirdly = third
lastly = last
annually = every year | a year
iconic = famous
imperative = important
frequently = often
occasionally = sometimes
currently = now | right now
ultimately = in the end
initially = at first
rapidly = quickly | fast
promptly = quickly
immediately = right away
beneficial = helpful | useful | good
advantageous = helpful | good
detrimental = harmful | bad
optimal = best
diverse = varied | mixed
evolving = changing
ever-evolving = changing
regarding = about
amidst = among | during
amongst = among
whilst = while
upon = on
albeit = though
entire = whole
evident = clear
challenging = hard | difficult | tough
additional = more | extra
myriad = many | countless
"""

PHRASES = """
many data = a lot of data
many information = a lot of information
many research = a lot of research
many equipment = a lot of equipment
many evidence = a lot of evidence
many knowledge = a lot of knowledge
many feedback = a lot of feedback
many content = a lot of content
many work = a lot of work
many time = a lot of time
many money = a lot of money
many traffic = a lot of traffic
many software = a lot of software
many advice = a lot of advice
many progress = a lot of progress
many support = a lot of support
many energy = a lot of energy
in order to = to
has later = has since
have later = have since
has subsequently = has since
have subsequently = have since
collaborate with = work with
collaborates with = works with
collaborated with = worked with
collaborating with = working with
working together with = working with
a minimum of = at least
it is imperative that = it is important that
it's imperative that = it's important that
it is advisable to = it's best to | it's a good idea to
it's advisable to = it's best to | it's a good idea to
opt for = choose | go for | pick
opting for = choosing | going for
opted for = chose | went for
is associated with = is linked to
are associated with = are linked to
been associated with = been linked to
increased levels of = more
high levels of = a lot of
the way in which = the way | how
the ways in which = the ways | how
the manner in which = the way | how
the extent to which = how much | how far
across the globe = around the world
around the globe = around the world
across the world = around the world
all over the globe = all over the world
excessive use of = too much
can have harmful effects on = can harm | can hurt
can have detrimental effects on = can harm | can hurt
can have negative effects on = can harm | can hurt
can have a negative impact on = can harm | can hurt
can have a positive impact on = can help | can be good for
have a negative impact on = hurt | harm
has a negative impact on = hurts | harms
have a positive impact on = help | are good for
has a positive impact on = helps | is good for
establish healthy boundaries = set healthy boundaries
establish clear goals = set clear goals
take immediate action = act now | act at once
take proactive steps = act early
take a moment to = take a minute to
to express my sincere gratitude for = to thank you for
to express my gratitude for = to thank you for
to extend my gratitude for = to thank you for
express my sincere gratitude for = thank you for
will be providing you with = will send you | will give you
be providing you with = be sending you | be giving you
provide you with = give you | send you
provides you with = gives you
provided you with = gave you
providing you with = giving you
provide us with = give us
provides us with = gives us
provide them with = give them
provides them with = gives them
further information = more information
additional information = more information
further details = more details
do not hesitate to contact me = feel free to contact me | just get in touch
do not hesitate to contact us = feel free to contact us | just get in touch
do not hesitate to reach out = feel free to get in touch
do not hesitate to = feel free to
don't hesitate to = feel free to
has become more important than ever = matters more than ever
is more important than ever = matters more than ever
mastering the art of = getting good at | learning
master the art of = get good at | learn
several key factors = a few things | several things
a few key factors = a few things
key factors to consider = things to think about
factors to consider = things to think about
is an important consideration for = matters to | matters for
is a key consideration for = matters to | matters for
helps decide the = has a lot to do with the
an integral part of = a big part of
a key component of = a big part of
an essential part of = a big part of
a fundamental part of = a big part of
an important part of = a big part of
a valuable tool for = a good tool for
a powerful tool for = a good tool for
the skills necessary to = the skills to
the knowledge and skills necessary to = the knowledge and skills to
necessary in order to = needed to
tailored to meet the unique needs of = made for | built for
tailored to meet the needs of = made for | built for
tailored to the needs of = made for | built for
to meet the unique needs of = to suit
meet the unique needs of = suit
meet the needs of = suit | work for
exceed expectations = do better than people expect
in a timely manner = on time | quickly
in an efficient manner = efficiently
in an effective manner = well
in a safe manner = safely
in a responsible manner = responsibly
in a mindful manner = mindfully | with care
in a professional manner = professionally
in a manner that = in a way that
in such a manner that = so that
in such a way that = so that
ascend to the = go up to the | climb to the
ascend the = climb the
descend to the = go down to the
experience breathtaking views = see great views
experience stunning views = see great views
experience great views = see great views
experience beautiful views = see beautiful views
offers stunning views of = has great views of
offers breathtaking views of = has great views of
offers beautiful views of = has great views of
was met with = got
were met with = got
initially met with = first met with
was at first met with = at first got
on a deeper level = more deeply
on a personal level = personally
on a global scale = around the world
at an early stage = early
at an early age = young | early on
in this day and age = now | these days
in the modern world = today | these days
in the modern era = today | now
in modern society = today | these days
in our daily lives = every day | in daily life
in everyday life = every day | in daily life
in the long run = over time | in the end
in the long term = over time | in the end
in light of = because of | given
in accordance with = by | under | following
in conjunction with = with | along with
in relation to = about
in the absence of = without
in the presence of = with
in the field of = in
in the realm of = in
in the area of = in
in favor of = for
in an effort to = to
in an attempt to = to
with an emphasis on = stressing
it is essential to = you need to | it's important to
it is crucial to = it's important to
it is vital to = it's important to
it's crucial to = it's important to
it's vital to = it's important to
it is worth noting that = note that
it is worth mentioning that = also ,
it goes without saying that = of course
it is widely believed that = many people think
it is believed that = people think
there are numerous = there are many
there are various = there are many | there are different
there is a need for = we need
there is a growing need for = more and more we need
a growing number of = more and more
an increasing number of = more and more
an ever-increasing number of = more and more
a large number of = many | a lot of
large amounts of = a lot of
vast amounts of = huge amounts of | a lot of
a wealth of = a lot of | plenty of
an abundance of = plenty of | a lot of
a vast array of = many | all kinds of
an array of = many | all kinds of
a range of = many | several
a host of = many | a lot of
a sense of = a feeling of
gain insight into = learn about
gain insights into = learn about
gain valuable insights into = learn a lot about
provides insight into = tells us about
provide insight into = tell us about
provides valuable insights into = tells us a lot about
provide valuable insights into = tell us a lot about
offers valuable insights into = tells us a lot about
takes place = happens
took place = happened
take place = happen
give rise to = cause | lead to
gives rise to = causes | leads to
result in = lead to | cause
results in = leads to | causes
resulted in = led to | caused
resulting in = leading to | causing
contribute to = add to
contributes to = adds to
contributed to = added to
contributing to = adding to
consists of = is made up of
comprised of = made up of
is comprised of = is made up of
is composed of = is made up of
is characterized by = has
are characterized by = have
is considered to be = is seen as
are considered to be = are seen as
is regarded as = is seen as
are regarded as = are seen as
tend to be = are often
tends to be = is often
refers to = means
refer to = mean
in essence , = basically ,
essentially , = basically ,
in other words , = that is ,
generally speaking , = in general ,
more specifically , = specifically ,
by contrast , = but
conversely , = but
in comparison , = but
similarly , = in the same way ,
likewise , = in the same way ,
in particular , = especially ,
undoubtedly , = no doubt ,
ultimately , = in the end ,
as a whole , = overall ,
as we move forward , = from here on ,
moving forward , = from now on ,
going forward , = from now on ,
to this end , = so
to that end , = so
in this regard , = here ,
in this way , = this way ,
by doing so , = that way ,
in doing so , = that way ,
last but not least , = finally ,
first and foremost , = first ,
with this in mind , = so
given that = since | because
considering that = since | because
provided that = if | as long as
in case of = if there is
such that = so that
so that it can = so it can
not only that , = also ,
whereas = while | but
hence , = so
accordingly , = so
so as to = to
due to the fact that = because | since
in spite of = despite
in the event that = if
with regard to = about
with respect to = about
in regard to = about
in addition to = besides
in addition , = also ,
as well as = and
a number of = several | some
a wide range of = many | all sorts of | all kinds of
a wide variety of = many | all sorts of | all kinds of
a variety of = many different | all sorts of
a multitude of = many | a lot of
a plethora of = many | a lot of | plenty of
a myriad of = many | a lot of | countless
a significant number of = many | a lot of
a significant amount of = a lot of
a great deal of = a lot of
the majority of = most
the vast majority of = most
at this point in time = now
at the present time = now
in the near future = soon
for the purpose of = for
on a regular basis = regularly | often
on a daily basis = every day
prior to = before
subsequent to = after
as a result of = because of
as a result , = so
for this reason , = so
it is clear that = clearly ,
it is evident that = clearly ,
is able to = can
are able to = can
am able to = can
was able to = could
were able to = could
has the ability to = can
have the ability to = can
has the potential to = could | may
have the potential to = could | may
is crucial for = matters for | is important for
plays a crucial role in = matters a lot in | is a big part of
plays a vital role in = matters a lot in | is a big part of
plays a key role in = is a big part of
plays an important role in = is a big part of | matters a lot in
play a crucial role in = matter a lot in | are a big part of
play a vital role in = matter a lot in | are a big part of
play a key role in = are a big part of
play an important role in = are a big part of | matter a lot in
serves as = is | works as
serve as = are | work as
served as = was | worked as
make use of = use
makes use of = uses
make a decision = decide
made a decision = decided
in close proximity to = near | close to
in today's world = today | these days
in today's society = today | these days
over the course of = during | over
throughout the course of = during
on the other hand , = then again ,
in contrast , = but
for instance , = for example ,
in conclusion , = all in all ,
in summary , = in short ,
to summarize , = in short ,
first and foremost = first
whether or not = whether | if
until such time as = until
despite the fact that = although | even though
as to whether = whether
a testament to = a sign of | proof of
pave the way for = open the way for | lead to
paves the way for = opens the way for | leads to
shed light on = explain | help explain
sheds light on = explains | helps explain
gain a better understanding of = understand | learn more about
gain a deeper understanding of = understand | learn more about
have an impact on = affect | change
has an impact on = affects | changes
has a significant impact on = affects | changes a lot about
have a significant impact on = affect | change a lot about
had a significant impact on = affected | changed a lot about
it should be noted that = note that
there is no doubt that = no doubt ,
of the utmost importance = very important
through the use of = by using
by means of = by | with
with the help of = with help from
continues to be = is still
continue to be = are still
remains a = is still a
remains an = is still an
has become increasingly = is getting more
have become increasingly = are getting more
additionally , = also ,
furthermore , = also ,
moreover , = also ,
consequently , = so
therefore , = so
thus , = so
nevertheless , = still , | even so ,
nonetheless , = still , | even so ,
overall , = all in all ,
subsequently , = after that , | later ,
"""

CONTRACT = """
do not = don't
does not = doesn't
did not = didn't
is not = isn't
are not = aren't
was not = wasn't
were not = weren't
has not = hasn't
have not = haven't
had not = hadn't
cannot = can't
could not = couldn't
would not = wouldn't
should not = shouldn't
will not = won't
it is = it's
that is = that's
there is = there's
what is = what's
he is = he's
she is = she's
i am = i'm
you are = you're
we are = we're
they are = they're
i have = i've
you have = you've
we have = we've
they have = they've
i will = i'll
you will = you'll
we will = we'll
they will = they'll
it will = it'll
i would = i'd
"""

# "the development of" after by, for, in, through or with becomes "developing".
DOING = {
    'development': 'developing', 'implementation': 'putting in place', 'creation': 'creating', 'use': 'using', 'utilization': 'using', 'improvement': 'improving',
    'reduction': 'reducing', 'management': 'managing', 'adoption': 'adopting', 'integration': 'combining', 'protection': 'protecting', 'expansion': 'expanding',
    'introduction': 'introducing', 'production': 'producing', 'removal': 'removing', 'construction': 'building', 'delivery': 'delivering', 'collection': 'collecting',
    'selection': 'choosing', 'optimization': 'improving', 'exploration': 'exploring', 'analysis': 'studying', 'preservation': 'preserving', 'elimination': 'removing',
}

IRREGULAR = {
    'get': ('gets', 'got', 'got', 'getting'), 'make': ('makes', 'made', 'made', 'making'), 'show': ('shows', 'showed', 'shown', 'showing'),
    'find': ('finds', 'found', 'found', 'finding'), 'give': ('gives', 'gave', 'given', 'giving'), 'keep': ('keeps', 'kept', 'kept', 'keeping'),
    'put': ('puts', 'put', 'put', 'putting'), 'set': ('sets', 'set', 'set', 'setting'), 'begin': ('begins', 'began', 'begun', 'beginning'),
    'build': ('builds', 'built', 'built', 'building'), 'win': ('wins', 'won', 'won', 'winning'), 'have': ('has', 'had', 'had', 'having'),
    'buy': ('buys', 'bought', 'bought', 'buying'), 'tell': ('tells', 'told', 'told', 'telling'), 'see': ('sees', 'saw', 'seen', 'seeing'),
    'speed': ('speeds', 'sped', 'sped', 'speeding'), 'shrink': ('shrinks', 'shrank', 'shrunk', 'shrinking'), 'grow': ('grows', 'grew', 'grown', 'growing'),
    'deal': ('deals', 'dealt', 'dealt', 'dealing'), 'take': ('takes', 'took', 'taken', 'taking'), 'choose': ('chooses', 'chose', 'chosen', 'choosing'),
    'run': ('runs', 'ran', 'run', 'running'), 'meet': ('meets', 'met', 'met', 'meeting'), 'feel': ('feels', 'felt', 'felt', 'feeling'),
    'dig': ('digs', 'dug', 'dug', 'digging'), 'do': ('does', 'did', 'done', 'doing'), 'beat': ('beats', 'beat', 'beaten', 'beating'),
    'let': ('lets', 'let', 'let', 'letting'), 'say': ('says', 'said', 'said', 'saying'), 'cut': ('cuts', 'cut', 'cut', 'cutting'),
    'go': ('goes', 'went', 'gone', 'going'), 'stop': ('stops', 'stopped', 'stopped', 'stopping'), 'stay': ('stays', 'stayed', 'stayed', 'staying'),
    'try': ('tries', 'tried', 'tried', 'trying'), 'carry': ('carries', 'carried', 'carried', 'carrying'), 'reply': ('replies', 'replied', 'replied', 'replying'),
    'study': ('studies', 'studied', 'studied', 'studying'), 'buy in': ('buys in', 'bought in', 'bought in', 'buying in'),
    'permit': ('permits', 'permitted', 'permitted', 'permitting'), 'limit': ('limits', 'limited', 'limited', 'limiting'), 'occur': ('occurs', 'occurred', 'occurred', 'occurring'),
    'answer': ('answers', 'answered', 'answered', 'answering'), 'offer': ('offers', 'offered', 'offered', 'offering'), 'alter': ('alters', 'altered', 'altered', 'altering'),
    'shrug': ('shrugs', 'shrugged', 'shrugged', 'shrugging'), 'reach': ('reaches', 'reached', 'reached', 'reaching'), 'worsen': ('worsens', 'worsened', 'worsened', 'worsening'),
    'discover': ('discovers', 'discovered', 'discovered', 'discovering'), 'conquer': ('conquers', 'conquered', 'conquered', 'conquering'),
}


def forms(verb):
    """base, third person, past, past participle, -ing. Only the first word of a phrase changes."""
    head, _, rest = verb.partition(' ')
    tail = f' {rest}' if rest else ''
    if head in IRREGULAR:
        third, past, part, ing = IRREGULAR[head]
    else:
        soft = head[-1] == 'y' and head[-2] not in 'aeiou'
        third = head[:-1] + 'ies' if soft else head + ('es' if head.endswith(('s', 'x', 'z', 'ch', 'sh')) else 's')
        past = head[:-1] + 'ied' if soft else head + ('d' if head.endswith('e') else 'ed')
        part = past
        ing = (head[:-1] if head.endswith('e') and not head.endswith('ee') else head) + 'ing'
    return [f + tail for f in (head, third, past, part, ing)]


def plural(noun):
    if noun == 'person':
        return 'people'
    if noun in ('help', 'pay', 'teamwork', 'use', 'basis'):
        return None
    if noun[-1] == 'y' and noun[-2] not in 'aeiou':
        return noun[:-1] + 'ies'
    return noun + ('es' if noun.endswith(('s', 'x', 'ch', 'sh')) else 's')


def lines(block):
    for line in block.strip().splitlines():
        left, right = line.split(' = ')
        yield left.strip(), [r.strip() for r in right.split(' | ')]


# Sentence turns: [pattern, replacement]. Quantifiers are bounded, so no input is slow.
WHO = r'(?:people|users|us|you|them|students|readers|customers|companies|businesses|teams|individuals|workers|employees|patients|everyone|others|developers|visitors)'
ADVERB = {'efficient': 'efficiently', 'effective': 'well', 'responsible': 'responsibly', 'safe': 'safely', 'clear': 'clearly', 'careful': 'carefully', 'simple': 'simply'}
FORMS = {'showed': 'shown', 'began': 'begun', 'gave': 'given', 'chose': 'chosen', 'grew': 'grown', 'took': 'taken', 'wrote': 'written'}
TURNS = [
    (r'\b(have|has|had|been|was|were|is|are|be) ((?:already|also|often|been|never|always) )?(showed|began|gave|chose|grew|took|wrote)\b', lambda m: f'{m[1]} {m[2] or ""}{FORMS[m[3].lower()]}'),
    (rf', thereby (?:allowing|enabling|helping) ({WHO}) to ', r', so \1 can '),
    (r', thereby (?=[a-z]+ing )', ', '),
    (r'\bin an? ([a-z]{3,20}) (?:manner|fashion)\b', lambda m: ADVERB.get(m[1]) or f'in {"an" if m[1][0] in "aeiou" else "a"} {m[1]} way'),
    (rf'\b(?:assist|help) ({WHO}) in achieving ', r'help \1 reach '),
    (rf'\b(?:assist|help) ({WHO}) in (?:getting|reaching) (?=(?:your|their|our|his|her) )', r'help \1 reach '),
    (rf'\b(?:assist|help) ({WHO}) in (mak|improv|manag|creat|reduc|us)ing ', r'help \1 \2e '),
    (rf'\b(?:assist|help) ({WHO}) in (find|build|learn|understand|plan|develop|grow)ing ', r'help \1 \2 '),
    (rf'\bhas (?:enabled|allowed) ({WHO}) to ', r'has let \1 '),
    (rf'\bhave (?:enabled|allowed) ({WHO}) to ', r'have let \1 '),
    (rf'\b(?:enables|allows|empowers) ({WHO}) to ', r'lets \1 '),
    (rf'\b(?:enable|allow|empower) ({WHO}) to ', r'let \1 '),
    (rf'\b(?:enabling|allowing|empowering) ({WHO}) to ', r'letting \1 '),
    (rf'\bprovides ({WHO}) with ', r'gives \1 '),
    (rf'\bprovide ({WHO}) with ', r'give \1 '),
    (rf'\bproviding ({WHO}) with ', r'giving \1 '),
    (rf'\bmakes it (?:possible|easier) for ({WHO}) to (?=[a-z])', r'helps \1 '),
    (r'\b(is|are|was|were) (?:being )?utilized (?=(?:to|for|in|by)\b)', r'\1 used '),
    (r'\bthe (?:importance|significance) of ([a-z]{4,20}) cannot be overstated', r'\1 matters a lot'),
    (r'\bplays? an? (?:crucial|vital|key|pivotal|significant|important|essential) role in (?:shap|determin)ing ', 'helps shape '),
    (r'\b(can|could|may|might|will) be attributed to ', r'\1 come from '),
    (r'\b(can|could|may|might) lead to an? (increase|decrease|reduction) in ', lambda m: f'{m[1]} {"raise" if m[2] == "increase" else "cut"} '),
    (r'\bshould you (have any|need any|wish|need)\b', r'if you \1'),
    (r'\bI (?:wanted|would like|want) to take (?:a moment|a minute|this opportunity) to thank you', 'I want to thank you'),
    (r'\bI (?:wanted|would like|want) to take (?:a moment|a minute|this opportunity) to (?:express|extend) my (?:sincere |deepest |heartfelt )?(?:gratitude|thanks|appreciation) for ', 'Thank you for '),
    (r'\bI am writing to (?:inform|let) you (?:know )?that ', 'I wanted to let you know that '),
    (r'\bI am writing to express my interest in ', 'I am interested in '),
    (r'\bI (?:look|am looking) forward to hearing from you (?:at your earliest convenience|soon)\b', 'I hope to hear from you soon'),
    (r'\bat your earliest convenience\b', 'when you can'),
    (r'\ba (?:significant|considerable|substantial) (?:increase|rise) in\b', 'a big rise in'),
    (r'\ba (?:significant|considerable|substantial) (?:decrease|reduction|decline|drop) in\b', 'a big drop in'),
    (r'\bhas (?:emerged as|become) an? (?:essential|crucial|vital|indispensable|integral) part of\b', 'is now a big part of'),
    (r'\b(is|are) (?:widely|commonly|generally) (?:used|utilized)\b', r'\1 often used'),
    (r'\bhas been a (?:significant|major|crucial) factor in\b', 'has had a lot to do with'),
]


def build():
    """{tokens: {choices, kind, not_before, only_before}} with every inflection."""
    table = {}

    def add(source, choices, kind, not_before=frozenset(), only_before=frozenset(), parts=()):
        key = tuple(source.split())
        choices = [tuple(c.split()) for c in choices if c and tuple(c.split()) != key]
        if not choices:
            return
        if parts:
            choices = []
            for past, participle in parts:
                choices += [(tuple(past.split()), None)] if past == participle else [(tuple(past.split()), False), (tuple(participle.split()), True)]
        old = table.setdefault(key, {'choices': [], 'kind': kind, 'not_before': not_before, 'only_before': only_before})
        old['choices'] += [c for c in choices if c not in old['choices']]

    for verb, choices in lines(VERBS):
        mine, theirs = forms(verb), [forms(c) for c in choices]
        near = NOT_BEFORE.get(verb, frozenset()), ONLY_BEFORE.get(verb, frozenset())
        add(mine[0], [t[0] for t in theirs], 'verb', *near)
        add(mine[1], [t[1] for t in theirs], 'verb', *near)
        # One form can be past or participle; the sentence decides.
        add(mine[2], [t[2] for t in theirs], 'past', *near, parts=[(t[2], t[3]) for t in theirs])
        add(mine[4], [t[4] for t in theirs], 'verb', *near)
    for noun, choices in lines(NOUNS):
        add(noun, choices, 'noun')
        if plural(noun):
            add(plural(noun), [plural(c) for c in choices], 'noun')
    for word, choices in lines(WORDS):
        add(word, choices, 'word')
    for phrase, choices in lines(PHRASES):
        add(phrase, choices, 'phrase')
    for long, short in lines(CONTRACT):
        add(long, short, 'contract')
    for prep in ('by', 'for', 'in', 'through', 'with'):
        for noun, doing in DOING.items():
            add(f'{prep} the {noun} of', [f'{"by" if prep in ("through", "with") else prep} {doing}'], 'phrase')
    return table
