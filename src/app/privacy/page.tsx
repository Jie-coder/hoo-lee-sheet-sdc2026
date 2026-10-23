// /privacy: footer page. Text only; content lives in i18n-messages.ts.
import type { Metadata } from "next";
import { PrivacyView } from "@/components/privacy-view";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function Page() {
  return <PrivacyView />;
}
