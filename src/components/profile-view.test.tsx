import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowProvider } from "@/context/flow-context";
import { PERSONA_IDS, PERSONAS } from "@/mocks/personas";
import { ProfileView, SAMPLE_LOADING_MS } from "./profile-view";

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

    const loader = screen.getByTestId("profile-sample-loading");
    expect(loader).toHaveTextContent("Loading sample profile…");
    expect(loader.textContent).not.toMatch(/analy|AI/i);
    expect(screen.queryByDisplayValue(persona.name)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(SAMPLE_LOADING_MS - 1);
    });
    expect(screen.getByTestId("profile-sample-loading")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("profile-sample-loading")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(persona.name)).toBeInTheDocument();
  });
});
