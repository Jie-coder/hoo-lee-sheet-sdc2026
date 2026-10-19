# Hoo Lee Sheet: SDC Hackathon 2026

Competition repository for team **Hoo Lee Sheet** (SDC Hackathon 2026,
Domain 1: Aiversecity Future-Ready Workforce).

> **Status:** we have not picked our idea yet (rule 8.5.2), so the app is still
> the generic starter: a Next.js app with an AI call that returns structured
> JSON, a Supabase connection, a `/demo` page and a `/status` page. Domain
> features will be added on top of it during the hacking period.

- Next.js (App Router, TypeScript, `src/`) with Tailwind CSS and shadcn/ui.
- AI layer in [`src/lib/ai.ts`](./src/lib/ai.ts): Google Gemini by default
  (Vercel AI SDK), an **optional** self-hosted model on RunPod, Zod-validated
  structured output, and a **mock mode** so a demo never depends on a live API.
- Supabase, used **server-side only** with the service role key.
- Runs on **Replit** (our compulsory sponsor platform), with Vercel as a backup.

## Pre-existing code declaration (rule 8.2)

This repo starts from our own starter, which we declared to the organisers as
pre-existing code under rule 8.2:

| | |
|---|---|
| Source repo | `Jie-coder/sdc-starter` (private) |
| Declared tag | `starter-v0` |
| Declared commit | `57171fe` |

The **first commit** of this repo, *"chore: import declared pre-existing
starter (sdc-starter@starter-v0, commit 57171fe, declared under rule 8.2)"*,
is an exact copy of the `starter-v0` file tree (without the old git history and
without any local `.vercel` folder). **Everything after that first commit was
written during the hacking period.** You can check this yourself with
`git show --stat <first commit>` and `git log`.

[`DECLARATION.md`](./DECLARATION.md) is the declaration as submitted, with the
libraries, services and AI tools used to build the starter. It describes the
starter only and is intentionally left unchanged. Things added during the
hackathon so far: the Apache 2.0 licence, Replit support (`.replit`), the
optional RunPod provider (`@ai-sdk/openai-compatible`) and this README.

## Run it locally (Windows, Mac, Linux)

Prerequisites: **Node.js 24 LTS** (see [`.nvmrc`](./.nvmrc); run `nvm use` if you
use nvm) and git.

macOS / Linux:

```bash
git clone https://github.com/Jie-coder/hoo-lee-sheet-sdc2026.git
cd hoo-lee-sheet-sdc2026
npm ci
cp .env.example .env.local
# put AI_MOCK=true in .env.local if you have no keys yet
npm run dev
# open http://localhost:3000
```

Windows (PowerShell):

```powershell
git clone https://github.com/Jie-coder/hoo-lee-sheet-sdc2026.git
cd hoo-lee-sheet-sdc2026
npm ci
Copy-Item .env.example .env.local
# put AI_MOCK=true in .env.local if you have no keys yet
npm run dev
# open http://localhost:3000
```

The app runs with an empty `.env.local`: `/status` just shows red checks for
whatever is missing instead of crashing. Ask Bing Jie for the real keys. Never
paste them into chat, code, issues or commits.

### Supabase note

The team's Supabase project already has the `items` table created, with Row
Level Security enabled (see [`supabase/schema.sql`](./supabase/schema.sql)
for the exact definition). You do not need to run anything in Supabase to use
the shared project — just set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
in `.env.local`.

`supabase/schema.sql` exists to **document** that table and to let anyone
recreate it if a new Supabase project is ever needed: paste its contents into
the Supabase SQL editor for the new project.

## Replit (compulsory sponsor platform)

Replit is compulsory. The proof we submit is the **live Replit deployment URL**
(or the Replit project link). The project lives in **Bing Jie's own Replit
account**.

The repo already contains a [`.replit`](./.replit) file, so nothing needs to be
configured by hand:

| Setting in `.replit` | What it does |
|---|---|
| `modules = ["nodejs-24"]` | Uses Node.js 24, same as `.nvmrc` and `engines`. |
| `run` | The **Run** button runs `npm install`, then `next dev` on `0.0.0.0:3000` so the Replit preview can reach it. |
| `[[ports]]` 3000 → 80 | Maps the app's port 3000 to the public URL. Autoscale allows only one external port. |
| `[deployment]` | **Autoscale** deployment: build with `npm ci && npm run build`, run with `npm run start` on `0.0.0.0:3000`. |

`next.config.ts` also allows the `*.replit.dev` preview domain in dev mode
(`allowedDevOrigins`), otherwise Next.js blocks hot reload in the Replit preview.

### Steps

1. Sign in to Replit with Bing Jie's account → **Create App** → **Import from
   GitHub** → pick `Jie-coder/hoo-lee-sheet-sdc2026` (authorise the Replit
   GitHub app for this private repo if asked).
2. Open the **Secrets** tool and add the variables from the
   [environment variables](#environment-variables) table (at least
   `AI_PROVIDER=google`, `GOOGLE_GENERATIVE_AI_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`). Secrets are the only place keys go on Replit:
   never commit a `.env` file and never put keys in `.replit`.
3. Press **Run**. The preview should show the home page; open `/status` to check
   every integration is green.
4. Press **Deploy** / **Publish**, choose **Autoscale**, and make sure the
   secrets are available to the deployment as well (check the deployment's
   secrets or environment settings).
5. Open the deployed `https://….replit.app` URL, check `/status` again, and save
   that URL. It goes into the submission form as our Replit proof.

To get new commits onto Replit, pull from GitHub in Replit's **Git** tool and
then redeploy.

## Vercel (backup only)

Vercel is a backup in case Replit has problems on demo day; Replit stays the
official platform.

1. Import this GitHub repo into Vercel as a **new** project. Do not reuse
   the `sdc-starter` project or any other existing project.
2. Add the same environment variables in the project settings.
3. Deploy, then check `/status` on the deployed URL.

## Optional: RunPod (self-hosted model)

RunPod is **optional and off by default**. Gemini stays the default provider,
and `AI_MOCK=true` still skips every AI call, whichever provider is set.

How it works: RunPod's vLLM workers expose an **OpenAI-compatible API**, so
`src/lib/ai.ts` connects to it with `@ai-sdk/openai-compatible`, using the same
Zod schema as Gemini. Setup:

1. On RunPod, deploy a **Serverless vLLM** endpoint with an instruction-tuned
   model (for example a small Gemma or Qwen model).
2. Set these (in `.env.local` locally, or in Replit Secrets):
   - `AI_PROVIDER=runpod`
   - `RUNPOD_BASE_URL=https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1`
   - `RUNPOD_API_KEY=<your RunPod API key>`
   - `AI_MODEL=<the model name you deployed, e.g. google/gemma-3-1b-it>`
3. Restart the app and open `/api/health?deep=1` to make one test call.

To switch back to Gemini, set `AI_PROVIDER=google` (or leave it empty).

> **GPU rule: save results, then shut it down.** GPUs cost money every minute.
> As soon as you have what you need, save the results (copy the output into
> the repo, for example as a fixture, or into our shared notes), then **stop
> or delete the RunPod pod/endpoint** (for Serverless, set max workers to 0
> or delete the endpoint). Never leave a GPU running overnight or unattended,
> and never commit `RUNPOD_API_KEY`.

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local` (git-ignored) for local
work, or add them as **Replit Secrets** / Vercel environment variables. All of
them are read server-side only; none are exposed to the browser.

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | No | `google` (default if empty) or `runpod`. Any other value gives a readable error on `/status`. |
| `AI_MODEL` | Only for RunPod | Gemini: optional model override (empty = default in `src/lib/ai.ts`). RunPod: the deployed model name (required). |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes for Gemini, unless `AI_MOCK=true` | Google AI Studio API key. |
| `AI_MOCK` | No | `true` returns `src/fixtures/sample-response.json` instead of calling any AI provider. Defaults to `false`. |
| `SUPABASE_URL` | Yes | The team's Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key. Server-side only and full database access, so treat it like a password. |
| `RUNPOD_BASE_URL` | Only if `AI_PROVIDER=runpod` | `https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1` |
| `RUNPOD_API_KEY` | Only if `AI_PROVIDER=runpod` | RunPod API key. |

## Mock mode

Set `AI_MOCK=true` in `.env.local` and restart the dev server
(`npm run dev`). With mock mode on:

- `POST /api/analyze` returns the contents of
  [`src/fixtures/sample-response.json`](./src/fixtures/sample-response.json)
  after a short artificial delay (~800 ms), so the demo page's loading
  skeletons are visible.
- The JSON response includes `"source": "mock"` (it's `"live"` for a real
  AI call), and the demo page shows a "Mock mode" badge.
- The AI provider check on `/status` and `GET /api/health` is skipped with a
  note, since no real API call is made.

This means a demo never depends on a live API call or key being present.

## How we work: commits and pull requests

The rules ask for a genuine commit history, so:

- **Never push straight to `main`** once building starts. Make a branch per
  task: `git switch -c feat/short-name` (or `fix/…`, `docs/…`).
- Commit small, working steps with clear messages in this style:
  `feat: …`, `fix: …`, `docs: …`, `chore: …`. No single giant
  "everything" commit at the end.
- Before opening a PR, run `npm run lint` and `npm run build` (with
  `AI_MOCK=true` if you have no keys).
- Push the branch and open a **pull request** into `main`; another teammate
  reviews it before it is merged. Everyone should be able to explain the code
  they merge.
- **Never commit secrets.** `.env*` files are git-ignored (except
  `.env.example`, which has empty values only). If a key is ever committed or
  pasted somewhere public, tell Bing Jie immediately so it can be rotated.
- Use git author details that are linked to your GitHub account.

## Licence and visibility

- Licensed under the **Apache License 2.0**; see [`LICENSE`](./LICENSE).
- The repo is **private while we build**. ⚠️ **It must be made public before
  submission** (Settings → General → Danger Zone → Change visibility), and the
  committee's GitHub accounts must be added as collaborators once the organisers
  share their usernames. Double-check that no secrets are in the history
  before making it public.

## API routes

Examples below assume the app is running locally at `http://localhost:3000`.
Each one is given as a `bash`/macOS/Linux `curl` command and as a Windows
PowerShell `Invoke-RestMethod` command, since quoting JSON differs between
the two.

### `POST /api/analyze` — mock mode (`AI_MOCK=true`)

```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"input":"Example input text for the mock path."}'
```

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/analyze `
  -ContentType "application/json" `
  -Body '{"input":"Example input text for the mock path."}'
```

### `POST /api/analyze` — live mode (`AI_MOCK=false`, valid Gemini key or RunPod endpoint)

```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"input":"A short piece of neutral example text to analyze."}'
```

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/analyze `
  -ContentType "application/json" `
  -Body '{"input":"A short piece of neutral example text to analyze."}'
```

### `POST /api/analyze` — invalid input (expect `400`)

```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"input":""}'
```

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/analyze `
  -ContentType "application/json" `
  -Body '{"input":""}'
```

### `GET /api/health`

```bash
curl -s http://localhost:3000/api/health
```

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/health
```

### `GET /api/items`

```bash
curl -s http://localhost:3000/api/items
```

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/items
```

### `POST /api/items`

```bash
curl -s -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"title":"Example item","data":{"note":"created from curl"}}'
```

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/items `
  -ContentType "application/json" `
  -Body '{"title":"Example item","data":{"note":"created from curl"}}'
```

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Next.js dev server at `http://localhost:3000`. |
| `npm run build` | Builds the app for production (also type-checks). |
| `npm run start` | Serves the production build created by `npm run build`. |
| `npm run lint` | Runs ESLint over the project. |

## Packages

Every dependency and devDependency in `package.json`, and why it's here.

### dependencies

| Package | Purpose |
|---|---|
| `@ai-sdk/google` | Vercel AI SDK provider for Google Gemini (the default provider); used by `src/lib/ai.ts` to create the model instance. |
| `@ai-sdk/openai-compatible` | Vercel AI SDK provider for any OpenAI-compatible API; used by `src/lib/ai.ts` only when `AI_PROVIDER=runpod`. Added during the hackathon. |
| `@base-ui/react` | Unstyled, accessible component primitives that the installed shadcn/ui components (`src/components/ui/*`) are built on, in place of Radix UI. |
| `@supabase/supabase-js` | Supabase client library; used server-side in `src/lib/supabase.ts` to query/insert into the `items` table. |
| `ai` | Vercel AI SDK core — `generateText` and structured `Output.object` used in `src/lib/ai.ts` and `src/lib/health.ts`. |
| `class-variance-authority` | Defines component style variants (e.g. badge colors, button variants) for the shadcn/ui components. |
| `cn` | Small utility imported directly as `import { cn } from "cn"` that merges Tailwind class names; the "`cn()`" helper shadcn/ui components use throughout. |
| `lucide-react` | Icon set used by shadcn/ui components. |
| `next` | The Next.js framework (App Router, API routes, bundler, dev server). |
| `next-themes` | Theme (light/dark) support used by the shadcn/ui toast component (`sonner`). |
| `react` | UI library Next.js is built on. |
| `react-dom` | React's DOM renderer, paired with `react`. |
| `server-only` | Build-time guard that fails the build if a server-only file (`src/lib/ai.ts`, `src/lib/supabase.ts`, `src/lib/env.ts`, `src/lib/health.ts`) is ever imported into client code. |
| `shadcn` | The shadcn/ui CLI, used to scaffold `components.json` and generate the `src/components/ui/*` files and base Tailwind styles. |
| `sonner` | Toast notification library; wrapped by `src/components/ui/sonner.tsx` and used on the demo page for success/error messages. |
| `tw-animate-css` | Tailwind CSS animation utility classes used by shadcn/ui components (e.g. skeleton pulse, toast transitions). |
| `zod` | Schema validation; defines the AI output schema and API request schemas in `src/lib/schema.ts`. |

### devDependencies

| Package | Purpose |
|---|---|
| `@tailwindcss/turbopack` | Tailwind CSS v4 integration for Next.js's Turbopack dev/build pipeline. |
| `@types/node` | TypeScript types for Node.js APIs. |
| `@types/react` | TypeScript types for React. |
| `@types/react-dom` | TypeScript types for react-dom. |
| `eslint` | Lints the codebase; run via `npm run lint`. |
| `eslint-config-next` | Next.js's recommended ESLint rules. |
| `tailwindcss` | Utility-first CSS framework used throughout the app and by shadcn/ui components. |
| `typescript` | TypeScript compiler; strict mode is enabled and the `any` type is not used. |

## Cross-platform notes

This project is built to run the same way on Windows, macOS and Linux:

- [`.gitattributes`](./.gitattributes) forces `* text=auto eol=lf`, so line
  endings stay consistent regardless of OS or editor.
- [`.nvmrc`](./.nvmrc) pins Node to `24`, and `package.json` declares
  `"engines": { "node": ">=24" }`.
- npm scripts use only plain `next`/`eslint` commands — no bash-only syntax
  (no `&&` env tricks, no `rm -rf`, no `export`), so they work in PowerShell,
  Git Bash and any POSIX shell without modification.
- There are no `.sh` shell scripts in this repo. The Replit-only commands
  (binding to `0.0.0.0`, port `3000`) live in [`.replit`](./.replit), not in
  `package.json`, so `npm run dev` stays the same everywhere.
- The code currently reads no files at runtime. If you add a file path, build
  it with Node's `path.join(...)` rather than hardcoded `/` or `\` separators,
  and keep import paths' letter casing exactly matching the file names
  (macOS/Windows ignore case, Linux and Vercel do not).
- The mock fixture is a static JSON import
  (`import sample from "@/fixtures/sample-response.json"`) rather than a
  runtime file read, which is both OS-path-safe and Vercel-serverless-safe.

## AI assistance

The pre-existing starter was generated with AI coding assistance under human
supervision. See [DECLARATION.md](./DECLARATION.md). Work done during the
hackathon may also use AI assistance, and the team reviews everything before it
is merged.
