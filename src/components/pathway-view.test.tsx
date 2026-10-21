import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlowProvider } from "@/context/flow-context";
import { AISYAH_RESULTS } from "@/mocks/aisyah";
import { PathwayView } from "./pathway-view";

// Data Operations Analyst: plan opens on the "AI Untuk Rakyat" programme
// (step 1) and closes on "Career counselling session" (step 5) — neither
// carries an `hours` field in the catalogue, unlike every course step.
const role = AISYAH_RESULTS.today.response.roles[0];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`role=${role.occupationId}`),
}));

function seedFlowState() {
  sessionStorage.setItem(
    "laluan:flow:v1",
    JSON.stringify({
      consent: true,
      consentAt: new Date().toISOString(),
      profile: {
        personaId: "aisyah",
        name: "Aisyah",
        roles: [],
        education: [],
        skills: [],
        courseLanguages: ["en"],
      },
      interviewAnswers: { hours_per_week: 6 },
      chosenRoleId: role.occupationId,
    }),
  );
}

describe("PathwayView", () => {
  it("shows an hours chip on every step, placeholder for programmes that don't list hours", async () => {
    seedFlowState();
    render(
      <FlowProvider>
        <PathwayView />
      </FlowProvider>,
    );

    const aiStep = (await screen.findByRole("heading", { name: "AI Untuk Rakyat" })).closest("article");
    expect(within(aiStep!).getByLabelText("Hours not listed")).toHaveTextContent("— h");

    const counsellingStep = screen.getByRole("heading", { name: "Career counselling session" }).closest("article");
    expect(within(counsellingStep!).getByLabelText("Hours not listed")).toHaveTextContent("— h");

    const courseStep = screen.getByRole("heading", { name: "Data cleaning with Excel Power Query" }).closest("article");
    expect(within(courseStep!).getByText("6 h")).toBeInTheDocument();
    expect(within(courseStep!).queryByLabelText("Hours not listed")).not.toBeInTheDocument();
  });
});
