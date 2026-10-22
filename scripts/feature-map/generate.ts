// Feature-map generator.
//
// What it does, in plain words:
//   1. Finds every page in src/app (each page.tsx file is one route) and the
//      components it renders, and reads them with scan.ts: every interactive
//      element (label, kind, data-testid, section, "shown when"), where clicks
//      navigate, redirect guards and fetch("/api/...") calls.
//   2. Finds the API routes in src/app/api and which data sources they reach
//      (Gemini, Supabase, curated CSVs, mocks), using the detectors in
//      annotations.ts.
//   3. Writes routes.generated.json (all of the above) and Mermaid diagrams:
//        feature-map.mmd         overview: every page, its test-id elements,
//                                the journey, guards, APIs and data sources
//        pages/<page>.mmd        one detail diagram per page with every element
//      and renders each to .png (high resolution) and .svg with mermaid-cli.
//
// Hand-written facts (decisions inside handlers, data sources, human names for
// conditions) live in annotations.ts; --check validates them against the code.
//
// Usage:
//   npx tsx scripts/feature-map/generate.ts              # regenerate + render PNG/SVG
//   npx tsx scripts/feature-map/generate.ts --no-render  # regenerate text files only
//   npx tsx scripts/feature-map/generate.ts --check      # fail if anything is stale
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ACTIONS, CONDITIONS, DATA_SOURCES, DECISIONS, EFFECTS, JOURNEY, LABELS, PAGE_TITLES, type Target } from "./annotations";
import { apiCalls, scanElements, scanGuards, type Guard, type UiElement } from "./scan";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP_DIR = path.join(ROOT, "src/app");
const SRC_DIR = path.join(ROOT, "src");
export const MAP_DIR = path.join(ROOT, ".claude/skills/laluan-feature-map");
const PAGES_DIR = path.join(MAP_DIR, "pages");
const JSON_FILE = path.join(MAP_DIR, "routes.generated.json");
const OVERVIEW_MMD = path.join(MAP_DIR, "feature-map.mmd");
const HAND_MAP = path.join(MAP_DIR, "feature-map.md");

// Small helper: list every file under a folder (recursively).
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// Path relative to the repo, always with "/" so output is the same on Windows.
const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const read = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");

// "src/app/profile/page.tsx" -> "/profile"; "src/app/page.tsx" -> "/".
// Route groups like "(marketing)" do not appear in the URL, so we drop them.
export function fileToRoute(file: string): string {
  const parts = path.relative(APP_DIR, path.dirname(file)).split(path.sep).filter(Boolean);
  const visible = parts.filter((p) => !(p.startsWith("(") && p.endsWith(")")));
  return "/" + visible.join("/");
}

// Resolve an "@/x/y" import to a file, or undefined.
function resolveAlias(spec: string): string | undefined {
  const base = path.join(SRC_DIR, spec);
  return [".tsx", ".ts", "/index.ts"].map((ext) => base + ext).find((f) => fs.existsSync(f));
}
const aliasImports = (file: string) => [...read(file).matchAll(/from "@\/([\w\-/]+)"/g)].map((m) => m[1]);

// The page file plus every "@/components/..." it renders (recursively).
// ui/ primitives and motion helpers are generic wrappers, not features.
function componentFiles(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  for (const spec of aliasImports(file)) {
    if (!spec.startsWith("components/") || spec.startsWith("components/ui/") || spec === "components/motion") continue;
    const found = resolveAlias(spec);
    if (found) componentFiles(found, seen);
  }
  return [...seen];
}

// Non-component modules (lib, context, mocks) imported by these files.
// `deep` follows their imports too (used for API routes).
function libFiles(files: string[], deep: boolean): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    for (const spec of aliasImports(file)) {
      if (spec.startsWith("components/")) continue;
      const found = resolveAlias(spec);
      if (found && !seen.has(found)) {
        seen.add(found);
        if (deep) visit(found);
      }
    }
  };
  files.forEach(visit);
  return [...seen].filter((f) => !f.includes(".test."));
}

const detectSources = (text: string) => DATA_SOURCES.filter((s) => new RegExp(s.detect).test(text)).map((s) => s.id);

export type RouteInfo = {
  route: string;
  file: string;
  testIds: string[];
  linksTo: string[];
  guards: Guard[];
  apiCalls: string[];
  dataSources: string[];
  elements: UiElement[];
};

export type GeneratedMap = {
  note: string;
  routes: RouteInfo[];
  global: RouteInfo;
  apiRoutes: { route: string; file: string; methods: string[]; dataSources: string[] }[];
};

// Everything we know about one page (or the layout), from its files.
function describe(route: string, entry: string): RouteInfo {
  const files = componentFiles(entry);
  const elements = files.flatMap((f) => scanElements(f, rel(f), SRC_DIR));
  const deps = libFiles(files, false);
  const text = [...files, ...deps].map(read).join("\n");
  const own = files.map(read).join("\n");
  return {
    route,
    file: rel(entry),
    testIds: [...new Set(elements.flatMap((e) => (e.testId ? [e.testId] : [])))].sort(),
    linksTo: [...new Set(elements.flatMap((e) => e.navigatesTo))].filter((t) => t !== route).sort(),
    guards: files.flatMap((f) => scanGuards(read(f), rel(f))),
    apiCalls: [...new Set(apiCalls(text))].sort(),
    dataSources: detectSources(own + "\n" + deps.map(read).join("\n")),
    elements,
  };
}

// Build the whole generated map in memory (no files written here).
export function buildMap(): GeneratedMap {
  const all = walk(APP_DIR);
  const routes = all
    .filter((f) => path.basename(f) === "page.tsx")
    .map((page) => describe(fileToRoute(page), page))
    .sort((a, b) => a.route.localeCompare(b.route));
  const apiRoutes = all
    .filter((f) => path.basename(f) === "route.ts")
    .map((file) => ({
      route: fileToRoute(file),
      file: rel(file),
      methods: [...read(file).matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]),
      dataSources: detectSources([file, ...libFiles([file], true)].map(read).join("\n")),
    }))
    .sort((a, b) => a.route.localeCompare(b.route));
  // The layout (site header) is on every page, so it is listed once as "global".
  return {
    note: "GENERATED by scripts/feature-map/generate.ts. Do not edit by hand; run npm run feature-map:render.",
    routes,
    global: describe("header", path.join(APP_DIR, "layout.tsx")),
    apiRoutes,
  };
}

// ---------------------------------------------------------------------------
// Mermaid output
// ---------------------------------------------------------------------------

// Colours: one class per kind of node. Shared by every diagram.
const CLASS_DEFS = [
  "classDef page fill:#1e3a5f,stroke:#0f2540,color:#ffffff,font-weight:bold",
  "classDef el fill:#e8f1ff,stroke:#2b6cb0,color:#102a43",
  "classDef plain fill:#f7f7f7,stroke:#9aa5b1,color:#334e68",
  "classDef journey fill:#fff1d6,stroke:#d97706,stroke-width:3px,color:#7c2d12",
  "classDef decision fill:#fff7cc,stroke:#b7950b,color:#5c4400",
  "classDef guard fill:#fde2e2,stroke:#c53030,color:#742a2a",
  "classDef api fill:#d5f5f0,stroke:#2c7a7b,color:#134e4a",
  "classDef ai fill:#f3e8ff,stroke:#7c3aed,color:#4c1d95",
  "classDef db fill:#dcfce7,stroke:#15803d,color:#14532d",
  "classDef mock fill:#f1f5f9,stroke:#64748b,stroke-dasharray:5 4,color:#334155",
  "classDef file fill:#fef3c7,stroke:#b45309,color:#78350f",
  "classDef browser fill:#e0e7ff,stroke:#4338ca,color:#312e81",
  "classDef note fill:#ffffff,stroke:#94a3b8,stroke-dasharray:4 3,color:#475569",
];

// Edge styles, applied by index with linkStyle.
const EDGE_STYLE = {
  journey: "stroke:#d97706,stroke-width:4px",
  nav: "stroke:#2b6cb0,stroke-width:2px",
  guard: "stroke:#c53030,stroke-width:2px,stroke-dasharray:6 4",
  data: "stroke:#2c7a7b,stroke-width:1.5px,stroke-dasharray:3 3",
  effect: "stroke:#94a3b8,stroke-width:1.5px,stroke-dasharray:2 3",
  inner: "stroke:#64748b,stroke-width:1.5px",
  layout: "stroke-width:0px", // invisible: only stacks sections top to bottom
};
type EdgeKind = keyof typeof EDGE_STYLE;

// Mermaid label text: escape quotes and angle brackets, keep our <br/> and <b>.
const esc = (s: string) =>
  s.replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/#lt;(\/?)(br|b|i|small)(\/?)#gt;/g, "<$1$2$3>");
const slug = (route: string) => (route === "/" ? "home" : route.replace(/^\//, "").replace(/\W/g, "_"));
const PER_ROW = 4; // elements per row inside a section
const human = (cond: string) => CONDITIONS[cond] ?? cond;

/** Small builder that numbers edges so we can colour them with linkStyle. */
class Diagram {
  lines: string[] = [];
  private edges: EdgeKind[] = [];
  private declared = new Set<string>();
  /** API routes already drawn with their decisions and data edges. */
  apis = new Set<string>();
  constructor(title: string) {
    // Front matter must come first, so the "generated" comment goes after it.
    this.lines.push("---", `title: "${title.replace(/"/g, "'")}"`, "---", "flowchart TB");
    this.lines.push("  %% GENERATED by scripts/feature-map/generate.ts. Do not edit by hand.");
  }
  add(line: string) {
    this.lines.push("  " + line);
  }
  node(id: string, shape: string, cls: string) {
    if (this.declared.has(id)) return;
    this.declared.add(id);
    this.add(`${id}${shape}:::${cls}`);
  }
  edge(from: string, to: string, kind: EdgeKind, label?: string) {
    const arrow = kind === "journey" ? "==>" : kind === "layout" ? "~~~" : kind === "nav" || kind === "inner" ? "-->" : "-.->";
    this.add(`${from} ${arrow}${label ? `|"${esc(label)}"|` : ""} ${to}`);
    this.edges.push(kind);
  }
  text() {
    const styles = this.edges.map((k, i) => `  linkStyle ${i} ${EDGE_STYLE[k]}`);
    return [...this.lines, ...CLASS_DEFS.map((c) => "  " + c), ...styles].join("\n") + "\n";
  }
}

// Node shapes by kind (Mermaid syntax).
const shapes = {
  page: (t: string) => `(["${esc(t)}"])`,
  el: (t: string) => `["${esc(t)}"]`,
  decision: (t: string) => `{"${esc(t)}"}`,
  api: (t: string) => `{{"${esc(t)}"}}`,
  db: (t: string) => `[("${esc(t)}")]`,
  ai: (t: string) => `[["${esc(t)}"]]`,
  mock: (t: string) => `[/"${esc(t)}"/]`,
  file: (t: string) => `[("${esc(t)}")]`,
  browser: (t: string) => `[("${esc(t)}")]`,
  note: (t: string) => `>"${esc(t)}"]`,
};

function elementLabel(e: UiElement): string {
  return (e.testId && LABELS[e.testId]) || LABELS[e.component] || e.label;
}

function elementText(e: UiElement, detailed: boolean): string {
  // A heading the section title does not already show, e.g. "Hours a week: 4 / 6 / 10 / 15 h".
  const groupedByCondition = detailed && e.shownWhen && CONDITIONS[e.shownWhen];
  const heading = groupedByCondition && e.group ? `${e.group}: ` : "";
  const lines = [`${heading}<b>${elementLabel(e)}</b>${e.repeated ? " ×N" : ""}`];
  lines.push(`<small>${e.kind}${e.testId ? ` · ${e.testId}` : ""}</small>`);
  if (detailed && e.shownWhen && !CONDITIONS[e.shownWhen]) lines.push(`<small>shown: ${human(e.shownWhen)}</small>`);
  if (detailed && e.disabledWhen) lines.push(`<small>disabled: ${human(e.disabledWhen)}</small>`);
  return lines.join("<br/>");
}

const elClass = (e: UiElement) => (e.testId && JOURNEY.includes(e.testId) ? "journey" : e.testId ? "el" : "plain");
const actionFor = (e: UiElement) => (e.testId && ACTIONS[e.testId]) || `click ${elementLabel(e).split(" / ")[0]}`;
const dataSource = (id: string) => DATA_SOURCES.find((s) => s.id === id)!;

/**
 * Draw one page as a subgraph: entry node, guards, sections with elements,
 * and the edges leaving it. `detailed` shows every element; otherwise only
 * test-id or navigating ones (the overview).
 */
function drawPage(d: Diagram, map: GeneratedMap, info: RouteInfo, detailed: boolean, pageNode: (route: string) => string) {
  const s = slug(info.route);
  const entry = pageNode(info.route);
  const isHeader = info.route === "header";
  d.add(`subgraph ${s}_page["${esc(isHeader ? "Site header (every page) · layout.tsx" : `${info.route} · ${PAGE_TITLES[info.route] ?? ""}`)}"]`);
  d.add("direction TB");
  // In the overview, guards and browser state are written on the entry node
  // instead of drawn as arrows, so the big picture stays uncluttered.
  const entryText = [isHeader ? "Site header" : `Open ${info.route}`];
  if (!detailed) {
    for (const g of info.guards) entryText.push(`<small>${human(g.condition)} → ${g.redirectTo}</small>`);
    if (info.dataSources.includes("session")) entryText.push("<small>state: sessionStorage</small>");
  }
  d.node(entry, shapes.page(entryText.join("<br/>")), "page");

  // Redirect guards found in the code: a chain of red diamonds after the entry.
  let prev = entry;
  const guards = detailed ? info.guards : [];
  guards.forEach((g, i) => {
    const id = `${s}_guard${i}`;
    d.node(id, shapes.decision(human(g.condition)), "guard");
    d.edge(prev, id, "inner", i === 0 ? "on load" : "no");
    prev = id;
  });

  // Elements grouped by section.
  const visible = info.elements
    .map((e, i) => ({ e, id: `${s}_e${i}` }))
    .filter(({ e }) => detailed || e.testId || e.navigatesTo.length);
  // Section title: component · heading. Elements behind a named condition
  // (e.g. "Q2 · task shares") are grouped by that condition instead, and keep
  // their own heading in the node text (see elementText).
  const sectionName = (e: UiElement) => {
    if (e.shownWhen && CONDITIONS[e.shownWhen] && detailed) return `${e.component} · ${human(e.shownWhen)}`;
    const heading = e.section.startsWith("when ") ? human(e.section.slice(5)) : e.section;
    return heading === e.component ? e.component : `${e.component} · ${heading}`;
  };
  const sections = [...new Set(visible.map(({ e }) => sectionName(e)))];
  const firstAndLast: [string, string][] = [];
  sections.forEach((sec, si) => {
    const members = visible.filter(({ e }) => sectionName(e) === sec);
    d.add(`subgraph ${s}_s${si}["${esc(sec)}"]`);
    d.add("direction TB");
    for (const { e, id } of members) d.node(id, shapes.el(elementText(e, detailed)), elClass(e));
    d.add("end");
    d.add(`style ${s}_s${si} fill:#fbfcfe,stroke:#cbd5e1,color:#1e293b`);
    firstAndLast.push([members[0].id, members.at(-1)!.id]);
    // Wrap long sections into rows of PER_ROW so a page never becomes one endless line.
    for (let i = 0; i + PER_ROW < members.length; i++) d.edge(members[i].id, members[i + PER_ROW].id, "layout");
  });
  // Stack sections in source order (invisible links), so pages grow downwards, not sideways.
  for (let i = 0; i + 1 < firstAndLast.length; i++) d.edge(firstAndLast[i][0], firstAndLast[i + 1][0], "layout");
  // Entry (or the last guard's "no") leads into the page: first journey element, else first element.
  const firstJourney = JOURNEY.map((t) => visible.find(({ e }) => e.testId === t)).find(Boolean);
  // Detail pages read top-down from the first section; the overview jumps to the journey.
  const first = detailed ? visible[0] : (firstJourney ?? visible[0]);
  if (first) d.edge(prev, first.id, "inner", guards.length ? "no · page shows" : "page shows");
  if (!detailed) {
    const hidden = info.elements.length - visible.length;
    if (hidden > 0) d.node(`${s}_more`, shapes.note(`+${hidden} more controls<br/>see pages/${s}.png`), "note");
  }
  d.add("end");
  d.add(`style ${s}_page fill:#f8fafc,stroke:#1e3a5f,stroke-width:2px,color:#0f172a`);

  // Edges leaving the page.
  guards.forEach((g, i) => d.edge(`${s}_guard${i}`, pageNode(g.redirectTo), "guard", "yes → redirect"));
  const byTestId = new Map(visible.filter(({ e }) => e.testId).map(({ e, id }) => [e.testId!, id]));
  const decided = new Set(DECISIONS.filter((x) => x.route === info.route).map((x) => x.from));
  for (const { e, id } of visible) {
    const kind: EdgeKind = e.testId && JOURNEY.includes(e.testId) ? "journey" : "nav";
    if (!decided.has(e.testId ?? "")) for (const t of e.navigatesTo) d.edge(id, pageNode(t), kind, actionFor(e));
    for (const api of e.callsApi) d.edge(id, `api_${slug(api)}`, "data", `${actionFor(e)} · fetch`);
    if (detailed && e.testId && EFFECTS[e.testId]) {
      d.node(`${id}_fx`, shapes.note(EFFECTS[e.testId]), "note");
      d.edge(id, `${id}_fx`, kind === "journey" ? "journey" : "effect", e.testId === "landing-consent" ? actionFor(e) : undefined);
    }
  }
  // The journey also moves through an element with no navigation of its own
  // (e.g. a persona card): link it to the next journey element on this page.
  const journeyHere = JOURNEY.filter((t) => byTestId.has(t));
  for (let i = 0; i + 1 < journeyHere.length; i++) {
    const from = byTestId.get(journeyHere[i])!;
    const fromEl = visible.find((v) => v.id === from)!.e;
    const viaEffect = detailed && EFFECTS[journeyHere[i]];
    if (!fromEl.navigatesTo.length && !viaEffect) d.edge(from, byTestId.get(journeyHere[i + 1])!, "journey", actionFor(fromEl));
    if (viaEffect) d.edge(`${from}_fx`, byTestId.get(journeyHere[i + 1])!, "journey", "then");
  }
  drawDecisions(d, info.route, (testId) => byTestId.get(testId), entry, pageNode, detailed);

  // Data: API calls made on load, and sources read directly by the page.
  for (const api of info.apiCalls) if (!visible.some(({ e }) => e.callsApi.includes(api))) d.edge(entry, `api_${slug(api)}`, "data", `POST ${api}`);
  const reads = info.dataSources.filter((src) => detailed || src !== "session");
  for (const src of reads) d.edge(entry, `ds_${src}`, "data", "reads");
  for (const api of info.apiCalls) drawApi(d, map, api, pageNode);
  for (const src of reads) drawSource(d, src);
}

function drawSource(d: Diagram, id: string) {
  const src = dataSource(id);
  d.node(`ds_${id}`, shapes[src.kind](src.label), src.kind);
}

function drawApi(d: Diagram, map: GeneratedMap, api: string, pageNode: (route: string) => string) {
  const info = map.apiRoutes.find((a) => a.route === api);
  if (!info || d.apis.has(api)) return;
  d.apis.add(api);
  const id = `api_${slug(api)}`;
  d.node(id, shapes.api(`${info.methods.join(" / ")} ${api}<br/><small>${info.file}</small>`), "api");
  const decided = DECISIONS.filter((x) => x.route === api);
  drawDecisions(d, api, () => undefined, id, pageNode);
  const viaDecision = new Set(decided.flatMap((x) => x.branches.flatMap((b) => ("data" in b.to ? [b.to.data] : []))));
  for (const src of info.dataSources) {
    drawSource(d, src);
    if (!viaDecision.has(src)) d.edge(id, `ds_${src}`, "data", "reads");
  }
}

// Hand-written decisions (annotations.ts) as yellow diamonds.
// The overview skips a page's own on-load decisions (see the page detail).
function drawDecisions(
  d: Diagram,
  route: string,
  elementId: (testId: string) => string | undefined,
  entry: string,
  pageNode: (r: string) => string,
  detailed = true,
) {
  DECISIONS.filter((x) => x.route === route).forEach((x, i) => {
    if (!detailed && x.from === "load" && !route.startsWith("/api")) return;
    const from = x.from === "load" ? entry : elementId(x.from);
    if (!from) return;
    const id = `${slug(route)}_dec${i}`;
    const journey = JOURNEY.includes(x.from);
    d.node(id, shapes.decision(x.question), "decision");
    d.edge(from, id, journey ? "journey" : x.from === "load" ? "data" : "nav", x.from === "load" ? (route.startsWith("/api") ? "runs" : "on load") : ACTIONS[x.from]);
    x.branches.forEach((b, j) => {
      const to = targetNode(d, b.to, `${id}_b${j}`, elementId, pageNode);
      if (!to) return;
      const isJourney = journey && "route" in b.to;
      d.edge(id, to, isJourney ? "journey" : "data" in b.to ? "data" : "nav", b.label);
    });
  });
}

function targetNode(d: Diagram, t: Target, noteId: string, elementId: (testId: string) => string | undefined, pageNode: (r: string) => string) {
  if ("route" in t) return pageNode(t.route);
  if ("testId" in t) return elementId(t.testId);
  if ("data" in t) {
    drawSource(d, t.data);
    return `ds_${t.data}`;
  }
  d.node(noteId, shapes.note(t.note), "note");
  return noteId;
}

// A legend explaining every shape, colour and edge style.
function drawLegend(d: Diagram) {
  d.add('subgraph legend["Legend"]');
  d.add("direction LR");
  d.node("lg_page", shapes.page("Page / entry"), "page");
  d.node("lg_journey", shapes.el("<b>Main journey element</b><br/><small>kind · data-testid</small>"), "journey");
  d.node("lg_el", shapes.el("<b>Element with test id</b>"), "el");
  d.node("lg_plain", shapes.el("<b>Element without test id</b>"), "plain");
  d.node("lg_guard", shapes.decision("Redirect guard (from code)"), "guard");
  d.node("lg_dec", shapes.decision("Decision (annotations.ts)"), "decision");
  d.node("lg_api", shapes.api("API route"), "api");
  d.node("lg_ai", shapes.ai("AI provider"), "ai");
  d.node("lg_db", shapes.db("Database table"), "db");
  d.node("lg_file", shapes.file("Curated data file"), "file");
  d.node("lg_browser", shapes.browser("Browser storage"), "browser");
  d.node("lg_mock", shapes.mock("Mock data"), "mock");
  d.node("lg_note", shapes.note("Outcome / side effect"), "note");
  d.node(
    "lg_edges",
    shapes.el(
      "<b>Arrows</b><br/>thick orange = main journey<br/>blue = click → navigate<br/>red dashed = guard redirect<br/>teal dotted = data / API call",
    ),
    "plain",
  );
  d.add("end");
  d.add("style legend fill:#ffffff,stroke:#94a3b8,color:#0f172a");
}

/** Overview: every page as a subgraph with its key elements, plus APIs and data. */
export function toMermaid(map: GeneratedMap): string {
  const d = new Diagram("Laluan feature map: overview (details per page in pages/)");
  const pageNode = (route: string) => `${slug(route)}_in`;
  drawLegend(d);
  // All APIs and data sources sit together in one box (declared first so they land in it).
  d.add('subgraph data["Data sources & API routes"]');
  d.add("direction LR");
  for (const a of map.apiRoutes) d.node(`api_${slug(a.route)}`, shapes.api(`${a.methods.join(" / ")} ${a.route}<br/><small>${a.file}</small>`), "api");
  for (const src of DATA_SOURCES) d.node(`ds_${src.id}`, shapes[src.kind](src.label), src.kind);
  d.add("end");
  d.add("style data fill:#f0fdfa,stroke:#2c7a7b,stroke-width:2px,color:#134e4a");
  // Order pages along the journey first, side pages after, so the main path runs top to bottom.
  const journeyRoutes = JOURNEY.map((t) => map.routes.find((r) => r.testIds.includes(t))?.route);
  const order = (r: RouteInfo) => journeyRoutes.indexOf(r.route) + 1 || 99;
  const routes = [...map.routes].sort((a, b) => order(a) - order(b));
  for (const r of routes) drawPage(d, map, r, false, pageNode);
  drawPage(d, map, map.global, false, pageNode);
  // The /demo page calls APIs from buttons; draw those API nodes too.
  for (const r of [map.global, ...map.routes]) for (const e of r.elements) for (const api of e.callsApi) drawApi(d, map, api, pageNode);
  return d.text();
}

/** Detail: one page with every element; other pages are small entry nodes. */
export function toPageMermaid(map: GeneratedMap, info: RouteInfo): string {
  const title = info.route === "header" ? "Site header (every page)" : `${info.route} · ${PAGE_TITLES[info.route] ?? ""}`;
  const d = new Diagram(`Laluan feature map: ${title}`);
  const pageNode = (route: string) => {
    const id = `${slug(route)}_in`;
    if (route !== info.route) d.node(id, shapes.page(`→ ${route}`), "page");
    return id;
  };
  drawPage(d, map, info, true, pageNode);
  for (const e of info.elements) for (const api of e.callsApi) drawApi(d, map, api, pageNode);
  drawLegend(d);
  return d.text();
}

/** All diagram files we generate: path -> Mermaid text. */
export function diagrams(map: GeneratedMap): Map<string, string> {
  const out = new Map([[OVERVIEW_MMD, toMermaid(map)]]);
  for (const r of [map.global, ...map.routes]) out.set(path.join(PAGES_DIR, `${slug(r.route)}.mmd`), toPageMermaid(map, r));
  return out;
}

// ---------------------------------------------------------------------------
// --check
// ---------------------------------------------------------------------------

// Problems that make --check fail. Empty list = everything is up to date.
export function findProblems(map: GeneratedMap): string[] {
  const problems: string[] = [];
  if (read(JSON_FILE) !== JSON.stringify(map, null, 2) + "\n") problems.push(`${rel(JSON_FILE)} is stale`);
  for (const [file, text] of diagrams(map)) {
    if (read(file) !== text) problems.push(`${rel(file)} is stale`);
    for (const ext of [".png", ".svg"]) {
      if (!fs.existsSync(file.replace(/\.mmd$/, ext))) problems.push(`${rel(file.replace(/\.mmd$/, ext))} is missing`);
    }
  }

  // The hand-written map must mention every route as `### Route: /x`
  // and every test id in backticks, so new UI never goes undocumented.
  const hand = read(HAND_MAP);
  for (const r of map.routes) {
    if (!hand.includes(`### Route: \`${r.route}\``)) problems.push(`route ${r.route} is not documented in feature-map.md`);
  }
  const all = [map.global, ...map.routes];
  const allIds = new Set(all.flatMap((r) => r.testIds));
  for (const testId of allIds) {
    if (!hand.includes(`\`${testId}\``)) problems.push(`data-testid ${testId} is not documented in feature-map.md`);
  }

  // annotations.ts must point at things that exist.
  const routes = new Set([...map.routes.map((r) => r.route), ...map.apiRoutes.map((a) => a.route)]);
  const components = new Set(all.flatMap((r) => r.elements.map((e) => e.component)));
  const sources = new Set(DATA_SOURCES.map((s) => s.id));
  const bad = (what: string) => problems.push(`annotations.ts: ${what}`);
  for (const id of [...JOURNEY, ...Object.keys(ACTIONS), ...Object.keys(EFFECTS)]) if (!allIds.has(id)) bad(`unknown test id ${id}`);
  for (const key of Object.keys(LABELS)) if (!allIds.has(key) && !components.has(key)) bad(`LABELS key ${key} is not a test id or component`);
  for (const route of Object.keys(PAGE_TITLES)) if (!routes.has(route)) bad(`PAGE_TITLES route ${route} does not exist`);
  for (const r of map.routes) if (!PAGE_TITLES[r.route]) bad(`page ${r.route} has no PAGE_TITLES entry`);
  for (const s of DATA_SOURCES) if (!map.apiRoutes.some((a) => a.dataSources.includes(s.id)) && !all.some((r) => r.dataSources.includes(s.id))) bad(`data source ${s.id} matches no code`);
  for (const x of DECISIONS) {
    if (!routes.has(x.route)) bad(`decision route ${x.route} does not exist`);
    if (x.from !== "load" && !allIds.has(x.from)) bad(`decision from unknown test id ${x.from}`);
    for (const b of x.branches) {
      if ("route" in b.to && !routes.has(b.to.route)) bad(`decision branch to unknown route ${b.to.route}`);
      if ("testId" in b.to && !allIds.has(b.to.testId)) bad(`decision branch to unknown test id ${b.to.testId}`);
      if ("data" in b.to && !sources.has(b.to.data)) bad(`decision branch to unknown data source ${b.to.data}`);
    }
    // A decision on a click replaces its plain arrows, so it must cover every place the click can go.
    const el = all.flatMap((r) => r.elements).find((e) => e.testId === x.from);
    for (const t of el?.navigatesTo ?? []) {
      if (!x.branches.some((b) => "route" in b.to && b.to.route === t)) bad(`decision on ${x.from} misses its navigation to ${t}`);
    }
  }
  for (const r of all) for (const g of r.guards) if (!CONDITIONS[g.condition]) bad(`guard condition "${g.condition}" (${g.file}) has no CONDITIONS label`);
  return [...new Set(problems)];
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

// Render every .mmd to a 2x .png and an .svg with mermaid-cli, reusing
// Playwright's Chromium so we do not need a second browser download.
async function render(files: string[]) {
  const { chromium } = await import("@playwright/test");
  const puppeteer = path.join(os.tmpdir(), "feature-map-puppeteer.json");
  fs.writeFileSync(puppeteer, JSON.stringify({ executablePath: chromium.executablePath(), args: ["--no-sandbox"] }));
  // Big fonts, roomy spacing, no shrink-to-fit: text stays legible when zoomed.
  const config = path.join(os.tmpdir(), "feature-map-mermaid.json");
  fs.writeFileSync(
    config,
    JSON.stringify({
      theme: "base",
      themeVariables: { fontSize: "18px", fontFamily: "Inter, Arial, 'Noto Sans CJK SC', sans-serif", primaryColor: "#e8f1ff" },
      flowchart: { useMaxWidth: false, htmlLabels: true, nodeSpacing: 36, rankSpacing: 56, padding: 14, wrappingWidth: 280, curve: "basis" },
    }),
  );
  const mmdc = path.join(ROOT, "node_modules/.bin/mmdc");
  for (const file of files) {
    for (const [ext, extra] of [[".png", ["-s", "2"]], [".svg", []]] as const) {
      const args = ["-i", file, "-o", file.replace(/\.mmd$/, ext), "-p", puppeteer, "-c", config, "-b", "white", "-q", ...extra];
      execFileSync(mmdc, args, { stdio: ["ignore", "ignore", "inherit"] });
    }
    console.log(`Rendered ${rel(file).replace(/\.mmd$/, ".png")} (+ .svg)`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const map = buildMap();
  if (args.includes("--check")) {
    const problems = findProblems(map);
    if (problems.length) {
      console.error("Feature map is out of date:\n- " + problems.join("\n- "));
      console.error("Fix: document new routes/test ids in feature-map.md, update annotations.ts, then run npm run feature-map:render");
      process.exit(1);
    }
    console.log(`Feature map OK (${map.routes.length} routes, ${map.apiRoutes.length} API routes).`);
    return;
  }
  fs.mkdirSync(PAGES_DIR, { recursive: true });
  // Drop diagrams of pages that no longer exist.
  const wanted = diagrams(map);
  for (const f of fs.readdirSync(PAGES_DIR)) {
    const mmd = path.join(PAGES_DIR, f.replace(/\.(png|svg)$/, ".mmd"));
    if (!wanted.has(mmd)) fs.rmSync(path.join(PAGES_DIR, f));
  }
  fs.writeFileSync(JSON_FILE, JSON.stringify(map, null, 2) + "\n");
  for (const [file, text] of wanted) fs.writeFileSync(file, text);
  console.log(`Wrote ${rel(JSON_FILE)} and ${wanted.size} .mmd diagrams`);
  if (!args.includes("--no-render")) await render([...wanted.keys()]);
}

// Only run main() when called from the command line, not when a test imports us.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
