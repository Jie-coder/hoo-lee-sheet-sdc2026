// Hand-written facts the scanner (scan.ts) cannot read from the code:
// what an action means in words, the decisions hidden inside click handlers,
// where the data behind each API comes from, and short human names for
// conditions. Everything else in the diagrams is generated from src/.
//
// `npm run feature-map:check` fails if anything here points at a test id,
// route, component or data source that no longer exists, or if a guard
// condition found in the code has no human label below.

/** Where a decision branch leads. */
export type Target =
  | { route: string } // another page
  | { testId: string } // an element on the same page (e.g. a Retry button)
  | { data: string } // a data source id from DATA_SOURCES
  | { note: string }; // an outcome that is not a page (toast, stays put...)

export type Decision = {
  /** Page the decision belongs to ("/api/..." for an API route). */
  route: string;
  /** Element the decision follows, or "load" for one made when the page / API runs. */
  from: string;
  question: string;
  branches: { label: string; to: Target }[];
};

/** The main user journey, as the test ids whose clicks move it forward. Drawn thick and orange. */
export const JOURNEY = ["landing-consent", "landing-start", "persona-card-*", "profile-continue", "interview-next", "role-choose"];

/** One line per page: shown under the page title. */
export const PAGE_TITLES: Record<string, string> = {
  "/": "Landing · consent gate",
  "/profile": "Pick a sample CV or upload one",
  "/interview": "Five quick questions",
  "/results": "Ranked roles under 3 futures",
  "/pathway": "Week-by-week plan for the chosen role",
  "/radar": "Future Skills Radar",
  "/status": "Integration health checks (not linked)",
  "/demo": "Starter demo of /api/analyze (not linked)",
};

/** Edge text for a click, by test id. Default is "click <label>". */
export const ACTIONS: Record<string, string> = {
  "landing-consent": "tick consent",
  "landing-start": "click Start",
  "persona-card-*": "choose persona",
  "profile-upload-browse": "browse PDF",
  "profile-continue": "click Continue",
  "interview-next": "Next ×5",
  "interview-skip": "Skip (on Q5)",
  "role-choose": "choose role",
  "results-radar-link": "open radar",
  "results-retry": "Try again",
  "pathway-back-to-roles": "Back to roles",
  "pathway-delete-data": "Delete my data",
  "radar-match-skills": "Match your skills",
  "header-home": "click logo",
  "demo-submit": "Submit",
  "demo-save": "Save result",
};

/** Better labels where the code only has expressions. Key: test id, or component name when it has one element. */
export const LABELS: Record<string, string> = {
  "persona-card-*": "Sample CV card: Aisyah / Lim Jia Hui / Pravin",
  "landing-consent": "I understand (synthetic CVs, estimates)",
  "scenario-tab-*": "Scenario tabs: Co-Pilot / Displacement / Supercharged",
  SignalDateToggle: "Trend date: latest / 30 days earlier",
  KeywordTag: "arXiv keyword link (opens arXiv)",
  SourcesDisclosure: "Show N sources",
  SourceChip: "Source chip (opens dataset)",
};

/** Side effects worth seeing that are not navigation. Drawn as dashed notes. */
export const EFFECTS: Record<string, string> = {
  "landing-consent": "sets consent in flow state",
  "persona-card-*": "fills profile from mock persona; details panel opens",
  "profile-upload-browse": "mock parse → toast; editable empty profile",
  "pathway-download": "toast: download not available in demo",
  "pathway-delete-data": "clears sessionStorage flow state",
  "demo-load-example": "fills textarea with sample text",
};

/** Human names for conditions found in the code (guards, "shown when", "disabled when"). */
export const CONDITIONS: Record<string, string> = {
  "hydrated && !consent": "consent not ticked?",
  "!consent": "consent not ticked?",
  "!profile": "no CV chosen yet?",
  "!roleId": "no ?role= in URL?",
  "turn === 1": "Q1 · hours & budget",
  "turn === 2": "Q2 · task shares",
  "turn === 3": "Q3 · tools & AI use",
  "turn === 4": "Q4 · work status",
  "turn === 5": "Q5 · cause & course language",
  profile: "after a CV is chosen",
  'state.status === "error"': "API call failed",
  'state.status === "ready"': "role not in results",
  "!loading && result": "after a result",
  addingSkill: "while adding a skill",
  "!(addingSkill)": "not adding a skill",
  inferredLink: "role has an inferred link",
  "data.signalDates.prior": "prior snapshot exists",
  'link.tier === "inferred"': "SDG link is inferred",
  radar: "radar data loaded",
  "loading || input.trim().length === 0": "loading or empty input",
  loading: "while loading",
  saving: "while saving",
  inferredFlagged: "already flagged",
  "flagged || !onFlag": "already flagged",
  disabled: "no earlier snapshot",
};

/**
 * Data sources. `detect` is a regex run over a page's / API route's code and
 * the src/lib files it imports; a match draws an edge to the source.
 */
export const DATA_SOURCES: { id: string; label: string; kind: "ai" | "db" | "mock" | "file" | "browser"; detect: string }[] = [
  { id: "gemini", label: "Gemini API (AI SDK generateText)", kind: "ai", detect: "generateText\\(" },
  { id: "mock-ai", label: "Mock AI fixture (AI_MOCK=true)", kind: "mock", detect: "env\\.aiMock" },
  { id: "supabase-items", label: "Supabase table: items", kind: "db", detect: '\\.from\\("items"\\)' },
  { id: "catalogue", label: "Curated catalogue: data/*.csv → catalogue.json", kind: "file", detect: "\\bCATALOGUE\\b" },
  { id: "personas", label: "Mock personas + sample CV PDFs (src/mocks)", kind: "mock", detect: "@/mocks/personas" },
  { id: "session", label: "Flow state in sessionStorage", kind: "browser", detect: "sessionStorage" },
];

/** Decisions inside click handlers and API routes. */
export const DECISIONS: Decision[] = [
  {
    route: "/",
    from: "landing-start",
    question: "consent ticked?",
    branches: [
      { label: "yes", to: { route: "/profile" } },
      { label: "no", to: { note: "stays on / · consent label shakes + focus" } },
    ],
  },
  {
    route: "/interview",
    from: "interview-next",
    question: "last question (Q5)?",
    branches: [
      { label: "yes · See results", to: { route: "/results" } },
      { label: "no", to: { note: "next question" } },
    ],
  },
  {
    route: "/results",
    from: "load",
    question: "POST /api/roles ok?",
    branches: [
      { label: "error", to: { testId: "results-retry" } },
      { label: "ok", to: { note: "3 scenario tabs + ranked role cards" } },
    ],
  },
  {
    route: "/results",
    from: "role-choose",
    question: "role picked",
    branches: [{ label: "?role=id", to: { route: "/pathway" } }],
  },
  {
    route: "/pathway",
    from: "load",
    question: "roles loaded and ?role in results?",
    branches: [
      { label: "loading", to: { note: "Building your plan…" } },
      { label: "error", to: { note: "error panel + Try again" } },
      { label: "not in results", to: { note: "panel + Back to roles" } },
      { label: "yes", to: { note: "week-by-week plan + side panel" } },
    ],
  },
  {
    route: "/demo",
    from: "demo-submit",
    question: "input empty or loading?",
    branches: [
      { label: "yes", to: { note: "button disabled" } },
      { label: "no · POST", to: { note: "/api/analyze → result cards; 'Mock mode' badge if mock" } },
    ],
  },
  {
    route: "/api/analyze",
    from: "load",
    question: "AI_MOCK=true?",
    branches: [
      { label: "yes", to: { data: "mock-ai" } },
      { label: "no", to: { data: "gemini" } },
    ],
  },
  {
    route: "/api/items",
    from: "load",
    question: "Supabase env set?",
    branches: [
      { label: "yes", to: { data: "supabase-items" } },
      { label: "no", to: { note: "500 → toast 'Could not save'" } },
    ],
  },
];
