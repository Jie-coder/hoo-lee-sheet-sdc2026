# Pre-Hackathon Work Declaration

This repository is **pre-existing work**, created before the SDC Hackathon's
official hacking period. It contains only generic, reusable infrastructure
(framework setup, UI components, an AI call wrapper, a database connection, a
status page) and **no domain-specific features or content**.

The final pre-hackathon state is the git tag **`starter-v0`** in the separate
(private) starter repository `Jie-coder/sdc-starter`, pointing at commit
`57171fecfff5901a392debbf25e599127785da63` (committed 2026-10-17 14:32 UTC+8).
That tag does **not** exist in this repository: the exact file tree of
`starter-v0` was imported here, without its git history, as commit
**`80cc8dc`** (`chore: import declared pre-existing starter ...`,
2026-10-19 22:05 UTC+8), the first commit on `main`. All work after that
commit was produced during the hacking period.

## Third-party libraries

Versions below are the `^` semver ranges declared in `package.json`; the exact resolved versions are recorded in `package-lock.json`.

### dependencies

| Package | Version |
|---|---|
| `@ai-sdk/google` | `^4.0.99` |
| `@base-ui/react` | `^1.9.0` |
| `@supabase/supabase-js` | `^2.118.0` |
| `ai` | `^7.0.143` |
| `class-variance-authority` | `^0.7.1` |
| `cn` | `^0.5.0` |
| `lucide-react` | `^1.58.0` |
| `next` | `16.4.2` |
| `next-themes` | `^0.4.6` |
| `react` | `19.3.0` |
| `react-dom` | `19.3.0` |
| `server-only` | `^0.0.1` |
| `shadcn` | `^4.22.0` |
| `sonner` | `^2.0.8` |
| `tw-animate-css` | `^1.4.0` |
| `zod` | `^4.6.7` |

### devDependencies

| Package | Version |
|---|---|
| `@tailwindcss/turbopack` | `^4` |
| `@types/node` | `^24.19.2` |
| `@types/react` | `^19` |
| `@types/react-dom` | `^19` |
| `eslint` | `^9` |
| `eslint-config-next` | `16.4.2` |
| `tailwindcss` | `^4` |
| `typescript` | `^5` |

## Third-party services

- **GitHub** — source control and repository hosting.
- **Vercel** — build and deployment platform for the Next.js app.
- **Supabase** — hosted Postgres database for the `items` test table.
- **Google Gemini API via Google AI Studio** — the AI provider called from
  `src/lib/ai.ts` for live (non-mock) analysis requests.
- **npm registry** — source of all packages listed above.
- **Google Fonts via `next/font`** — the Geist and Geist Mono font families,
  loaded in `src/app/layout.tsx`.

## AI tools used

- **Claude Code (Anthropic)** — AI coding assistant used to generate most of
  the starter code under human supervision.
- **Grok Bot** — AI assistant used to orchestrate the work, review and fix
  the generated code, and verify build/lint/runtime checks.

All AI-generated code is reviewed by the team before it is merged, and the
code is kept simple and commented so team members can explain every file.

## AI tool source per pull request (hacking period)

Where a commit has no `Tool:` trailer, the source below was determined from
the build machine's logs.

| PR | Commits | Tool source |
|---|---|---|
| #65 | a7a3e4a, cf2808f | Coded directly by Kai |
| #66 | 0191b0d, 3ccf2db | Coded directly by Jarvis (Grok Bot); no Claude Code / OpenCode activity in the logs for 2026-10-23 21:47–22:20 UTC+8, branch `jarvis/nav-back-steps` |
| #67 | 98c8941, 8b5e1f4, 59fdca2, 43423ef | Coded directly by Jarvis (Grok Bot); same log window, branch `jarvis/footer-logo` |
| #68 | afa2b21, a040d59 | Coded directly by Kai |
| #70 | 7840eaf, d7fc539, b46a2b6 | Coded directly by Kai |
| #71 | 3ccade0 | Coded directly by Kai |
