// Writes plain or Markdown text as an A4 PDF in built-in fonts.
const Pdf = (() => {
    const WIDTH = 595.28;
    const HEIGHT = 841.89;
    const MARGIN = 62;
    const BOTTOM = 68;
    // Windows-1252 characters 0x80 to 0x9F. A space marks an unused code.
    const HIGH = '€ ‚ƒ„…†‡ˆ‰Š‹Œ Ž  ‘’“”•–—˜™š›œ žŸ';

    function encode(text) {
        const clean = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
        let out = '';
        for (const c of clean) {
            const code = c.codePointAt(0);
            const high = c === ' ' ? -1 : HIGH.indexOf(c);
            if (code < 0x80 || (code >= 0xA0 && code <= 0xFF)) out += c;
            else if (high >= 0) out += String.fromCharCode(0x80 + high);
            else return null;
        }
        return out;
    }

    function render(text, title, widths) {
        const pages = [];
        let y = 0;
        const newPage = () => { pages.push(''); y = HEIGHT - MARGIN; };
        const width = (s, font, size) => {
            if (font === 'F3') return s.length * 0.6 * size;
            let total = 0;
            for (let i = 0; i < s.length; i++) total += widths[s.charCodeAt(i) - 32] ?? 556;
            return total / 1000 * size * (font === 'F2' ? 1.1 : 1);
        };
        const put = (s, x, at, font, size) => {
            const safe = s.replace(/[\\()]/g, '\\$&');
            pages[pages.length - 1] += `BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${at.toFixed(2)} Td (${safe}) Tj ET\n`;
        };
        const wrap = (text, font, size, indent) => {
            const max = WIDTH - 2 * MARGIN;
            const lines = [];
            let line = null;
            for (let word of text.replace(/[ \t\n\r\0\x0B]+$/, '').split(' ')) {
                let room = max - (lines.length ? indent : 0);
                const attempt = line === null ? word : `${line} ${word}`;
                if (width(attempt, font, size) <= room) {
                    line = attempt;
                    continue;
                }
                if (line !== null && line.trim() !== '') {
                    lines.push(line);
                    room = max - indent;
                }
                while (width(word, font, size) > room) {
                    let cut = word.length;
                    while (cut > 1 && width(word.slice(0, cut), font, size) > room) cut--;
                    lines.push(word.slice(0, cut));
                    word = word.slice(cut);
                    room = max - indent;
                }
                line = word;
            }
            lines.push(line ?? '');
            return lines;
        };
        const paragraph = (text, font, size) => {
            const m = /^ *(?:[-*]|[0-9]+\.) /.exec(text);
            const indent = m ? width(m[0], font, size) : 0;
            wrap(text, font, size, indent).forEach((line, i) => {
                if (y - size * 1.45 < BOTTOM) newPage();
                y -= size * 1.45;
                put(line, MARGIN + (i > 0 ? indent : 0), y, font, size);
            });
        };

        newPage();
        let code = false;
        for (const line of encode(text).split('\n')) {
            const m = /^(#{1,6}) (.+)$/.exec(line);
            if (line.startsWith('```')) {
                code = !code;
            } else if (code) {
                paragraph(line, 'F3', 9.5);
            } else if (m) {
                const size = Math.max(12, 20 - 2.5 * m[1].length);
                if (y - size * 3.5 < BOTTOM) newPage();
                paragraph(m[2], 'F2', size);
            } else if (line.trim() === '') {
                y -= 8;
            } else {
                paragraph(line, 'F1', 11);
            }
        }

        const font = (name) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
        let hex = '';
        for (let i = 0; i < title.length; i++) hex += title.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
        const objects = [];
        objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objects[3] = font('Helvetica');
        objects[4] = font('Helvetica-Bold');
        objects[5] = font('Courier');
        objects[6] = `<< /Title <FEFF${hex}> >>`;
        const kids = [];
        pages.forEach((content, i) => {
            if (pages.length > 1) {
                const label = `${i + 1} / ${pages.length}`;
                content += `BT /F1 9 Tf ${((WIDTH - width(label, 'F1', 9)) / 2).toFixed(2)} 36 Td (${label}) Tj ET\n`;
            }
            const page = 7 + 2 * i;
            kids.push(`${page} 0 R`);
            objects[page] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH.toFixed(2)} ${HEIGHT.toFixed(2)}] `
                + `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${page + 1} 0 R >>`;
            objects[page + 1] = `<< /Length ${content.length} >>\nstream\n${content}endstream`;
        });
        objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

        let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
        let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
        for (let id = 1; id < objects.length; id++) {
            xref += `${String(out.length).padStart(10, '0')} 00000 n \n`;
            out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
        }
        const start = out.length;
        out += `${xref}trailer << /Size ${objects.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${start}\n%%EOF\n`;
        return Uint8Array.from(out, (c) => c.charCodeAt(0));
    }

    return { supports: (text) => encode(text) !== null, render };
})();
