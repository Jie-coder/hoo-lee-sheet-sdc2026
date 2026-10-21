import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InfoPopover } from "./info-popover";

describe("InfoPopover", () => {
  it("is collapsed by default and toggles aria-expanded on click", async () => {
    const user = userEvent.setup();
    render(
      <InfoPopover label="About this score">
        <p>The long explanation</p>
      </InfoPopover>,
    );
    const button = screen.getByRole("button", { name: "About this score" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("The long explanation")).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The long explanation")).toBeInTheDocument();
  });

  it("is keyboard operable and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <InfoPopover label="About this score">
        <p>The long explanation</p>
      </InfoPopover>,
    );
    const button = screen.getByRole("button", { name: "About this score" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("The long explanation")).not.toBeInTheDocument();
  });

  it("closes on an outside click", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <InfoPopover label="About this score">
          <p>The long explanation</p>
        </InfoPopover>
        <button type="button">Elsewhere</button>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "About this score" }));
    expect(screen.getByText("The long explanation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByText("The long explanation")).not.toBeInTheDocument();
  });

  it("points aria-controls at the panel it reveals", async () => {
    const user = userEvent.setup();
    render(
      <InfoPopover label="About this score">
        <p>The long explanation</p>
      </InfoPopover>,
    );
    const button = screen.getByRole("button", { name: "About this score" });
    await user.click(button);
    const controlsId = button.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).toHaveTextContent("The long explanation");
  });
});
