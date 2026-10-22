// Runs one named flow from flows.ts in a real Chromium browser (Playwright)
// and saves screenshots + a trace you can open with `npx playwright show-trace`.
//
// Usage:
//   npm run feature-map:drive -- full-journey
//   npm run feature-map:drive -- radar --url https://laluan.vercel.app --headed
//   npm run feature-map:drive -- --list
//
// Output goes to artifacts/feature-map/<flow>-<time>/ (git-ignored).
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { FLOWS, type Step } from "./flows";

// Read "--url X" style options from the command line.
function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

// Do one step. Every action waits up to 15 s, then fails with a clear message.
async function runStep(page: Page, step: Step, outDir: string, baseUrl: string) {
  const timeout = 15_000;
  if ("goto" in step) await page.goto(new URL(step.goto, baseUrl).toString());
  else if ("click" in step) await page.getByTestId(step.click).nth(step.nth ?? 0).click({ timeout });
  else if ("clickRole" in step) await page.getByRole(step.clickRole, { name: step.name }).click({ timeout });
  else if ("press" in step) await page.keyboard.press(step.press);
  else if ("waitUrl" in step) await page.waitForURL((url) => url.pathname === step.waitUrl, { timeout });
  else if ("expectText" in step) await page.getByText(step.expectText).first().waitFor({ timeout });
  else if ("shot" in step) await page.screenshot({ path: path.join(outDir, `${step.shot}.png`), fullPage: true });
}

async function main() {
  if (process.argv.includes("--list")) {
    for (const [name, flow] of Object.entries(FLOWS)) {
      console.log(`${name.padEnd(14)} ${flow.description}${flow.needsSecrets ? "  [needs secrets]" : ""}`);
    }
    return;
  }
  const name = process.argv.slice(2).find((a) => !a.startsWith("--") && a !== option("--url"));
  const flow = name ? FLOWS[name] : undefined;
  if (!flow) {
    console.error(`Unknown flow "${name ?? ""}". Run with --list to see flows.`);
    process.exit(1);
  }
  const baseUrl = option("--url") ?? "http://localhost:3000";
  const outDir = path.resolve("artifacts/feature-map", `${name}-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !process.argv.includes("--headed") });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  let failed = false;
  try {
    for (const [index, step] of flow.steps.entries()) {
      console.log(`step ${index + 1}/${flow.steps.length}: ${JSON.stringify(step)}`);
      await runStep(page, step, outDir, baseUrl);
    }
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    // On failure, keep a picture of where it broke: that is the bug report.
    await page.screenshot({ path: path.join(outDir, "FAILED.png"), fullPage: true }).catch(() => {});
    console.error(`FAIL ${name} at ${page.url()}:`, error instanceof Error ? error.message : error);
  } finally {
    await context.tracing.stop({ path: path.join(outDir, "trace.zip") });
    await browser.close();
    console.log(`Screenshots and trace: ${outDir}`);
  }
  process.exit(failed ? 1 : 0);
}

main();
