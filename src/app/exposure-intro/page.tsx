// Interstitial between the interview and results: how AI exposure is read.
import type { Metadata } from "next";
import { ExposureIntroStep } from "@/components/exposure-intro-step";

export const metadata: Metadata = {
  title: "AI exposure",
};

export default function ExposureIntroPage() {
  return <ExposureIntroStep />;
}
