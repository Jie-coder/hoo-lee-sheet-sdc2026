// Pathway step: week-by-week plan for the role chosen on /results, built
// from the curated courses and programmes in data/*.csv.
import type { Metadata } from "next";
import { Suspense } from "react";
import { PathwayView } from "@/components/pathway-view";
import { CATALOGUE } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Pathway",
};

export default function PathwayPage() {
  // Only what the plan needs reaches the browser: 36 courses, 8 programmes,
  // and the ESCO group of each skill a course teaches.
  const courseSkillIds = new Set(CATALOGUE.courses.flatMap((course) => course.skillIds));
  const courseSkillGroups = Object.fromEntries(
    [...courseSkillIds].flatMap((id) => (CATALOGUE.skillGroups[id] ? [[id, CATALOGUE.skillGroups[id]]] : [])),
  );
  return (
    <Suspense>
      <PathwayView
        courses={CATALOGUE.courses}
        programmes={CATALOGUE.programmes}
        courseSkillGroups={courseSkillGroups}
      />
    </Suspense>
  );
}
