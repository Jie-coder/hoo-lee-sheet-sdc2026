// Status page: one Limestone card per integration health check, with a ringed signal light.
import { Suspense } from "react";
import { PageHero, SignalLight } from "@/components/caldera";
import { connection } from "next/server";
import { runHealthChecks } from "@/lib/health";
import { translate } from "@/lib/i18n-messages";

export default function StatusPage() {
  return (
    <div className="mx-auto w-full max-w-[1248px] px-5 pt-14 pb-24 md:px-14 md:pt-20">
      <PageHero title={translate("en", "status.title")} lede={translate("en", "status.lede")} />

      {/* Each check makes a network call, so this streams in at request
          time behind the Suspense boundary instead of being prerendered. */}
      <Suspense fallback={<StatusSkeleton />}>
        <StatusChecks />
      </Suspense>
    </div>
  );
}

async function StatusChecks() {
  await connection();
  const checks = await runHealthChecks();

  return (
    <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
      {checks.map((check) => (
        <div key={check.name} className="rounded-[40px] bg-card p-8">
          <p className="font-mono text-[12px] tracking-[0.06em] uppercase">{check.name}</p>
          <SignalLight
            className="mt-4"
            level={check.ok ? "low" : "high"}
            label={check.ok ? translate("en", "status.ok") : translate("en", "status.error")}
          />
          <p className="mt-3 text-[15px] text-grey">{check.message}</p>
        </div>
      ))}
    </div>
  );
}

function StatusSkeleton() {
  return (
    <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="h-40 rounded-[40px] bg-card animate-pulse" />
      <div className="h-40 rounded-[40px] bg-card animate-pulse" />
      <div className="h-40 rounded-[40px] bg-card animate-pulse" />
    </div>
  );
}
