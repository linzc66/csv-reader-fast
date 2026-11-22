// Fast drop-in replacement for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Returns exactly csv-reader 1.0.0's answer for every input {text, header}:
// {columns, rows, errors}. The reading rules are csv-reader's own (see the
// kit's baselines/csv-reader/vendor/csv-reader/index.js, which this mirrors):
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled,
//     "" inside it one quote and each CRLF or lone CR inside it read as LF; what
//     follows its closing quote, up to the next comma or line break, is appended
//     as it stands (quote_junk, when the field ends); a quote that never closes
//     is a literal character, and the text after it is read again as unquoted
//     (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay
//     strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it (every record when header is false), each padded with ""
//     (short_row, with fields: its count) or cut (long_row, with extra: the cut
//     fields) to the first record's width;
//   - each error is {code, line, row}, in the order met: line the 1-based line
//     its record starts on, row its record's index in rows (null for the header).
//
// Speed: the reference reads one character at a time, appending a character at
// a time. This reads by slices instead: an unquoted field is one slice up to
// the next delimiter (found by a tight charCodeAt scan); a quoted field is one
// slice up to its closing quote, or the segments between doubled quotes and
// line breaks joined (a doubled quote to one quote, each line break inside to
// LF). Only the rare paths — a stray CR, a quote that never closes — do extra
// work, and they follow the reference step for step. Pure: no clock, no
// randomness, no locale, nothing kept from one call to the next.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not followed by LF is dropped
  // (stray_cr). Returns the field and how it ended; `added` counts the characters kept by this call.
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      let p = pos;
      while (p < len) {
        const c = text.charCodeAt(p);
        if (c === 44 || c === 10 || c === 13) break;
        p++;
      }
      if (p >= len) {
        if (pos < len) {
          const seg = text.slice(pos, len);
          value = value === '' && added === 0 ? seg : value + seg;
          added += len - pos;
          pos = len;
        }
        return { value, ended: END, added };
      }
      const c = text.charCodeAt(p);
      if (c === 44) {
        const seg = text.slice(pos, p);
        value = value === '' && added === 0 ? seg : value + seg;
        added += p - pos;
        pos = p + 1;
        return { value, ended: COMMA, added };
      }
      if (c === 10) {
        const seg = text.slice(pos, p);
        value = value === '' && added === 0 ? seg : value + seg;
        added += p - pos;
        pos = p + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // c === 13 (CR): CRLF is a line break, a lone CR is dropped (stray_cr).
      if (text.charCodeAt(p + 1) === 10) {
        const seg = text.slice(pos, p);
        value = value === '' && added === 0 ? seg : value + seg;
        added += p - pos;
        pos = p + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      error('stray_cr');
      const seg = text.slice(pos, p);
      value = value === '' && added === 0 ? seg : value + seg;
      added += p - pos;
      pos = p + 1;
      // The dropped CR adds nothing: keep scanning for the next delimiter.
    }
  }

  // Reads a quoted field whose opening quote is at pos. The value is built
  // from slices: one slice when the field holds no doubled quotes or line
  // breaks, otherwise the segments between them joined (a doubled quote to one
  // quote, each line break inside to LF). The line count is kept locally and
  // only written back when the quote closes: a quote that never closes leaves
  // the line where it was, and the text after it is read again as unquoted.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let p = open + 1;
    let segStart = p;
    let parts = null;
    let qline = openLine;
    while (p < len) {
      const c = text.charCodeAt(p);
      if (c === 34) {
        if (text.charCodeAt(p + 1) === 34) {
          if (parts === null) parts = [];
          parts.push(text.slice(segStart, p), '"');
          p += 2;
          segStart = p;
          continue;
        }
        // Closing quote.
        let value;
        if (parts === null) value = text.slice(segStart, p);
        else {
          parts.push(text.slice(segStart, p));
          value = parts.join('');
        }
        line = qline;
        pos = p + 1;
        if (pos >= len) return { value, ended: END };
        const d = text.charCodeAt(pos);
        if (d === 44) {
          pos += 1;
          return { value, ended: COMMA };
        }
        if (d === 10) {
          pos += 1;
          line += 1;
          return { value, ended: LINE_BREAK };
        }
        if (d === 13 && text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line += 1;
          return { value, ended: LINE_BREAK };
        }
        // What follows the closing quote is appended as it stands, up to the next comma or line break.
        const junk = readUnquoted(value);
        if (junk.added > 0) error('quote_junk');
        return junk;
      }
      if (c === 10) {
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, p), '\n');
        p += 1;
        segStart = p;
        qline += 1;
        continue;
      }
      if (c === 13) {
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, p), '\n');
        p += text.charCodeAt(p + 1) === 10 ? 2 : 1;
        segStart = p;
        qline += 1;
        continue;
      }
      p++;
    }
    // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
    pos = open + 1;
    line = openLine;
    error('unterminated_quote');
    return readUnquoted('"');
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
