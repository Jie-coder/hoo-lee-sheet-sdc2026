import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowProvider } from "@/context/flow-context";
import { PERSONA_IDS, PERSONAS } from "@/mocks/personas";
import { ProfileView, SAMPLE_LOADING_MS, sampleLabel } from "./profile-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.setItem(
    "laluan:flow:v1",
    JSON.stringify({ consent: true, consentAt: new Date().toISOString() }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("sampleLabel", () => {
  it("uses first names and the sample CV job title", () => {
    expect(sampleLabel("aisyah")).toBe("Aisyah · Administrative Assistant");
    expect(sampleLabel("lim-jia-hui")).toBe("Jia Hui · Senior Accounts Assistant");
    expect(sampleLabel("pravin")).toBe("Pravin · Customer Support Agent");
  });
});

describe("ProfileView sample loading", () => {
  it("shows a sample loading state for ~2.5s before showing the sample profile", async () => {
    render(
      <FlowProvider>
        <ProfileView />
      </FlowProvider>,
    );
    await act(async () => {});
    const id = PERSONA_IDS[0];
    const persona = PERSONAS[id];
    const firstName = persona.name.split(/\s+/)[0];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(firstName) }));

    const loader = screen.getByTestId("profile-loading");
    expect(loader).toHaveTextContent("Loading…");
    expect(loader.textContent).not.toMatch(/analy|AI|sample/i);
    const button = screen.getByRole("button", { name: new RegExp(firstName) });
    expect(button).toHaveClass("bg-obsidian", "text-limestone");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toHaveClass("opacity-40");
    const other = screen.getByRole("button", { name: /Jia Hui/ });
    expect(other).toBeDisabled();
    expect(other).toHaveClass("opacity-40", "disabled:cursor-not-allowed");
    expect(screen.queryByDisplayValue(persona.name)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(SAMPLE_LOADING_MS - 1);
    });
    expect(screen.getByTestId("profile-loading")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("profile-loading")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(persona.name)).toBeInTheDocument();
  });
});
