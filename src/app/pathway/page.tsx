// Pathway step: week-by-week plan for the role chosen on /results.
import type { Metadata } from "next";
import { Suspense } from "react";
import { PathwayView } from "@/components/pathway-view";

export const metadata: Metadata = {
  title: "Pathway",
};

export default function PathwayPage() {
  return (
    <Suspense>
      <PathwayView />
    </Suspense>
  );
}
