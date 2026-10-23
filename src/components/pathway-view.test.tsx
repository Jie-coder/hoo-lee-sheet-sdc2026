import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowProvider } from "@/context/flow-context";
import { analyzeProfile } from "@/lib/analyze";
import { CATALOGUE } from "@/lib/catalogue";
import { resolveProfileSkills } from "@/lib/profile-skills";
import { PERSONAS } from "@/mocks/personas";
import { PathwayView } from "./pathway-view";

// Aisyah's real result from the curated data; the fetch to /api/roles is
// answered with it, so the page runs the same code as in the browser.
const persona = PERSONAS.aisyah;
const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
const resolved = resolveProfileSkills(CATALOGUE, persona.id, chips);
const result = analyzeProfile(CATALOGUE, {
  skills: resolved.skills,
  currentOccupationId: persona.currentOccupationId,
  impactInterest: "none",
});
const role = result.roles[0];
let roleParam = role.occupationId;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`role=${roleParam}`),
}));

function seedFlowState(courseLanguages: string[] = ["en"]) {
  sessionStorage.setItem(
    "laluan:flow:v1",
    JSON.stringify({
      consent: true,
      consentAt: new Date().toISOString(),
      profile: {
        personaId: "aisyah",
        name: persona.name,
        roles: [],
        education: [],
        skills: chips.map((chip, index) => ({ id: `s${index}`, label: chip.label, matched: true, selfReported: false })),
        courseLanguages,
      },
      interviewAnswers: { hours_per_week: 6 },
      chosenRoleId: role.occupationId,
    }),
  );
}

function renderPathway(courseLanguages?: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ...result, skillMatches: resolved.matches }), { status: 200 })),
  );
  seedFlowState(courseLanguages);
  return render(
    <FlowProvider>
      <PathwayView
        courses={CATALOGUE.courses}
        programmes={CATALOGUE.programmes}
        courseSkillGroups={CATALOGUE.skillGroups}
      />
    </FlowProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  roleParam = role.occupationId;
});

describe("PathwayView", () => {
  it("notes a missing Chinese course beside the English fallback when Chinese is preferred", async () => {
    renderPathway(["zh"]);
    const notes = await screen.findAllByText("No Chinese course found");
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].closest("article")).not.toBeNull();
  });

  it("shows no Chinese-course note for an English-only preference", async () => {
    renderPathway(["en"]);
    await screen.findAllByRole("heading", { level: 3 });
    expect(screen.queryByText("No Chinese course found")).toBeNull();
  });

  it("opens on AI untuk Rakyat (no hours listed) and only cites catalogue items", async () => {
    renderPathway();

    const aiStep = (await screen.findByRole("heading", { name: "AI untuk Rakyat Programme" })).closest("article");
    expect(within(aiStep!).getByText("Hours not listed")).toBeInTheDocument();

    const known = new Set([...CATALOGUE.courses.map((c) => c.title), ...CATALOGUE.programmes.map((p) => p.name)]);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent ?? "");
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(known.has(title)).toBe(true);
  });

  it("shows a way back instead of a blank page for a role that isn't in the results", async () => {
    roleParam = "not-a-role";
    renderPathway();

    expect(await screen.findByText("That role isn’t in your results.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to roles/ })).toBeInTheDocument();
  });
});
