// /about: footer page. Text only; content lives in i18n-messages.ts.
import type { Metadata } from "next";
import { AboutView } from "@/components/about-view";

export const metadata: Metadata = {
  title: "About",
};

export default function Page() {
  return <AboutView />;
}
