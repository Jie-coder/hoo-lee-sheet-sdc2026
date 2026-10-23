import { describe, expect, it } from "vitest";
import { countWord, ticketsHeading } from "./i18n-messages";

describe("ticketsHeading", () => {
  it("matches the rendered ticket count in EN and BM", () => {
    expect(ticketsHeading("en", 3)).toBe("Your three tickets");
    expect(ticketsHeading("en", 4)).toBe("Your four tickets");
    expect(ticketsHeading("ms", 3)).toBe("Tiga tiket anda");
    expect(ticketsHeading("ms", 4)).toBe("Empat tiket anda");
    expect(ticketsHeading("en", 1)).toBe("Your one ticket");
    expect(ticketsHeading("ms", 1)).toBe("Satu tiket anda");
  });

  it("falls back to numerals above ten", () => {
    expect(countWord("en", 12)).toBe("12");
    expect(ticketsHeading("ms", 12)).toBe("12 tiket anda");
  });
});
