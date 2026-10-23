import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadarEntry } from "./radar-entry";
import { radarBackLink } from "./radar-view";
import { translate } from "@/lib/i18n-messages";

describe("Skills Radar back pill", () => {
  it("returns to Results by default and on direct open", () => {
    expect(radarBackLink(null)).toEqual({ href: "/results", label: "radar.backToResults" });
    expect(radarBackLink("somewhere-else")).toEqual({ href: "/results", label: "radar.backToResults" });
    expect(translate("en", "radar.backToResults")).toBe("← Back to results");
  });

  it("returns to the exposure intro when opened from there", () => {
    expect(radarBackLink("exposure-intro")).toEqual({ href: "/exposure-intro", label: "radar.back" });
    expect(translate("en", "radar.back")).toBe("← Back");
    expect(translate("ms", "radar.back")).toBe("← Kembali");
  });

  it("the large (exposure-intro) entry tags the origin; the compact one does not", () => {
    const { unmount } = render(<RadarEntry size="large" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/radar?from=exposure-intro");
    unmount();
    render(<RadarEntry />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/radar");
  });
});
