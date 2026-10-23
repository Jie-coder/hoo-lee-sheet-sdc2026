import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

let pathname = "/results";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("SiteHeader progress stepper", () => {
  it("links completed steps, marks the current one and disables upcoming ones", () => {
    pathname = "/results";
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: /progress/i });

    const profile = nav.querySelector('[data-step-state="complete"][href="/profile"]');
    const interview = nav.querySelector('[data-step-state="complete"][href="/interview"]');
    expect(profile).toHaveTextContent("Profile");
    expect(interview).toHaveTextContent("Interview");

    const current = nav.querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent("Results");
    expect(current?.tagName).not.toBe("A");

    const upcoming = nav.querySelector('[data-step-state="upcoming"]');
    expect(upcoming).toHaveTextContent("Pathway");
    expect(upcoming).toHaveAttribute("aria-disabled", "true");
    expect(upcoming).not.toHaveAttribute("href");
    expect(upcoming?.className).toContain("cursor-not-allowed");
  });

  it("has no links on the first step", () => {
    pathname = "/profile";
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: /progress/i });
    expect(nav.querySelectorAll("a")).toHaveLength(0);
    expect(nav.querySelectorAll('[aria-disabled="true"]')).toHaveLength(3);
  });
});
