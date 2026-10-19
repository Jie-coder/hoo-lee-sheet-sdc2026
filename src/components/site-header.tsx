// App header: Laluan wordmark, flow steps, and course-language preference.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "profile", label: "Profile" },
  { id: "interview", label: "Interview" },
  { id: "results", label: "Results" },
  { id: "pathway", label: "Pathway" },
] as const;

/** Course language for later pathway filtering. The interface stays English. */
const COURSE_LANGUAGES = [
  { id: "en", label: "EN" },
  { id: "ms", label: "BM" },
  { id: "zh", label: "中文" },
] as const;

type CourseLanguageId = (typeof COURSE_LANGUAGES)[number]["id"];

export function SiteHeader() {
  const pathname = usePathname();
  const onResults = pathname.startsWith("/results");
  const [courseLanguage, setCourseLanguage] = useState<CourseLanguageId>("ms");

  return (
    <header className="border-b border-line bg-paper/95">
      <div className="mx-auto grid max-w-[1248px] grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:h-16 lg:grid-cols-[260px_1fr_260px] lg:py-0">
        <Link href="/" className="col-start-1 row-start-1 justify-self-start">
          {/* Official wordmark. next/image refuses SVG without extra config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/laluan-logo.svg" alt="Laluan" className="h-8 w-auto" />
        </Link>

        <nav
          aria-label="Progress"
          className="col-span-2 row-start-2 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 text-[12px] lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-center lg:gap-3 lg:text-[13px]"
        >
          {STEPS.map((step, index) => {
            const number = index + 1;
            const complete = onResults && number < 3;
            const current = onResults && step.id === "results";
            return (
              <div key={step.id} className="flex items-center gap-1.5 lg:gap-3">
                {index > 0 && <span className="h-px w-4 shrink-0 bg-line lg:w-10" />}
                <div
                  className={cn(
                    "flex shrink-0 items-center gap-2",
                    current ? "font-medium text-ink" : "text-grey",
                    !current && !complete && "text-grey/70",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[12px]",
                      complete && "bg-sage-soft text-sage",
                      current && "bg-ink text-white",
                      !complete && !current && "border border-line text-grey",
                    )}
                  >
                    {complete ? <Check className="size-3.5" strokeWidth={1.6} /> : number}
                  </span>
                  {step.label}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2.5 lg:col-start-3">
          <span className="hidden items-center gap-1.5 text-[12px] text-grey sm:flex">
            <BookOpen className="size-3.5" strokeWidth={1.6} />
            Course language
          </span>
          <div
            role="group"
            aria-label="Course language"
            className="flex items-center rounded-full border border-line bg-white p-0.5 text-[12px]"
          >
            {COURSE_LANGUAGES.map((language) => {
              const selected = courseLanguage === language.id;
              return (
                <button
                  key={language.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCourseLanguage(language.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1",
                    selected ? "bg-ink font-medium text-white" : "text-grey",
                  )}
                >
                  {language.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
