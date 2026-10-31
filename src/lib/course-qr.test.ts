import { create } from "qrcode";
import { describe, expect, it } from "vitest";
import { courseQrModel } from "./course-qr";

describe("courseQrModel", () => {
  const url = "https://rakyatdigital.gov.my/en/literacy-hub";

  it("encodes the full URL at error correction M", () => {
    const model = courseQrModel(url);
    const qr = create(url, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    expect(model.size).toBe(n + 2);
    const drawn = new Set(model.path.match(/M\d+ \d+/g));
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        const dark = Boolean(qr.modules.data[row * n + col]);
        expect(drawn.has(`M${col + 1} ${row + 1}`)).toBe(dark);
      }
    }
  });

  it("changes when the URL changes and keeps the finder", () => {
    const a = courseQrModel(url);
    const b = courseQrModel(`${url}/extra`);
    expect(a.path).not.toBe(b.path);
    expect(a.path.startsWith("M1 1h1")).toBe(true);
  });
});
