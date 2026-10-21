// Interview step: five quick questions, mostly tap-to-answer chips.
import type { Metadata } from "next";
import { InterviewView } from "@/components/interview-view";

export const metadata: Metadata = {
  title: "Interview",
};

export default function InterviewPage() {
  return <InterviewView />;
}
