import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Disclosure } from "./disclosure";

describe("Disclosure", () => {
  it("is collapsed by default: aria-expanded is false and the content is not rendered", () => {
    render(
      <Disclosure summary="Details">
        <p>Hidden detail</p>
      </Disclosure>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Hidden detail")).not.toBeInTheDocument();
  });

  it("toggles aria-expanded and reveals the content on click, then hides it again", async () => {
    const user = userEvent.setup();
    render(
      <Disclosure summary="Details">
        <p>Hidden detail</p>
      </Disclosure>,
    );
    const button = screen.getByRole("button", { name: "Details" });

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Hidden detail")).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Hidden detail")).not.toBeInTheDocument();
  });

  it("is keyboard operable: a real button toggles on Enter without a pointer", async () => {
    const user = userEvent.setup();
    render(
      <Disclosure summary="Details">
        <p>Hidden detail</p>
      </Disclosure>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Hidden detail")).toBeInTheDocument();
  });

  it("points aria-controls at the content element it reveals", async () => {
    const user = userEvent.setup();
    render(
      <Disclosure summary="Details">
        <p>Hidden detail</p>
      </Disclosure>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    await user.click(button);
    const controlsId = button.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).toHaveTextContent("Hidden detail");
  });

  it("honours defaultOpen", () => {
    render(
      <Disclosure summary="Details" defaultOpen>
        <p>Hidden detail</p>
      </Disclosure>,
    );
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Hidden detail")).toBeInTheDocument();
  });
});
