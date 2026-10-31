import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const ENV_KEYS = ["AI_MOCK", "KRACKEDDEVS_API_KEY"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

function call(body: unknown) {
  return POST(new Request("http://test/api/verify-certificate", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
}

const GOOD = {
  certificateUrl: "https://www.coursera.org/account/accomplishments/verify/ABC",
  itemId: "c1",
  expectedTitle: "Google Data Analytics",
};

describe("POST /api/verify-certificate", () => {
  it("rejects bad JSON, missing fields, non-http(s) and private URLs with 400", async () => {
    expect((await call("{nope")).status).toBe(400);
    expect((await call({ itemId: "c1" })).status).toBe(400);
    for (const certificateUrl of ["javascript:alert(1)", "http://localhost/x", "http://169.254.169.254/", "http://192.168.0.1/"]) {
      expect((await call({ ...GOOD, certificateUrl })).status, certificateUrl).toBe(400);
    }
  });

  it("returns the deterministic mock verdict under AI_MOCK=true, without any network call", async () => {
    process.env.AI_MOCK = "true";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const verified = await (await call(GOOD)).json();
    expect(verified).toMatchObject({ ok: true, status: "verified", matchedTitle: "Google Data Analytics" });
    expect(typeof verified.checkedAt).toBe("string");

    const failed = await (await call({ ...GOOD, certificateUrl: "https://example.com/my-cert" })).json();
    expect(failed).toMatchObject({ ok: false, status: "failed" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports pending (not verified) when no API key is configured", async () => {
    process.env.AI_MOCK = "false";
    delete process.env.KRACKEDDEVS_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const body = await (await call(GOOD)).json();
    expect(body).toMatchObject({ ok: false, status: "pending" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
