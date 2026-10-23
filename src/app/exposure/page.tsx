// /exposure: what the AI exposure score on role cards means and where it comes from.
import type { Metadata } from "next";
import { ExposureView } from "@/components/exposure-view";

export const metadata: Metadata = {
  title: "AI exposure",
};

export default function ExposurePage() {
  return <ExposureView />;
}
