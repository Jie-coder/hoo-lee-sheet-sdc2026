// Status page: shows a green/red card for each integration health check.
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { connection } from "next/server";
import { runHealthChecks } from "@/lib/health";
import { translate } from "@/lib/i18n-messages";

export default function StatusPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{translate("en", "status.title")}</h1>
      <p className="text-sm text-muted-foreground">
        {translate("en", "status.lede")}
      </p>

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
    <div className="flex flex-col gap-3">
      {checks.map((check) => (
        <Card key={check.name}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{check.name}</span>
              <Badge
                variant={check.ok ? "default" : "destructive"}
                className={check.ok ? "bg-green-600 text-white" : undefined}
              >
                {check.ok ? translate("en", "status.ok") : translate("en", "status.error")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {check.message}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
