import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("splits a simple comma-separated file into a header and rows", () => {
    const { header, rows } = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
    expect(header).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("keeps a comma inside a quoted field", () => {
    const { rows } = parseCsv('id,title\nc001,"Spreadsheets, Pivot Tables"\n');
    expect(rows).toEqual([["c001", "Spreadsheets, Pivot Tables"]]);
  });

  it("keeps a newline inside a quoted field", () => {
    const { rows } = parseCsv('id,notes\nc001,"line one\nline two"\n');
    expect(rows).toEqual([["c001", "line one\nline two"]]);
  });

  it("unescapes a doubled quote inside a quoted field", () => {
    const { rows } = parseCsv('id,title\nc001,"Say ""hello"""\n');
    expect(rows).toEqual([["c001", 'Say "hello"']]);
  });

  it("handles CRLF line endings", () => {
    const { header, rows } = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(header).toEqual(["a", "b"]);
    expect(rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("strips a leading BOM", () => {
    const { header } = parseCsv("﻿a,b\n1,2\n");
    expect(header).toEqual(["a", "b"]);
  });

  it("handles a file with no trailing newline", () => {
    const { header, rows } = parseCsv("a,b\n1,2");
    expect(header).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"]]);
  });

  it("treats a blank cell as an empty string, not a missing field", () => {
    const { rows } = parseCsv("a,b,c\n1,,3\n");
    expect(rows).toEqual([["1", "", "3"]]);
  });
});
