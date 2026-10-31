import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PartnerView, validatePartnerForm } from "./partner-view";

describe("partner form", () => {
  it("validates all four fields", () => {
    expect(Object.keys(validatePartnerForm({ org: "", url: "nope", skills: [], email: "x" })).sort()).toEqual(["email", "org", "skills", "url"]);
    expect(validatePartnerForm({ org: "Example Academy", url: "https://example.com", skills: ["data"], email: "a@example.com" })).toEqual({});
  });

  it("shows errors on empty submit, then the demo success ticket", () => {
    render(<PartnerView />);
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(screen.getAllByRole("alert").length).toBe(4);
    expect(screen.queryByTestId("partner-success")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Pathway bundle/ }));
    fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "Example Academy" } });
    fireEvent.change(screen.getByLabelText("Course link (URL)"), { target: { value: "https://example.com/course" } });
    fireEvent.click(screen.getByRole("button", { name: "Data & analytics" }));
    fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "hello@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    const success = screen.getByTestId("partner-success");
    expect(success.textContent).toContain("Application received");
    expect(success.textContent).toContain("Example Academy");
    expect(success.textContent).toContain("Data & analytics");
    expect(success.textContent).toContain("Pathway bundle");
    expect(success.textContent).toContain("Demo only — no data is stored.");
  });

  it("states the rules and labels insights as coming soon", () => {
    render(<PartnerView />);
    expect(screen.getByTestId("partner-rules").textContent).toContain("Max 1 per stop, up to 3 per pathway.");
    expect(screen.getByTestId("partner-insights").textContent).toContain("Coming soon · anonymised, opt-in data");
    expect(screen.getAllByText("PLACEHOLDER").length).toBeGreaterThanOrEqual(2);
  });
});
