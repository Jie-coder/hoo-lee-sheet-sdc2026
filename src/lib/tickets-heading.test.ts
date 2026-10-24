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

describe("heroHeading", () => {
  it("matches the rendered ticket count in EN and BM", async () => {
    const { heroHeading } = await import("./i18n-messages");
    expect(heroHeading("en", 3)).toBe("Three routes out of here");
    expect(heroHeading("en", 4)).toBe("Four routes out of here");
    expect(heroHeading("ms", 3)).toBe("Tiga laluan keluar dari sini");
    expect(heroHeading("ms", 4)).toBe("Empat laluan keluar dari sini");
    expect(heroHeading("en", 1)).toBe("One route out of here");
    expect(heroHeading("ms", 1)).toBe("Satu laluan keluar dari sini");
    expect(heroHeading("en", 0)).toBe("Routes out of here");
    expect(heroHeading("ms", 0)).toBe("Laluan keluar dari sini");
  });
});
