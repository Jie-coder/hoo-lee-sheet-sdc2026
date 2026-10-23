import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EN } from "@/lib/i18n-messages";
import { ScenarioTabs } from "./scenario-tabs";

describe("ScenarioTabs tooltip", () => {
  it("explains a scenario on focus and hides on blur", () => {
    render(<ScenarioTabs value="co" onChange={vi.fn()} />);
    const tab = screen.getByRole("tab", { name: EN["scenarioTabs.disLabel"] });
    fireEvent.focus(tab);
    expect(screen.getByRole("tooltip")).toHaveTextContent(EN["scenarioTabs.disTip"]);
    expect(tab).toHaveAttribute("aria-describedby", "scenario-tip");
    fireEvent.blur(tab);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
