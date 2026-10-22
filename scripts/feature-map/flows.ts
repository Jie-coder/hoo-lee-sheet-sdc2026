// Named flows an agent can run with drive.ts. Each flow is a list of simple
// steps, written to match the "How to reach it" sections in
// .claude/skills/laluan-feature-map/feature-map.md.
//
// Step types (kept tiny on purpose):
//   goto       open a path, e.g. "/radar"
//   click      click an element by data-testid
//   clickRole  click by ARIA role + visible name (when no test id exists)
//   press      press a keyboard key, e.g. "ArrowRight"
//   waitUrl    wait until the URL path matches
//   expectText wait until some text is visible
//   shot       save a screenshot with this name
export type Step =
  | { goto: string }
  | { click: string; nth?: number }
  | { clickRole: "button" | "link" | "tab" | "checkbox" | "radio"; name: string }
  | { press: string }
  | { waitUrl: string }
  | { expectText: string }
  | { shot: string };

export type Flow = { description: string; needsSecrets?: boolean; steps: Step[] };

export const FLOWS: Record<string, Flow> = {
  // The main demo journey, start to finish. Uses only curated data (no secrets).
  "full-journey": {
    description: "Landing -> consent -> sample CV (Aisyah) -> 5 questions -> results -> choose role -> pathway",
    steps: [
      { goto: "/" },
      { shot: "01-landing" },
      { click: "landing-consent" },
      { click: "landing-start" },
      { waitUrl: "/profile" },
      { click: "persona-card-aisyah" },
      { shot: "02-profile" },
      { click: "profile-continue" },
      { waitUrl: "/interview" },
      // Five questions: "Next" five times (the last one says "See results").
      { click: "interview-next" },
      { click: "interview-next" },
      { click: "interview-next" },
      { click: "interview-next" },
      { shot: "03-interview" },
      { click: "interview-next" },
      { waitUrl: "/results" },
      { click: "role-choose", nth: 0 },
      { waitUrl: "/pathway" },
      { expectText: "week route to" },
      { shot: "04-pathway" },
    ],
  },
  // Landing guard: Start without consent must stay on "/".
  "consent-guard": {
    description: "Clicking Start without ticking consent keeps you on the landing page",
    steps: [{ goto: "/" }, { click: "landing-start" }, { waitUrl: "/" }, { shot: "consent-guard" }],
  },
  // Radar page on its own, then back to the start.
  radar: {
    description: "Open the Future Skills Radar and go back to the start",
    steps: [{ goto: "/radar" }, { shot: "radar" }, { click: "radar-match-skills" }, { waitUrl: "/" }],
  },
  // Status page calls live integrations, so it is only meaningful with secrets.
  status: {
    description: "Health checks for every integration (needs .env secrets for green cards)",
    needsSecrets: true,
    steps: [{ goto: "/status" }, { expectText: "Status" }, { shot: "status" }],
  },
  // Demo page: uses /api/analyze (mock mode when AI_MOCK=true, otherwise needs a key).
  demo: {
    description: "Load the example text and submit it to /api/analyze",
    needsSecrets: true,
    steps: [{ goto: "/demo" }, { click: "demo-load-example" }, { click: "demo-submit" }, { shot: "demo" }],
  },
};
