// Home page: neutral placeholder landing page with a link to the demo.
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">SDC Starter</h1>
      <p className="max-w-md text-muted-foreground">
        A minimal, deployable starting point with AI, database and UI
        infrastructure already wired up.
      </p>
      <Button render={<Link href="/demo" />}>Try the demo</Button>
    </div>
  );
}
