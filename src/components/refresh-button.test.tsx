import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefreshButton, requestRefresh } from "./refresh-button";
import { TrendStatus } from "./trend-status";
import type { TrendInfo } from "@/lib/trend-info";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const FROZEN = "Snapshot frozen for finals";
const info = (refreshLocked: boolean): TrendInfo => ({
  source: "bundled",
  provider: "arXiv API",
  fetchedAt: "2026-10-29T00:00:00.000Z",
  store: null,
  warning: null,
  refreshedCount: 0,
  total: 25,
  carriedFrom: null,
  refreshLocked,
});

afterEach(() => vi.unstubAllGlobals());

describe("RefreshButton finals freeze", () => {
  it("renders disabled with the frozen label when the server says locked", () => {
    render(<TrendStatus info={info(true)} />);
    const button = screen.getByTestId("trend-refresh");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(FROZEN);
    expect(button).toHaveAttribute("data-locked", "true");
  });

  it("stays a normal Refresh button when not locked", () => {
    render(<TrendStatus info={info(false)} />);
    const button = screen.getByTestId("trend-refresh");
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent("Refresh");
    expect(button).not.toHaveAttribute("data-locked");
  });

  it("requestRefresh reports a 423 as locked", async () => {
    const fetchImpl = (async () =>
      Response.json({ error: "Trend data is frozen for the finals; showing the saved snapshot.", active: {} }, { status: 423 })) as typeof fetch;
    expect(await requestRefresh(fetchImpl)).toMatchObject({ ok: false, locked: true });
  });

  it("a 423 reply shows the frozen label instead of an error", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: "frozen", active: {} }, { status: 423 }));
    render(<RefreshButton />);
    fireEvent.click(screen.getByTestId("trend-refresh"));
    await waitFor(() => expect(screen.getByTestId("trend-refresh")).toHaveTextContent(FROZEN));
    expect(screen.getByTestId("trend-refresh")).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
