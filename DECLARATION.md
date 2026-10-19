# Pre-Hackathon Work Declaration

This repository is **pre-existing work**, created before the SDC Hackathon's
official hacking period. It contains only generic, reusable infrastructure
(framework setup, UI components, an AI call wrapper, a database connection, a
status page) and **no domain-specific features or content**.

The final pre-hackathon state is the git tag **`starter-v0`**. Any commit
reachable from that tag was written before hacking started. All work after
that tag was produced during the hacking period.

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
