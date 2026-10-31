import { afterEach, describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";
import { getActiveProviderName, getCvParseModel, getModel, resetProviderLogForTests, resolveAnthropicBaseUrl } from "@/lib/ai";

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
  "AI_MODEL",
  "KRACKEDDEVS_API_KEY",
  "KRACKEDDEVS_BASE_URL",
  "KRACKEDDEVS_MODEL",
] as const;

const KRACKEDDEVS_DEFAULT_BASE = "https://litellm.rapidscreen.io/v1";
const KRACKEDDEVS_DEFAULT_MODEL = "deepseek-v4.1-flash";

function chatCompletionsUrl(model: LanguageModel): string {
  const config = (model as unknown as { config: { url?: (opts: { path: string }) => string } }).config;
  if (!config.url) throw new Error("expected an openai-compatible model with config.url");
  return config.url({ path: "/chat/completions" });
}

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

  it("keeps getModel on anthropic when KRACKEDDEVS_API_KEY is also set", () => {
    process.env.KRACKEDDEVS_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = BASE;

    expect(getActiveProviderName()).toBe("anthropic");
    const result = getModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).provider).toBe("anthropic.messages");
    expect(modelFields(result.model).modelId).toBe("claude-haiku-4-5");
  });
});

describe("getCvParseModel", () => {
  it("uses the openai-compatible KrackedDevs path when KRACKEDDEVS_API_KEY is set, even if Anthropic integrations are set", () => {
    process.env.KRACKEDDEVS_API_KEY = "test-key";
    delete process.env.KRACKEDDEVS_BASE_URL;
    delete process.env.KRACKEDDEVS_MODEL;
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = BASE;

    const result = getCvParseModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).provider).toBe("krackeddevs.chat");
    expect(modelFields(result.model).modelId).toBe(KRACKEDDEVS_DEFAULT_MODEL);
    expect((result.model as unknown as { supportsStructuredOutputs: boolean }).supportsStructuredOutputs).toBe(true);
    expect(chatCompletionsUrl(result.model)).toBe(`${KRACKEDDEVS_DEFAULT_BASE}/chat/completions`);
    expect(chatCompletionsUrl(result.model)).not.toContain("test-key");
  });

  it("honours KRACKEDDEVS_BASE_URL and KRACKEDDEVS_MODEL when set", () => {
    process.env.KRACKEDDEVS_API_KEY = "test-key";
    process.env.KRACKEDDEVS_BASE_URL = "https://proxy.example/v1/";
    process.env.KRACKEDDEVS_MODEL = "sponsor-flash";

    const result = getCvParseModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).provider).toBe("krackeddevs.chat");
    expect(modelFields(result.model).modelId).toBe("sponsor-flash");
    expect(chatCompletionsUrl(result.model)).toBe("https://proxy.example/v1/chat/completions");
  });

  it("falls back to getModel when KRACKEDDEVS_API_KEY is unset", () => {
    delete process.env.KRACKEDDEVS_API_KEY;
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = BASE;

    const result = getCvParseModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).provider).toBe("anthropic.messages");
    expect(modelFields(result.model).modelId).toBe("claude-haiku-4-5");
  });

  it("falls back to google when the sponsor key and Anthropic integrations are unset", () => {
    delete process.env.KRACKEDDEVS_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    delete process.env.AI_PROVIDER;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-key";

    const viaHelper = getCvParseModel();
    const viaGetModel = getModel();
    expect(viaHelper.ok && viaGetModel.ok).toBe(true);
    if (!viaHelper.ok || !viaGetModel.ok) return;
    expect(modelFields(viaHelper.model).provider).toBe("google.generative-ai");
    expect(modelFields(viaHelper.model).provider).toBe(modelFields(viaGetModel.model).provider);
    expect(modelFields(viaHelper.model).modelId).toBe(modelFields(viaGetModel.model).modelId);
  });

  it("treats a blank KRACKEDDEVS_API_KEY as unset", () => {
    process.env.KRACKEDDEVS_API_KEY = "   ";
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = BASE;

    const result = getCvParseModel();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(modelFields(result.model).provider).toBe("anthropic.messages");
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

  it("logs provider=krackeddevs once, without the key or the URL, even after getModel already logged", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    resetProviderLogForTests();
    process.env.KRACKEDDEVS_API_KEY = "test-key";
    process.env.KRACKEDDEVS_BASE_URL = KRACKEDDEVS_DEFAULT_BASE;
    delete process.env.KRACKEDDEVS_MODEL;
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = BASE;

    getModel();
    getCvParseModel();
    getCvParseModel();

    expect(info).toHaveBeenCalledTimes(2);
    const lines = info.mock.calls.map((call) => String(call[0]));
    expect(lines[0]).toBe("[ai] provider=anthropic model=claude-haiku-4-5");
    expect(lines[1]).toBe(`[ai] provider=krackeddevs model=${KRACKEDDEVS_DEFAULT_MODEL}`);
    for (const line of lines) {
      expect(line).not.toContain("test-key");
      expect(line).not.toContain("http");
      expect(line).not.toContain("litellm");
      expect(line).not.toContain(BASE);
    }
  });
});
