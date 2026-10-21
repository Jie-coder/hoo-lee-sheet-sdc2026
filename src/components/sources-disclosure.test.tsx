import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Source } from "@/types/contracts";
import { SourcesDisclosure } from "./sources-disclosure";

function source(overrides: Partial<Source>): Source {
  return {
    dataset: "ESCO v1.2",
    releaseDate: "2024-05-01",
    url: "https://esco.ec.europa.eu/en",
    asOf: "2026-10-19",
    ...overrides,
  };
}

describe("SourcesDisclosure", () => {
  it("merges several source chips into one count control, singular for one source", () => {
    render(<SourcesDisclosure sources={[source({})]} />);
    expect(screen.getByRole("button", { name: "1 source" })).toBeInTheDocument();
  });

  it("uses the plural count for more than one source", () => {
    render(
      <SourcesDisclosure
        sources={[source({ dataset: "ESCO v1.2" }), source({ dataset: "arXiv momentum", releaseDate: "2026-10-19" })]}
      />,
    );
    expect(screen.getByRole("button", { name: "2 sources" })).toBeInTheDocument();
  });

  it("renders nothing when there are no sources", () => {
    const { container } = render(<SourcesDisclosure sources={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is collapsed by default and expands to the full dated source list on click", async () => {
    const user = userEvent.setup();
    render(
      <SourcesDisclosure
        sources={[source({ dataset: "ESCO v1.2" }), source({ dataset: "arXiv momentum", releaseDate: "2026-10-19" })]}
      />,
    );
    const button = screen.getByRole("button", { name: "2 sources" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/ESCO v1\.2/)).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/ESCO v1\.2/)).toBeInTheDocument();
    expect(screen.getByText(/arXiv momentum/)).toBeInTheDocument();
  });
});
