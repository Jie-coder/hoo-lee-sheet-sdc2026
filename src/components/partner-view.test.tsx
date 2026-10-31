import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PartnerView, validatePartnerForm } from "./partner-view";

describe("partner form", () => {
  it("validates all four fields", () => {
    expect(Object.keys(validatePartnerForm({ org: "", url: "nope", skills: [], email: "x" })).sort()).toEqual(["email", "org", "skills", "url"]);
    expect(validatePartnerForm({ org: "Example Academy", url: "https://example.com", skills: ["data"], email: "a@example.com" })).toEqual({});
  });

  it("shows errors on empty submit, then the demo success ticket", () => {
    render(<PartnerView />);
    // Prefilled demo values first; clear them to see validation.
    expect((screen.getByLabelText("Organisation name") as HTMLInputElement).value).toBe("Draviqen Academy");
    expect((screen.getByLabelText("Contact email") as HTMLInputElement).value).toBe("partners@example.my");
    expect((screen.getByLabelText("Course link (URL)") as HTMLInputElement).value).toBe("https://example.my/courses/dashboards");
    fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Course link (URL)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Data & analytics/ }));
    fireEvent.click(screen.getByRole("button", { name: /Submit application/ }));
    expect(screen.getAllByRole("alert").length).toBe(4);
    expect(screen.queryByTestId("partner-success")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Pathway bundle/ }));
    fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "Example Academy" } });
    fireEvent.change(screen.getByLabelText("Course link (URL)"), { target: { value: "https://example.com/course" } });
    fireEvent.click(screen.getByRole("button", { name: /Data & analytics/ }));
    fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "hello@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit application/ }));

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
    expect(screen.getByText("RM 0.80 / click · RM 25 / enrolment")).toBeTruthy();
    expect(screen.getByText("RM 1,500 / month")).toBeTruthy();
    expect(screen.getByText("Performance-based. Pay only for results. Cancel anytime.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/PLACEHOLDER|Example/);
    expect(screen.getByTestId("partner-hero-preview").textContent).toContain("Dashboards That Tell a Story");
  });

  it("submits without any network request or storage", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<PartnerView />);
    fireEvent.click(screen.getByRole("button", { name: /Submit application/ }));
    expect(screen.getByTestId("partner-success").textContent).toContain("Draviqen Academy");
    expect(screen.getByTestId("partner-success").textContent).toContain("Partner review");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    setItem.mockRestore();
  });
});
