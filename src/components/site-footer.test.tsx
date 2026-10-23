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

describe("footer logo", () => {
  it("reuses the header's Ember logo at the same size with no colour filter", async () => {
    const { render } = await import("@testing-library/react");
    const { SiteFooter } = await import("./site-footer");
    const { LOGO_SRC } = await import("./site-footer");
    expect(LOGO_SRC).toBe("/brand/laluan-logo-ember.svg");
    expect(existsSync(path.join(process.cwd(), "public", LOGO_SRC))).toBe(true);
    const { container } = render(<SiteFooter />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(LOGO_SRC);
    expect(img.className).toBe("h-7 w-[125px]");
  });
});
