// Code scanner for the feature map. Reads .tsx/.ts files with the TypeScript
// parser (no regex guessing on JSX) and pulls out the facts the diagrams need:
//
//   - interactive elements (buttons, links, inputs, tabs, toggles, chips...)
//     with a human label, kind, data-testid, section and "only shown when"
//   - where each element navigates (router.push / href), following the click
//     handler into local functions
//   - redirect guards: `if (cond) router.replace("/x")`
//   - API calls: fetch("/api/...")
//
// Everything here is pure: it takes file paths and returns plain objects.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export type ElementKind =
  | "button"
  | "link"
  | "input"
  | "textarea"
  | "file picker"
  | "slider"
  | "checkbox"
  | "tab"
  | "radio card"
  | "toggle";

export type UiElement = {
  label: string;
  kind: ElementKind;
  testId?: string;
  component: string; // enclosing React component, e.g. "RoleCard"
  section: string; // nearest heading / labelled group / JSX comment
  group?: string; // set when the section came from a labelled group (<ChipRow label>, role="group")
  shownWhen?: string; // condition from `{cond && <el/>}` or `cond ? <el/> : ...`
  disabledWhen?: string;
  repeated: boolean; // rendered inside .map(): one per item
  navigatesTo: string[];
  callsApi: string[];
  file: string;
  line: number;
};

export type Guard = { condition: string; redirectTo: string; file: string };

// Tags that are interactive on their own. Anything else counts only if it
// has an onClick (e.g. a <div role="radio" onClick>).
const INTERACTIVE_TAGS = new Set(["button", "Button", "a", "Link", "input", "Input", "textarea", "Textarea", "select", "Chip"]);
// Wrapper components whose `label` prop names the group of elements inside.
const LABELLED_GROUPS = new Set(["ChipRow"]);

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

// Attribute value as source text: "x" -> x, {expr} -> expr. Undefined if absent;
// "" for boolean attributes like `compact`.
function attr(node: ts.JsxOpeningLikeElement, name: string): string | undefined {
  for (const prop of node.attributes.properties) {
    if (!ts.isJsxAttribute(prop) || prop.name.getText() !== name) continue;
    const init = prop.initializer;
    if (!init) return "";
    if (ts.isStringLiteral(init)) return init.text;
    if (ts.isJsxExpression(init) && init.expression) {
      const e = init.expression;
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
      if (ts.isTemplateExpression(e)) return e.getText().slice(1, -1); // keep ${...} for now
      return e.getText();
    }
  }
  return undefined;
}

type Consts = Map<string, ts.ArrayLiteralExpression | ts.ObjectLiteralExpression>;

/**
 * Top-level `const X = [{ label: "EN" }, ...]` arrays and `const L = { en: "EN" }`
 * maps, in this file and in the "@/..." modules it imports, so `{x.label}`
 * inside X.map can be shown as "EN / BM / 中文".
 */
function constArrays(sf: ts.SourceFile, srcDir: string, followImports = true): Consts {
  const out: Consts = new Map();
  for (const stmt of sf.statements) {
    if (followImports && ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const spec = stmt.moduleSpecifier.text;
      const base = spec.startsWith("@/") ? path.join(srcDir, spec.slice(2)) : "";
      const file = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find((f) => base && fs.existsSync(f));
      if (file) {
        const other = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        for (const [name, value] of constArrays(other, srcDir, false)) out.set(name, value);
      }
    }
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      let init = decl.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) init = init.expression;
      if (init && (ts.isArrayLiteralExpression(init) || ts.isObjectLiteralExpression(init))) out.set(decl.name.getText(), init);
    }
  }
  return out;
}

// Values of one property across an array of object literals: ["EN","BM","中文"].
function propValues(arr: ts.ArrayLiteralExpression | ts.ObjectLiteralExpression, prop: string): string[] {
  if (ts.isObjectLiteralExpression(arr)) return [];
  return arr.elements.flatMap((el) => {
    if (!ts.isObjectLiteralExpression(el)) return ts.isStringLiteral(el) || ts.isNumericLiteral(el) ? [el.text] : [];
    const p = el.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText() === prop);
    if (!p || !ts.isPropertyAssignment(p)) return [];
    const v = p.initializer;
    return ts.isStringLiteral(v) || ts.isNumericLiteral(v) ? [v.text] : [];
  });
}

/** `ARR.map((item) => ...)` around this node: returns { array, param }. */
function enclosingMap(node: ts.Node): { array: string; param: string } | undefined {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isArrowFunction(n) && ts.isCallExpression(n.parent) && ts.isPropertyAccessExpression(n.parent.expression)) {
      const call = n.parent.expression;
      if (call.name.getText() === "map") return { array: call.expression.getText(), param: n.parameters[0]?.name.getText() ?? "" };
    }
  }
  return undefined;
}

// Visible text of an element: literal JSX text, string literals, both branches
// of `a ? "X" : "Y"`, and `{item.label}` resolved through a const array.
function childText(node: ts.Node, arrays: Consts): string {
  const parts: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) parts.push(n.getText());
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) parts.push(n.text);
    else if (ts.isTemplateExpression(n)) parts.push(`‹${n.getText().slice(1, -1)}›`);
    else if (ts.isJsxExpression(n) && n.expression) {
      const e = n.expression;
      if (ts.isConditionalExpression(e)) {
        const branches = [e.whenTrue, e.whenFalse].map((b) => childText(b, arrays)).filter(Boolean);
        parts.push(branches.join(" / "));
      } else if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        visit(e.right);
      } else if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) || ts.isIdentifier(e)) {
        const map = enclosingMap(n);
        const arr = map && arrays.get(map.array);
        let values: string[] = [];
        if (arr && ts.isPropertyAccessExpression(e) && e.expression.getText() === map.param) values = propValues(arr, e.name.getText());
        if (arr && ts.isIdentifier(e) && e.text === map.param) values = propValues(arr, "");
        // `LABELS[x]` where LABELS is a const { key: "Text" } map: list its values.
        const lookup = ts.isElementAccessExpression(e) ? arrays.get(e.expression.getText()) : undefined;
        if (lookup && ts.isObjectLiteralExpression(lookup)) {
          values = lookup.properties.flatMap((p) => (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer) ? [p.initializer.text] : []));
        }
        parts.push(values.length ? values.join(" / ") : `‹${e.getText()}›`);
      } else ts.forEachChild(e, visit);
    } else if (ts.isJsxElement(n)) {
      n.children.forEach(visit); // children only: attributes are not visible text
    } else if (ts.isJsxFragment(n) || ts.isParenthesizedExpression(n)) {
      ts.forEachChild(n, visit);
    }
    // anything else (self-closing icons, attributes) carries no text
  };
  if (ts.isJsxElement(node)) node.children.forEach(visit);
  else visit(node);
  return squash(parts.join(" ")).slice(0, 60);
}

function kindOf(tag: string, opening: ts.JsxOpeningLikeElement): ElementKind {
  const role = attr(opening, "role");
  const type = attr(opening, "type");
  if (role === "checkbox") return "checkbox";
  if (role === "tab") return "tab";
  if (role === "radio") return "radio card";
  if (tag === "input" && type === "file") return "file picker";
  if (tag === "input" && type === "range") return "slider";
  if (tag === "input") return "input";
  if (tag === "textarea" || tag === "Textarea") return "textarea";
  if (tag === "a" || tag === "Link") return "link";
  if (attr(opening, "aria-pressed") !== undefined || tag === "Chip") return "toggle";
  return "button";
}

// Innermost `{cond && <el/>}` or `cond ? <el/> : <other/>` around the element.
function shownWhen(node: ts.Node): string | undefined {
  return conditionalBlock(node)?.condition;
}

function conditionalBlock(node: ts.Node): { condition: string; start: number } | undefined {
  for (let n: ts.Node = node; n.parent; n = n.parent) {
    const p = n.parent;
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && p.right === n) {
      return { condition: squash(p.left.getText()), start: n.getStart() };
    }
    if (ts.isConditionalExpression(p) && (p.whenTrue === n || p.whenFalse === n)) {
      const c = squash(p.condition.getText());
      return { condition: p.whenTrue === n ? c : `!(${c})`, start: n.getStart() };
    }
    if (ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) && !enclosingMap(n)) break;
  }
  return undefined;
}

function componentName(node: ts.Node): string {
  let name = "";
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) name = n.name.text;
  }
  return name || "Page";
}

// Section heading for an element: a labelled group around it (<ChipRow label>),
// else the closest h1/h2/h3 text or JSX comment above it in the same component.
// Label of a labelled group around the element: <ChipRow label="Hours a week">
// or <div role="group" aria-label="Course language">.
function labelledGroup(node: ts.Node): string | undefined {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (!ts.isJsxElement(n)) continue;
    const label = LABELLED_GROUPS.has(tagName(n.openingElement))
      ? attr(n.openingElement, "label")
      : ["group", "radiogroup", "tablist"].includes(attr(n.openingElement, "role") ?? "")
        ? attr(n.openingElement, "aria-label")
        : undefined;
    if (label) return label;
  }
  return undefined;
}

// Section heading for an element: a labelled group around it, else the
// closest h1/h2/h3 text or JSX comment above it in the same component.
function sectionOf(node: ts.Node, sf: ts.SourceFile, markers: { pos: number; text: string; component: string }[]): string {
  const group = labelledGroup(node);
  if (group) return group;
  const component = componentName(node);
  const block = conditionalBlock(node);
  const before = markers.filter((m) => m.pos < node.getStart(sf) && m.component === component);
  const marker = before.at(-1);
  // A heading above an `{cond && ...}` block does not describe what is inside
  // it; name the block by its condition instead (e.g. "turn === 2").
  if (block && (!marker || marker.pos < block.start)) return `when ${block.condition}`;
  return marker?.text ?? component;
}

// Headings and {/* comments */} in source order, used by sectionOf().
function sectionMarkers(sf: ts.SourceFile, arrays: Consts) {
  const markers: { pos: number; text: string; component: string }[] = [];
  const text = sf.getFullText();
  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n) && /^h[1-3]$/.test(tagName(n.openingElement))) {
      const t = childText(n, arrays);
      if (t && !t.includes("‹")) markers.push({ pos: n.getStart(sf), text: t, component: componentName(n) });
    }
    // A JSX comment is an empty JsxExpression; its text sits between the braces.
    if (ts.isJsxExpression(n) && !n.expression) {
      const m = text.slice(n.getStart(sf), n.end).match(/\/\*\s*([\s\S]*?)\s*\*\//);
      // Keep short "title" comments ("Summary row", "Hero: copy left"), skip prose notes.
      const title = m?.[1].split(/[:.(]/)[0].trim();
      if (title && title.length <= 30 && !/^[a-z0-9-]+\s/.test(title)) markers.push({ pos: n.getStart(sf), text: title, component: componentName(n) });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return markers;
}

// Local function bodies by name (function x() {} and const x = () => {}).
function localFunctions(sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) out.set(n.name.text, n.body.getText());
    if (ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isCallExpression(n.initializer))) {
      out.set(n.name.getText(), n.initializer.getText());
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

// Handler source plus the local functions it calls (two levels deep is enough:
// handleNext -> advance -> router.push).
function expandHandler(code: string, fns: Map<string, string>, depth = 2): string {
  if (depth === 0) return code;
  const called = [...code.matchAll(/\b([a-zA-Z_]\w*)\s*\(/g)].map((m) => m[1]);
  const bare = /^[a-zA-Z_]\w*$/.test(code.trim()) ? [code.trim()] : [];
  const bodies = [...new Set([...bare, ...called])].flatMap((name) => (fns.has(name) ? [expandHandler(fns.get(name)!, fns, depth - 1)] : []));
  return [code, ...bodies].join("\n");
}

export const navTargets = (code: string) =>
  [...code.matchAll(/router\.push\(\s*["`](\/[^"`?$]*)/g)].map((m) => m[1]);
export const apiCalls = (code: string) => [...code.matchAll(/fetch\(\s*["`](\/api\/[^"`?]+)/g)].map((m) => m[1]);

/** Every interactive element in one file. */
export function scanElements(file: string, relFile: string, srcDir: string): UiElement[] {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const arrays = constArrays(sf, srcDir);
  const markers = sectionMarkers(sf, arrays);
  const fns = localFunctions(sf);
  const out: UiElement[] = [];

  const visit = (n: ts.Node) => {
    const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : undefined;
    if (opening) {
      const tag = tagName(opening);
      const onClick = attr(opening, "onClick");
      const testId = attr(opening, "data-testid")?.replace(/\$\{[^}]+\}/g, "*");
      // A bare `onClick={onClick}` is a reusable wrapper (e.g. Chip's inner
      // <button>); its real uses are already counted where it is rendered.
      const passthrough = onClick !== undefined && /^on[A-Z]?\w*$/.test(onClick) && !testId && tag !== "a";
      const isInteractive = (INTERACTIVE_TAGS.has(tag) || onClick !== undefined) && !passthrough;
      if (isInteractive) {
        const text = ts.isJsxElement(n) ? childText(n, arrays) : "";
        const label =
          attr(opening, "aria-label")?.replace(/\$\{([^}]+)\}/g, "‹$1›") ||
          text ||
          attr(opening, "placeholder") ||
          attr(opening, "title") ||
          (attr(opening, "type") === "file" ? `file input (${attr(opening, "accept") ?? "any"})` : "") ||
          tag;
        const handler = expandHandler(onClick ?? "", fns);
        const href = attr(opening, "href");
        const navigatesTo = [...navTargets(handler), ...(href?.startsWith("/") ? [href.split("?")[0]] : [])];
        const disabled = attr(opening, "disabled");
        out.push({
          label,
          kind: kindOf(tag, opening),
          ...(testId ? { testId } : {}),
          component: componentName(n),
          section: sectionOf(n, sf, markers),
          ...(labelledGroup(n) ? { group: labelledGroup(n) } : {}),
          ...(shownWhen(n) ? { shownWhen: shownWhen(n) } : {}),
          ...(disabled ? { disabledWhen: squash(disabled) } : {}),
          repeated: enclosingMap(n) !== undefined || /\$\{/.test(attr(opening, "data-testid") ?? ""),
          navigatesTo: [...new Set(navigatesTo)],
          callsApi: [...new Set(apiCalls(handler))],
          file: relFile,
          line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** `if (cond) router.replace("/x")` and `else if (cond) router.replace("/x")`. */
export function scanGuards(text: string, relFile: string): Guard[] {
  const guards: Guard[] = [];
  for (const m of text.matchAll(/if \(([^)]+)\)\s*\{?\s*router\.replace\(\s*["`](\/[^"`?]*)/g)) {
    guards.push({ condition: squash(m[1]), redirectTo: m[2], file: relFile });
  }
  return guards;
}
