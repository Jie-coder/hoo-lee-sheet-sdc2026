# Programme completion proof

Mentor feedback: "prove they finished". The pathway page lets a learner mark each
stop done, paste a certificate link, ask for an **AI-assisted check** of that link,
and, once something is verified, download a Laluan Certificate of Completion.

## Flow
1. **Mark as done** (checkbox on each stop). Self-reported, saved in this browser.
2. **Certificate link** (optional): a valid `http(s)` URL; anything else (e.g. `javascript:`) is rejected on save and dropped on load.
3. **Verify certificate**: `POST /api/verify-certificate` → badge **Verified / Not verified / Check unavailable** plus a one-line reason. Label shown in the UI: "AI-assisted check. The provider's original certificate remains the authoritative record."
4. **Download certificate** → `/certificate?role=<roleId>` (printable page, "Print / Save as PDF").

Changing or removing the link clears its verdict. A verdict that comes back for a link that has since changed is ignored.

## Verification API
`POST /api/verify-certificate` body `{ certificateUrl, itemId, expectedTitle, provider? }`
→ `{ ok, status: "verified" | "failed" | "pending", reason, matchedTitle?, checkedAt }`.
`ok` is true only when `status` is `"verified"`. Bad input (not JSON, missing fields, non-http(s) or private URL) → HTTP 400 `{ error }`.

- **Guard (basic SSRF protection)**: only `http(s)`, no embedded credentials, and no `localhost`, `*.localhost`, `*.local`, `*.internal`, `127.x`, `10.x`, `172.16–31.x`, `192.168.x`, `169.254.x`, `100.64/10`, `0.x`, `::1`, `fc/fd`, `fe80` or v4-mapped IPv6. The host is also resolved before each fetch and refused if any address is private; redirects are followed manually (max 3) and re-checked.
- **Fetch**: server-side, 8 s timeout, 1 MB read cap, HTML/plain text only (PDFs, images and login-walled or JS-only pages give `pending`). Markup is stripped and the text truncated to 8,000 characters.
- **Model**: KrackedDevs LiteLLM, same path as CV parse (`getCvParseModel`): `KRACKEDDEVS_API_KEY`, `KRACKEDDEVS_BASE_URL` (default `https://litellm.rapidscreen.io/v1`), `KRACKEDDEVS_MODEL` (default `deepseek-v4.1-flash`). The prompt treats page text as untrusted and asks for strict JSON: does the page look like a genuine certificate from a recognised provider, and does it match the expected course title. `verified` needs both. An unreadable model answer is `pending`, not a guess.
- **`pending`** (shown as "Check unavailable") means the check did not run: no key configured, fetch failed or timed out, unreadable page, or model error. It is never a fake verification and never counts toward the certificate.
- **No key is ever logged**; neither the page text nor the URL is logged.
- Code: `src/lib/verify-certificate.ts` (pure helpers + tests), `src/lib/verify-certificate-run.ts` (fetch + model), `src/app/api/verify-certificate/route.ts`.

### Demo certificate URL (product demonstration only)

Paste this exact link on any pathway stop (any course or programme title):

`https://demo.laluan.app/example-certificate`

When the URL normalizes to that host and path (`demo.laluan.app` + `/example-certificate`, https only; a query string or fragment is ignored), both the live check and `AI_MOCK=true` skip title and provider matching and return `verified` with reason `Demo certificate link (product demonstration only).` The pathway shows that reason under the verification badge. It does not add a QR code or a verification ID. This is not a real certificate and not accreditation. Every other URL is checked exactly as before.

### `AI_MOCK=true` rule
No network, no model, deterministic. `verified` when the URL host equals or is a subdomain of a known provider domain (coursera.org, edx.org, udemy.com, linkedin.com, google.com, grow.google, skills.google, credly.com, credential.net, freecodecamp.org, microsoft.com, ibm.com, futurelearn.com) **and** the path contains one of `certif`, `verif`, `accomplish`, `credential`, `badge`, `achievement`. Otherwise `failed`. The mock never reads the page and never compares the course title (`matchedTitle` just echoes the expected title). The demo URL above is the only extra `verified` case, and it applies in the live check as well.

## Certificate eligibility rule
"Download certificate" is enabled once **at least one** programme in the pathway is **marked done AND has an AI-verified certificate link**. Before that it is a disabled button with a hint explaining this. The certificate lists **only verified** completed titles (done but unverified or failed items are left off). `/certificate` shows the same explanation if opened without any verified item.

## Certificate page (`/certificate?role=<roleId>`)
- Layout follows `docs/design/laluan-digital-cert-final.png`: letter landscape (`@page { size: letter landscape; margin: 0 }`), double peach border, logo + "Issued by Laluan · Team Hoo Lee Sheet", serif "CERTIFICATE OF COMPLETION", learner name, bulleted titles, date, script signature "H.LSheet", faint road lines, footer "Platform-issued by Laluan. No third-party accreditation logos." **No QR code, no "scan to verify", no verification ID.**
- **Learner name**: saved certificate name (`laluan:certificate-name:v1`) if set, else the profile name from the current session (CV parse / persona). If neither exists the page asks for a full name first; no placeholder is ever printed. "Change name" lets the learner correct it.
- **Date**: issue date = the day the page is opened/printed (not the completion date), formatted `DD Mon YYYY`.
- Certificate copy is English (formal artefact); buttons, prompts and hints use the EN/MS site dictionary.
- Logo is an inline orange mark + "Laluan" wordmark to match the design reference (the `public/brand` logos are sage/black). Fonts: see the Fonts section below.

### Fonts
Mapping follows the Canva PDF embedding table.

| Role | Font |
| --- | --- |
| "Laluan" wordmark (live text, orange) | Poppins Bold (700) |
| "Issued by Laluan · Team Hoo Lee Sheet" | Poppins Regular (400) |
| "CERTIFICATE OF COMPLETION" title (uppercase) | TeX Gyre Termes Regular (`next/font/local`, `src/fonts/tex-gyre-termes/`, GUST Font License) |
| "This is to certify that", "has completed…", course titles, date, "Team Hoo Lee Sheet · Laluan", footer disclaimer | Poppins Regular (400) |
| Learner name | Poppins Medium (500) |
| "H.LSheet" signature | Amsterdam One if installed locally, else Mrs Saint Delafield (temporary fallback) |

Poppins is loaded via `next/font/google` with weights 400, 500, 700 only. Amsterdam One is **not** bundled or downloaded.

- [待确认] Canva uses Amsterdam One (Lettersiro, free for personal use only; web/commercial use needs a licence). The web page uses the Mrs Saint Delafield fallback until the team buys a web licence or approves using a flattened SVG of the signature exported from Canva (which also needs a licence check).

## Storage and privacy
- `laluan:progress:v1:<roleId>` (localStorage): `{ [itemId]: { completedAt, certificateUrl?, verification?: { status, reason?, checkedAt, matchedTitle? } } }`. Sanitized on load.
- `laluan:certificate-name:v1` (localStorage): the full name typed on the certificate page.
- "Delete my data" on the pathway page clears this role's saved progress. It does not yet clear the certificate name (the learner can overwrite it on the certificate page) — [待确认] whether to add that.
- **New server fetch**: pressing "Verify certificate" sends the certificate URL, the course title and provider name to Laluan's server, which fetches that public page and sends its text (max 8,000 characters) to the KrackedDevs model endpoint. Nothing is stored server-side. The page text may contain the learner's name.
- `src/components/privacy-view.tsx` and the `privacyPage.*` strings do not mention these keys or the server fetch yet: adding that copy is [待确认] with the team.

## Limits
- The AI check is **not accreditation** and not proof of identity: it judges whether a public page looks like a certificate for the expected course. It can be wrong in both directions, and a page can be made up to look genuine. The provider's original certificate stays the authoritative record.
- It cannot check pages that need a login, are rendered only by JavaScript, or are PDFs/images.
- The learner can still mark anything "done" themselves; only the verified items appear on the Laluan certificate.
- Progress is per browser: no sync across devices, lost if site data is cleared. Server-side storage would need a privacy review first ([待确认]).
- Verified Coursera API/partnership integration remains future work: [待确认] (availability, requirements, owner).
- [待确认] `KRACKEDDEVS_API_KEY` (and optionally `KRACKEDDEVS_BASE_URL` / `KRACKEDDEVS_MODEL`) must be set on the Replit deploy; without it every check returns "Check unavailable".
- [待确认] The route has no rate limiting; it is an unauthenticated server-side fetcher plus model call that spends sponsor credit.
