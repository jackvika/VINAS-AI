// Cuts text into the pieces the reader knows, as BERT's uncased tokenizer does.
export class Tokenizer {
    constructor(vocab) {
        this.ids = new Map(vocab.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((w, i) => [w, i]));
        this.unk = this.ids.get('[UNK]');
        this.cls = this.ids.get('[CLS]');
        this.sep = this.ids.get('[SEP]');
        if ([this.unk, this.cls, this.sep].includes(undefined)) throw new Error('not a vocabulary');
        this.known = new Map();
    }

    word(w) {
        if (this.known.has(w)) return this.known.get(w);
        const chars = [...w];
        let out = [];
        if (chars.length > 100) out = [this.unk];
        for (let start = 0; start < chars.length && chars.length <= 100;) {
            let end = chars.length;
            let id;
            for (; end > start; end--) {
                id = this.ids.get((start ? '##' : '') + chars.slice(start, end).join(''));
                if (id !== undefined) break;
            }
            if (id === undefined) {
                out = [this.unk];
                break;
            }
            out.push(id);
            start = end;
        }
        if (this.known.size < 20000) this.known.set(w, out);
        return out;
    }

    encode(text) {
        const clean = text.replace(/[\u0000�]|[^\S\t\n\r ]|\p{Cc}|\p{Cf}/gu, (c) => (/\s/.test(c) ? ' ' : '')).replace(/([㐀-䶿一-鿿豈-﫿])/g, ' $1 ');
        const plain = clean.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
        // Punctuation stands alone: every ASCII sign, and what Unicode calls punctuation.
        return (plain.match(/[!-/:-@[-`{-~]|\p{P}|[^\s!-/:-@[-`{-~\p{P}]+/gu) || []).flatMap((w) => this.word(w));
    }

    /** [CLS] question [SEP] text [SEP], the longer part cut first. */
    pair(question, text, most) {
        let a = this.encode(question);
        let b = this.encode(text);
        let over = a.length + b.length + 3 - most;
        while (over-- > 0) {
            if (a.length > b.length) a = a.slice(0, -1);
            else b = b.slice(0, -1);
        }
        return { ids: [this.cls, ...a, this.sep, ...b, this.sep], types: [...new Array(a.length + 2).fill(0), ...new Array(b.length + 1).fill(1)] };
    }
}
