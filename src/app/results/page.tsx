// Results: roles ranked for the profile in the flow state, from POST /api/roles.
import type { Metadata } from "next";
import { ResultsView } from "@/components/results-view";

export const metadata: Metadata = {
  title: "Results",
};

export default function ResultsPage() {
  return <ResultsView />;
}
