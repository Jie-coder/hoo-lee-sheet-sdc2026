// "Be Our Partner": business perspective for course providers. Front-end demo
// only; the form submits nowhere and nothing is stored.
import type { Metadata } from "next";
import { PartnerView } from "@/components/partner-view";

export const metadata: Metadata = {
  title: "Be Our Partner",
};

export default function PartnerPage() {
  return <PartnerView />;
}
