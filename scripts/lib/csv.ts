// Minimal RFC-4180 CSV parser: quoted fields, embedded commas/newlines,
// escaped quotes (""), a leading BOM, and both CRLF and LF line endings.
// No dependency: the files this reads are a handful of KB each.

export type CsvRow = string[];

/** One parsed CSV document: the header row and every data row below it. */
export type ParsedCsv = {
  header: CsvRow;
  rows: CsvRow[];
};

const BOM = "﻿";

/** Parses CSV text into a header row and data rows. Never trims field values. */
export function parseCsv(text: string): ParsedCsv {
  const input = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = input.length;
  let fieldStarted = false;

  const pushField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < len) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"' && field.length === 0 && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (char === "\r") {
      if (input[i + 1] === "\n") {
        i += 1;
      }
      pushRow();
      i += 1;
      continue;
    }

    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }

    field += char;
    fieldStarted = true;
    i += 1;
  }

  // Trailing field/row, unless the file ended cleanly on a newline.
  if (field.length > 0 || fieldStarted || row.length > 0) {
    pushRow();
  }

  // Drop a single fully-blank trailing row (common with a trailing newline).
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === "") {
      rows.pop();
    } else {
      break;
    }
  }

  const [header = [], ...dataRows] = rows;
  return { header, rows: dataRows };
}
