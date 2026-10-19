// Renders a structured AnalysisResult as a summary card, key points and next steps.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/schema";

// Badge colour per severity level.
const severityClassName: Record<AnalysisResult["severity"], string> = {
  low: "bg-green-600 text-white",
  medium: "bg-yellow-600 text-white",
  high: "bg-red-600 text-white",
};

export function ResultCards({ result }: { result: AnalysisResult }) {
  const confidencePercent = Math.round(result.confidence * 100);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Summary</span>
            <Badge className={severityClassName[result.severity]}>
              {result.severity}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p>{result.summary}</p>
          <p className="text-sm text-muted-foreground">
            Category: {result.category}
          </p>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span>{confidencePercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key points</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {/* The index is used as the key because AI output can repeat the same text. */}
            {result.key_points.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {result.next_steps.map((step, index) => (
              <li key={index}>
                <p className="font-medium">{step.action}</p>
                <p className="text-muted-foreground">{step.reason}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
