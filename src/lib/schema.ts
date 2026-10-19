// Zod schemas for the AI output and for API request bodies, shared by the server and client.
import { z } from "zod";

// Generic, domain-neutral shape for an AI analysis result. Replace with a
// domain-specific schema on hackathon day.
export const AnalysisResultSchema = z.object({
  summary: z.string().describe("One or two sentence summary of the input"),
  category: z.string().describe("A short label for the kind of input"),
  severity: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  key_points: z.array(z.string()).min(1).max(5),
  next_steps: z
    .array(
      z.object({
        action: z.string(),
        reason: z.string(),
      })
    )
    .min(1)
    .max(5),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// Request body for POST /api/analyze.
export const AnalyzeRequestSchema = z.object({
  input: z.string().trim().min(1).max(5000),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// Request body for POST /api/items.
export const CreateItemRequestSchema = z.object({
  title: z.string().min(1).max(200),
  data: z.unknown().optional(),
});

export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;
