import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { FOOTER_LINKS } from "./site-footer";
import { DATA_SOURCES } from "./data-sources-view";

describe("footer links", () => {
  it("each point at an existing app route", () => {
    for (const link of FOOTER_LINKS) {
      expect(link.href).toMatch(/^\/[a-z-]+$/);
      expect(existsSync(path.join(process.cwd(), "src/app", link.href, "page.tsx"))).toBe(true);
    }
  });
  it("data sources with a link use https", () => {
    for (const s of DATA_SOURCES) if (s.url !== null) expect(s.url).toMatch(/^https:\/\//);
  });
});
