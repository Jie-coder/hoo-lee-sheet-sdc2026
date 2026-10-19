// Demo page: submit text to /api/analyze, show the result, and optionally save it.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultCards } from "@/components/result-cards";
import type { AnalysisResult } from "@/lib/schema";

// Neutral sample text for the "Load example" button. Replace on hackathon day.
const EXAMPLE_INPUT =
  "Example input text: this short passage demonstrates the AI analysis pipeline. It does not describe any real-world event or domain.";

export default function DemoPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [source, setSource] = useState<"mock" | "live" | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setResult(null);
    setSource(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const body = await response.json();

      if (!response.ok) {
        toast.error(body.error ?? "The analysis request failed.");
        return;
      }

      setResult(body.data as AnalysisResult);
      setSource(body.source as "mock" | "live");
    } catch {
      toast.error("Could not reach the analysis API.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: result.summary, data: result }),
      });
      const body = await response.json();

      if (!response.ok) {
        toast.error(body.error ?? "Could not save the result.");
        return;
      }

      toast.success("Result saved.");
    } catch {
      toast.error("Could not reach the items API.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Demo</h1>
        {source === "mock" && <Badge variant="secondary">Mock mode</Badge>}
      </div>

      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Paste or type some text to analyze..."
        className="min-h-32"
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSubmit} disabled={loading || input.trim().length === 0}>
          {loading ? "Analyzing..." : "Submit"}
        </Button>
        <Button variant="outline" onClick={() => setInput(EXAMPLE_INPUT)} disabled={loading}>
          Load example
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && result && (
        <div className="flex flex-col gap-4">
          <ResultCards result={result} />
          <Button onClick={handleSave} disabled={saving} variant="outline">
            {saving ? "Saving..." : "Save result"}
          </Button>
        </div>
      )}
    </div>
  );
}
