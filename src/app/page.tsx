// Landing page: hero, how-it-works, and the consent gate before /profile.
import type { Metadata } from "next";
import { LandingView } from "@/components/landing-view";

export const metadata: Metadata = {
  title: "Laluan",
};

export default function Home() {
  return <LandingView />;
}
