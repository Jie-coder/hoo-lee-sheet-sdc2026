// Client-side label for the server-rendered /status page, so it follows the
// site language (stored in the browser) like every other page.
"use client";

import { useT, type MessageKey } from "@/lib/i18n";

export function StatusText({ k }: { k: MessageKey }) {
  const { t } = useT();
  return <>{t(k)}</>;
}
