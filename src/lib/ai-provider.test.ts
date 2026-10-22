import { afterEach, describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";
import { getActiveProviderName, getModel, resetProviderLogForTests, resolveAnthropicBaseUrl } from "@/lib/ai";

// getModel() always returns a model object, never the string-shorthand branch
// of the LanguageModel union, so this narrows it for the provider/modelId/
// config.baseURL assertions below.
function modelFields(model: LanguageModel): { provider: string; modelId: string; config: { baseURL: string } } {
  return model as unknown as { provider: string; modelId: string; config: { baseURL: string } };
}

const ENV_KEYS = [
  "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
  "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "AI_PROVIDER",
] as const;

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

const BASE = "https://replit-ai-integrations.example.com";

describe("resolveAnthropicBaseUrl", () => {
  it("appends /v1 to a bare base URL", () => {
    expect(resolveAnthropicBaseUrl(BASE)).toBe(`${BASE}/v1`);
  });

  it("strips a trailing slash before appending /v1", () => {
    expect(resolveAnthropicBaseUrl(`${BASE}/`)).toBe(`${BASE}/v1`);
  });

  it("does not double up /v1 when the base already ends with it", () => {
    expect(resolveAnthropicBaseUrl(`${BASE}/v1`)).toBe(`${BASE}/v1`);
  });

  it("does not double up /v1 when the base ends with /v1/", () => {
    expect(resolveAnthropicBaseUrl(`${BASE}/v1/`)).toBe(`${BASE}/v1`);
  });
});

describe("getActiveProviderName and getModel", () => {
  it("uses anthropic when both AI_INTEGRATIONS_ANTHROPIC_* vars are set", () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = BASE;

    expect(getActiveProviderName()).toBe("anthropic");

    const result = getModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).provider).toBe("anthropic.messages");
    expect(modelFields(result.model).modelId).toBe("claude-haiku-4-5");
    expect(modelFields(result.model).config.baseURL).toBe(`${BASE}/v1`);
  });

  it("resolves a base URL ending in / without a double slash before /v1", () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = `${BASE}/`;

    const result = getModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).config.baseURL).toBe(`${BASE}/v1`);
  });

  it("does not double up /v1 when the base URL already ends with it", () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = `${BASE}/v1`;

    const result = getModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).config.baseURL).toBe(`${BASE}/v1`);
  });

  it("does not double up /v1 when the base URL already ends with /v1/", () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = `${BASE}/v1/`;

    const result = getModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).config.baseURL).toBe(`${BASE}/v1`);
  });

  it("falls back to google when AI_INTEGRATIONS_ANTHROPIC_BASE_URL is missing", () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-key";
    process.env.AI_PROVIDER = "google";

    expect(getActiveProviderName()).toBe("google");

    const result = getModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).provider).toBe("google.generative-ai");
  });

  it("falls back to google when AI_INTEGRATIONS_ANTHROPIC_API_KEY is missing", () => {
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = BASE;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-key";
    process.env.AI_PROVIDER = "google";

    expect(getActiveProviderName()).toBe("google");

    const result = getModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).provider).toBe("google.generative-ai");
  });
});

describe("provider log line", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetProviderLogForTests();
  });

  it("logs provider and model once per process, without key or baseURL", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    resetProviderLogForTests();
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "secret-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = BASE;
    getModel();
    getModel();
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0][0]);
    expect(line).toBe("[ai] provider=anthropic model=claude-haiku-4-5");
    expect(line).not.toContain("secret-key");
    expect(line).not.toContain(BASE);
  });

  it("logs the gemini equivalent", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    resetProviderLogForTests();
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    delete process.env.AI_PROVIDER;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-key";
    getModel();
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).toMatch(/^\[ai\] provider=google model=\S+$/);
  });
});
