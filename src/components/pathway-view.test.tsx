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
  it("shows one fallback line when Chinese is the only course language", async () => {
    renderPathway(["zh"]);
    const line = await screen.findAllByText("No Chinese course found for some skills, so other-language courses are shown.");
    expect(line).toHaveLength(1);
    expect(line[0].closest("article")).toBeNull();
    const pills = screen.getAllByTestId("course-language-pill");
    expect(pills.map((pill) => pill.textContent)).toContain("EN");
  });

  it("shows no fallback line when English is also selected, but still labels each course", async () => {
    renderPathway(["en", "zh"]);
    await screen.findAllByRole("heading", { level: 3 });
    expect(screen.queryByTestId("no-chinese-course")).toBeNull();
    expect(screen.getAllByTestId("course-language-pill").every((pill) => /^(ZH|BM|EN)$/.test(pill.textContent ?? ""))).toBe(true);
  });

  it("shows no Chinese-course note for an English-only preference", async () => {
    renderPathway(["en"]);
    await screen.findAllByRole("heading", { level: 3 });
    expect(screen.queryByTestId("no-chinese-course")).toBeNull();
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

  it("labels a course that directly lists a gap skill as covering it, not 'Related to'", async () => {
    renderPathway();
    await screen.findAllByRole("heading", { level: 3 });
    const labels = screen.getAllByText(/^Covers:/).map((node) => node.closest("article")).filter(Boolean);
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Related to:/)).toBeNull();
    for (const article of labels) {
      const title = within(article!).getByRole("heading", { level: 3 }).textContent;
      const skillLabel = within(article!).getByText(/^Covers:/).querySelector("span")?.textContent;
      const gapSkill = role.gap.find((skill) => skill.label === skillLabel);
      const course = CATALOGUE.courses.find((c) => c.title === title);
      expect(gapSkill).toBeDefined();
      expect(course?.skillIds).toContain(gapSkill!.skillId);
    }
  });

  it("shows a way back instead of a blank page for a role that isn't in the results", async () => {
    roleParam = "not-a-role";
    renderPathway();

    expect(await screen.findByText("That role isn’t in your results.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to roles/ })).toBeInTheDocument();
  });
});

describe("PathwayView CJK titles", () => {
  it("shows a Chinese course title as stored, with a ZH pill, in the card and the print sheet", async () => {
    const zhCourse = CATALOGUE.courses.find((course) => course.languages.includes("zh") && /[\u4e00-\u9fff]/.test(course.title));
    expect(zhCourse).toBeDefined();
    const courses = CATALOGUE.courses.map((course) =>
      course.id === zhCourse!.id ? { ...course, skillIds: [...new Set([...course.skillIds, ...role.gap.map((g) => g.skillId)])], costType: "free" as const, aiContent: "ai" as const, hours: 1 } : course,
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...result, skillMatches: resolved.matches }), { status: 200 })));
    seedFlowState(["zh"]);
    render(
      <FlowProvider>
        <PathwayView courses={courses} programmes={CATALOGUE.programmes} courseSkillGroups={CATALOGUE.skillGroups} />
      </FlowProvider>,
    );
    const heading = await screen.findByRole("heading", { name: new RegExp(zhCourse!.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
    expect(heading).toHaveTextContent(zhCourse!.title);
    expect(within(heading.parentElement!).getByTestId("course-language-pill")).toHaveTextContent("ZH");
    expect(document.querySelector(".print-only")?.textContent).toContain(zhCourse!.title);
  });
});
