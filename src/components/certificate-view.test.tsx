import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowProvider } from "@/context/flow-context";
import { CERTIFICATE_NAME_KEY, formatCertificateDate } from "@/lib/certificate";
import { progressStorageKey } from "@/lib/programme-progress";
import { CertificateView } from "./certificate-view";

let roleParam = "role-1";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`role=${roleParam}`),
}));

const fonts = { serif: "serif", sans: "sans-serif", script: "cursive" };
const titles = { c1: "Course One", c2: "Course Two", c3: "Course Three" };
const at = new Date().toISOString();

function seed(progress: Record<string, unknown>, profileName?: string) {
  localStorage.setItem(progressStorageKey("role-1"), JSON.stringify(progress));
  if (profileName !== undefined) {
    sessionStorage.setItem(
      "laluan:flow:v1",
      JSON.stringify({
        consent: true,
        consentAt: at,
        profile: { personaId: "upload", name: profileName, roles: [], education: [], skills: [], courseLanguages: ["en"] },
        interviewAnswers: {},
        chosenRoleId: "role-1",
      }),
    );
  }
  return render(
    <FlowProvider>
      <CertificateView titles={titles} fonts={fonts} />
    </FlowProvider>,
  );
}

const verified = (certificateUrl: string) => ({
  completedAt: at,
  certificateUrl,
  verification: { status: "verified", checkedAt: at },
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  roleParam = "role-1";
});

describe("CertificateView", () => {
  it("explains the requirement when nothing is verified", async () => {
    seed({ c1: { completedAt: at, certificateUrl: "https://example.com/c" } }, "Ada Lovelace");
    expect(await screen.findByTestId("certificate-not-eligible")).toBeInTheDocument();
    expect(screen.queryByText("Certificate of Completion")).toBeNull();
  });

  it("lists only verified courses, with the profile name, today's date and no QR or verification ID", async () => {
    seed(
      { c1: verified("https://a.example/1"), c2: { completedAt: at, certificateUrl: "https://a.example/2" }, c3: verified("https://a.example/3") },
      "Ada Lovelace",
    );
    expect(await screen.findByText("Certificate of Completion")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("Course Three")).toBeInTheDocument();
    expect(screen.queryByText("Course Two")).toBeNull();
    expect(screen.getByText(formatCertificateDate(new Date()))).toBeInTheDocument();
    expect(screen.getByText("Issued by Laluan · Team Hoo Lee Sheet")).toBeInTheDocument();
    expect(screen.getByText("Team Hoo Lee Sheet · Laluan")).toBeInTheDocument();
    expect(screen.getByText("Platform-issued by Laluan. No third-party accreditation logos.")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/scan to verify|verification id|qr/i);
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("asks for a name when there is none, saves it, and never shows a placeholder", async () => {
    seed({ c1: verified("https://a.example/1") }, "");
    const input = await screen.findByLabelText("Full name on the certificate");
    expect(screen.queryByText("Certificate of Completion")).toBeNull();
    expect(screen.queryByText(/\[Learner/)).toBeNull();

    fireEvent.change(input, { target: { value: "  Siti   Aminah " } });
    fireEvent.click(screen.getByRole("button", { name: "Use this name" }));
    expect(await screen.findByText("Siti Aminah")).toBeInTheDocument();
    expect(localStorage.getItem(CERTIFICATE_NAME_KEY)).toBe("Siti Aminah");
    expect(screen.getByRole("button", { name: "Print / Save as PDF" })).toBeInTheDocument();
  });

  it("prefers a saved name over the profile name", async () => {
    localStorage.setItem(CERTIFICATE_NAME_KEY, "Nur Aisyah binti Ali");
    seed({ c1: verified("https://a.example/1") }, "Ada Lovelace");
    expect(await screen.findByText("Nur Aisyah binti Ali")).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });
});
