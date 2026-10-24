// @vitest-environment node
// Route handlers run on Node; jsdom's FormData/File are not recognised by
// Node's (undici) Request, which would serialise the body as text/plain.
import { afterEach, describe, expect, it } from "vitest";
import { MAX_CV_BYTES } from "@/lib/cv-upload-limits";
import { POST } from "./route";

function pdfFile(byteLength: number, name = "cv.pdf"): File {
  return new File([new Uint8Array(byteLength)], name, { type: "application/pdf" });
}

function postWithFile(file: File | null): Promise<Response> {
  const formData = new FormData();
  if (file) formData.append("file", file, file.name);
  const request = new Request("http://localhost/api/parse-cv", { method: "POST", body: formData });
  return POST(request);
}

const ORIGINAL_AI_MOCK = process.env.AI_MOCK;

afterEach(() => {
  if (ORIGINAL_AI_MOCK === undefined) delete process.env.AI_MOCK;
  else process.env.AI_MOCK = ORIGINAL_AI_MOCK;
});

describe("POST /api/parse-cv", () => {
  it("rejects a request with no file", async () => {
    const response = await postWithFile(null);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/file/i);
  });

  it("rejects a non-PDF file", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "cv.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const response = await postWithFile(file);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/PDF/);
  });

  it("rejects a PDF over 2 MB", async () => {
    const file = pdfFile(MAX_CV_BYTES + 1);
    const response = await postWithFile(file);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/2 MB/);
  });

  it("accepts a PDF at exactly 2 MB and returns a parsed profile (AI_MOCK fixture)", async () => {
    process.env.AI_MOCK = "true";
    const file = pdfFile(MAX_CV_BYTES);
    const response = await postWithFile(file);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("skills");
    expect(body).toHaveProperty("roles");
    expect(body).toHaveProperty("education");
  });
});
