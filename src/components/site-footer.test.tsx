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
  it("uses the on-dark variant: header logo with only the wordmark fill set to Limestone", async () => {
    const { readFileSync } = await import("node:fs");
    const { render } = await import("@testing-library/react");
    const { SiteFooter, LOGO_SRC, FOOTER_LOGO_SRC } = await import("./site-footer");
    expect(FOOTER_LOGO_SRC).toBe("/brand/laluan-logo-on-dark.svg");
    const read = (src: string) => readFileSync(path.join(process.cwd(), "public", src), "utf8");
    const header = read(LOGO_SRC);
    const footer = read(FOOTER_LOGO_SRC);
    expect(footer).toBe(header.replace('fill="#121212"', 'fill="#f7f6f2"'));
    expect(footer).toContain('fill="#fc5000"');
    expect(footer).not.toContain("#121212");
    const { container } = render(<SiteFooter />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(FOOTER_LOGO_SRC);
    expect(img.className).toBe("h-7 w-[125px]");
  });
});
