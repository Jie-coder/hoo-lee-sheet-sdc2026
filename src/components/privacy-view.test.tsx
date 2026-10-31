import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FlowProvider } from "@/context/flow-context";
import { LocaleProvider } from "@/lib/i18n";
import { PrivacyView } from "./privacy-view";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({ usePathname: () => "/privacy" }));

describe("privacy CV-parse disclosure", () => {
  it("names KrackedDevs for CV text in EN and BM, and delete still clears the session", async () => {
    const user = userEvent.setup();
    render(
      <FlowProvider>
        <LocaleProvider>
          <SiteHeader />
          <PrivacyView />
        </LocaleProvider>
      </FlowProvider>,
    );

    expect(
      screen.getByText(/KrackedDevs sponsor OpenAI-compatible endpoint \(LiteLLM\) when that key is set/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Anthropic Claude Haiku on our main deployment \(Replit\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "BM" }));
    expect(
      screen.getByText(/titik akhir penaja KrackedDevs yang serasi dengan OpenAI \(LiteLLM\)/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Padam data saya" }));
    expect(screen.getByRole("status")).toHaveTextContent("Selesai");
  });
});
