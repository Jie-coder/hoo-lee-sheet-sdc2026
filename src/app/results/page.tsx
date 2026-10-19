// Results for the example persona Aisyah. Scores come from src/mocks, not an API.
import type { Metadata } from "next";
import { ResultsView } from "@/components/results-view";
import { AISYAH_RESULTS } from "@/mocks/aisyah";

export const metadata: Metadata = {
  title: "Results",
};

export default function ResultsPage() {
  return <ResultsView initial={AISYAH_RESULTS.today} />;
}
