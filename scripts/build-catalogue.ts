// Compiles data/*.csv into src/data/catalogue.json, the data the app scores
// against. Run it after any change in data/ (a test fails if you forget):
//
//   npm run build-catalogue
//
// It refuses to write when any file fails the import check.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildCatalogue } from "./lib/catalogue-build";
import { isDirectRun } from "./import-data";

export const CATALOGUE_PATH = "src/data/catalogue.json";

export function formatCatalogue(catalogue: ReturnType<typeof buildCatalogue>): string {
  return `${JSON.stringify(catalogue, null, 1)}\n`;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  try {
    const catalogue = buildCatalogue("data");
    mkdirSync(dirname(CATALOGUE_PATH), { recursive: true });
    writeFileSync(CATALOGUE_PATH, formatCatalogue(catalogue));
    console.log(
      `wrote ${CATALOGUE_PATH}: ${catalogue.occupations.length} occupations, ${Object.keys(catalogue.skills).length} skills, ` +
        `${Object.keys(catalogue.signals).length} skill signals (as of ${catalogue.signalsAsOf}), ` +
        `${catalogue.courses.length} courses, ${catalogue.programmes.length} programmes`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
