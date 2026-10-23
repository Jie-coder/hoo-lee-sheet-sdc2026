// /data-sources: footer page. Text only; content lives in i18n-messages.ts.
import type { Metadata } from "next";
import { DataSourcesView } from "@/components/data-sources-view";

export const metadata: Metadata = {
  title: "Data sources",
};

export default function Page() {
  return <DataSourcesView />;
}
