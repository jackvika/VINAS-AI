<?php
declare(strict_types=1);

/** Writes plain or Markdown text as an A4 PDF, using the fonts every PDF reader has. */
final class Pdf
{
    private const WIDTH = 595.28;
    private const HEIGHT = 841.89;
    private const MARGIN = 62.0;
    private const BOTTOM = 68.0;

    // Helvetica widths for WinAnsi 32-255, in thousandths of the font size.
    private const WIDTHS = [
        278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
        556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
        1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
        667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
        333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
        556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 350,
        556, 350, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350,
        350, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 350, 500, 667,
        278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
        400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
        667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
        722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
        556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
        556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
    ];

    private array $pages = [];
    private float $y = 0.0;

    /** Built-in fonts cover Western European text only. */
    public static function supports(string $text): bool
    {
        return @iconv('UTF-8', 'CP1252', self::clean($text)) !== false;
    }

    public static function render(string $text, string $title): string
    {
        $encoded = iconv('UTF-8', 'CP1252', self::clean($text));
        if ($encoded === false) {
            throw new RuntimeException('Text has characters the PDF fonts do not cover.');
        }
        $pdf = new self();
        $pdf->newPage();
        $pdf->write($encoded);
        return $pdf->build($title);
    }

    private static function clean(string $text): string
    {
        $text = str_replace(["\r\n", "\r", "\t"], ["\n", "\n", '    '], $text);
        return preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/', '', $text);
    }

    private function write(string $text): void
    {
        $code = false;
        foreach (explode("\n", $text) as $line) {
            if (strpos($line, '```') === 0) {
                $code = !$code;
                continue;
            }
            if ($code) {
                $this->paragraph($line, 'F3', 9.5);
            } elseif (preg_match('/^(#{1,6}) (.+)$/', $line, $m)) {
                $size = max(12.0, 20.0 - 2.5 * strlen($m[1]));
                // Keep a heading with the line after it.
                if ($this->y - $size * 3.5 < self::BOTTOM) {
                    $this->newPage();
                }
                $this->paragraph($m[2], 'F2', $size);
            } elseif (trim($line) === '') {
                $this->y -= 8.0;
            } else {
                $this->paragraph($line, 'F1', 11.0);
            }
        }
    }

    private function paragraph(string $text, string $font, float $size): void
    {
        $indent = preg_match('/^ *(?:[-*]|\d+\.) /', $text, $m) ? $this->width($m[0], $font, $size) : 0.0;
        foreach ($this->wrap($text, $font, $size, $indent) as $i => $line) {
            if ($this->y - $size * 1.45 < self::BOTTOM) {
                $this->newPage();
            }
            $this->y -= $size * 1.45;
            $this->put($line, self::MARGIN + ($i > 0 ? $indent : 0.0), $this->y, $font, $size);
        }
    }

    private function wrap(string $text, string $font, float $size, float $indent): array
    {
        $max = self::WIDTH - 2 * self::MARGIN;
        $lines = [];
        $line = null;
        foreach (explode(' ', rtrim($text)) as $word) {
            $room = $max - ($lines ? $indent : 0.0);
            $try = $line === null ? $word : "$line $word";
            if ($this->width($try, $font, $size) <= $room) {
                $line = $try;
                continue;
            }
            if ($line !== null && trim($line) !== '') {
                $lines[] = $line;
                $room = $max - $indent;
            }
            // A word longer than the line, such as a URL, breaks where it must.
            while ($this->width($word, $font, $size) > $room) {
                $cut = strlen($word);
                while ($cut > 1 && $this->width(substr($word, 0, $cut), $font, $size) > $room) {
                    $cut--;
                }
                $lines[] = substr($word, 0, $cut);
                $word = substr($word, $cut);
                $room = $max - $indent;
            }
            $line = $word;
        }
        $lines[] = $line ?? '';
        return $lines;
    }

    private function width(string $s, string $font, float $size): float
    {
        if ($font === 'F3') {
            return strlen($s) * 0.6 * $size;
        }
        $total = 0;
        for ($i = 0, $n = strlen($s); $i < $n; $i++) {
            $total += self::WIDTHS[ord($s[$i]) - 32] ?? 556;
        }
        // Bold runs wider than regular.
        return $total / 1000 * $size * ($font === 'F2' ? 1.1 : 1.0);
    }

    private function newPage(): void
    {
        $this->pages[] = '';
        $this->y = self::HEIGHT - self::MARGIN;
    }

    private function put(string $s, float $x, float $y, string $font, float $size): void
    {
        $s = strtr($s, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
        // %F ignores the locale, so a decimal comma cannot break the file.
        $this->pages[count($this->pages) - 1] .= sprintf("BT /%s %.2F Tf %.2F %.2F Td (%s) Tj ET\n", $font, $size, $x, $y, $s);
    }

    private function build(string $title): string
    {
        $total = count($this->pages);
        $font = '<< /Type /Font /Subtype /Type1 /BaseFont /%s /Encoding /WinAnsiEncoding >>';
        $objects = [
            1 => '<< /Type /Catalog /Pages 2 0 R >>',
            3 => sprintf($font, 'Helvetica'),
            4 => sprintf($font, 'Helvetica-Bold'),
            5 => sprintf($font, 'Courier'),
            6 => '<< /Title <FEFF' . strtoupper(bin2hex(mb_convert_encoding($title, 'UTF-16BE', 'UTF-8'))) . '> >>',
        ];
        $kids = [];
        foreach ($this->pages as $i => $content) {
            if ($total > 1) {
                $label = ($i + 1) . ' / ' . $total;
                $content .= sprintf("BT /F1 9 Tf %.2F 36 Td (%s) Tj ET\n", (self::WIDTH - $this->width($label, 'F1', 9.0)) / 2, $label);
            }
            $page = 7 + 2 * $i;
            $kids[] = "$page 0 R";
            $objects[$page] = sprintf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2F %.2F] ', self::WIDTH, self::HEIGHT)
                . '/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ' . ($page + 1) . ' 0 R >>';
            $objects[$page + 1] = '<< /Length ' . strlen($content) . " >>\nstream\n" . $content . 'endstream';
        }
        $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . "] /Count $total >>";
        ksort($objects);

        $out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $xref = "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
        foreach ($objects as $id => $body) {
            $xref .= sprintf("%010d 00000 n \n", strlen($out));
            $out .= "$id 0 obj\n$body\nendobj\n";
        }
        $start = strlen($out);
        return $out . $xref . 'trailer << /Size ' . (count($objects) + 1) . " /Root 1 0 R /Info 6 0 R >>\nstartxref\n$start\n%%EOF\n";
    }
}
