# SDC Starter

A minimal, deployable Next.js starter built ahead of the SDC Hackathon so the
team can start on the actual product the moment the problem is revealed. It
has no domain-specific features — just the infrastructure every team needs:

- Next.js (App Router, TypeScript, `src/`) with Tailwind CSS and shadcn/ui.
- A small AI layer (`src/lib/ai.ts`, Google Gemini via the Vercel AI SDK)
  that returns validated, structured JSON checked with Zod — with a **mock mode** so a
  demo never depends on a live API call.
- A Supabase connection with one test table (`items`).
- A `/demo` page that exercises the AI layer and renders the result as cards.
- A `/status` page and `GET /api/health` that check every integration.

See [DECLARATION.md](./DECLARATION.md) for the pre-hackathon work declaration
and the full list of libraries/services used.

## Prerequisites

- **Node.js 24 LTS** ("Krypton"), matching [`.nvmrc`](./.nvmrc). Check with
  `node -v`. If you use `nvm`, run `nvm use` in the project folder.
- **git**.
- Accounts (ask the team lead for the actual keys/URLs — do not create your own
  Supabase project for this repo):
  - A **Google AI Studio** API key (Gemini), for `GOOGLE_GENERATIVE_AI_API_KEY`.
  - The team's **Supabase** project URL and service role key.
  - A **GitHub** account with access to this repo.
  - A **Vercel** account linked to GitHub, if you'll deploy.

## Setup

### macOS / Linux (Terminal)

```bash
git clone https://github.com/Jie-coder/sdc-starter.git
cd sdc-starter
npm install
cp .env.example .env.local
# fill in the values in .env.local (ask the team lead for keys)
npm run dev
# open http://localhost:3000
```

### Windows (PowerShell)

```powershell
git clone https://github.com/Jie-coder/sdc-starter.git
cd sdc-starter
npm install
Copy-Item .env.example .env.local
# fill in the values in .env.local (ask the team lead for keys)
npm run dev
# open http://localhost:3000
```

The app runs fine with an empty `.env.local` — `/status` will just show red
checks for whatever is missing instead of crashing.

### Supabase note

The team's Supabase project already has the `items` table created, with Row
Level Security enabled (see [`supabase/schema.sql`](./supabase/schema.sql)
for the exact definition). You do not need to run anything in Supabase to use
the shared project — just set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
in `.env.local`.

`supabase/schema.sql` exists to **document** that table and to let anyone
recreate it if a new Supabase project is ever needed: paste its contents into
the Supabase SQL editor for the new project.

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local` and fill in the values.
`.env.local` is git-ignored and must never be committed.

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | Yes | Must be `google` — it's the only supported provider in this starter. Any other value produces a clear error instead of a crash. |
| `AI_MODEL` | No | Optional override of the Gemini model id. Leave empty to use the built-in default. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes, unless `AI_MOCK=true` | API key from Google AI Studio, used server-side only. |
| `AI_MOCK` | No | `true` makes `/api/analyze` return the fixture in `src/fixtures/sample-response.json` instead of calling Gemini. Defaults to `false`. |
| `SUPABASE_URL` | Yes | The Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key, used server-side only (never exposed to the browser). |

## AI provider and model

This starter only supports **Google Gemini** (`AI_PROVIDER=google`). The
`AI_PROVIDER` and `AI_MODEL` variables are kept so switching providers later
is a small, contained change, but right now any value other than `google`
returns a readable error from `getModel()` in
[`src/lib/ai.ts`](./src/lib/ai.ts) instead of throwing.

- Leave `AI_MODEL` empty to use the default model, a constant
  (`DEFAULT_GOOGLE_MODEL`) defined at the top of `src/lib/ai.ts`.
- Set `AI_MODEL` to any other Gemini model id to override it, e.g.
  `AI_MODEL=gemini-3.5-flash-lite`.
- Model ids change often; check https://ai.google.dev/gemini-api/docs/models
  for the current list.

## Mock mode

Set `AI_MOCK=true` in `.env.local` and restart the dev server
(`npm run dev`). With mock mode on:

- `POST /api/analyze` returns the contents of
  [`src/fixtures/sample-response.json`](./src/fixtures/sample-response.json)
  after a short artificial delay (~800 ms), so the demo page's loading
  skeletons are visible.
- The JSON response includes `"source": "mock"` (it's `"live"` for a real
  Gemini call), and the demo page shows a "Mock mode" badge.
- The AI provider check on `/status` and `GET /api/health` is skipped with a
  note, since no real API call is made.

This means a demo never depends on a live API call or key being present.

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

### `POST /api/analyze` — live mode (`AI_MOCK=false`, valid Gemini key)

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
| `@ai-sdk/google` | Vercel AI SDK provider for Google Gemini; used by `src/lib/ai.ts` to create the model instance. |
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

## Folder structure

Generated from the files tracked in git (excludes `node_modules` and `.next`):

```
sdc-starter/
  .env.example
  .gitattributes
  .gitignore
  .nvmrc
  AGENTS.md
  README.md
  DECLARATION.md
  components.json
  eslint.config.mjs
  next.config.ts
  package-lock.json
  package.json
  tsconfig.json
  public/
    file.svg
    globe.svg
    next.svg
    vercel.svg
    window.svg
  src/
    app/
      favicon.ico
      globals.css
      layout.tsx            root layout: fonts, Toaster, SiteHeader
      page.tsx               placeholder landing page
      demo/
        page.tsx              AI demo page (client component)
      status/
        page.tsx               integration health page (server component)
      api/
        analyze/route.ts        POST: input text, returns structured JSON
        health/route.ts         GET: checks env vars, Supabase, AI provider
        items/route.ts          GET list, POST create (Supabase test table)
    components/
      result-cards.tsx       renders the structured AI result
      site-header.tsx        simple top navigation
      ui/                     shadcn/ui components
        badge.tsx
        button.tsx
        card.tsx
        input.tsx
        separator.tsx
        skeleton.tsx
        sonner.tsx
        textarea.tsx
    lib/
      ai.ts                   provider selection and analyze() function
      env.ts                   reads and checks environment variables
      health.ts               shared checks used by /status and /api/health
      schema.ts               Zod schemas for AI output and request bodies
      supabase.ts             server-only Supabase client
    fixtures/
      sample-response.json   saved AI response used in mock mode
  supabase/
    schema.sql                SQL documenting the items table
```

## Cross-platform notes

This starter is built to run the same way on Windows, macOS and Linux:

- [`.gitattributes`](./.gitattributes) forces `* text=auto eol=lf`, so line
  endings stay consistent regardless of OS or editor.
- [`.nvmrc`](./.nvmrc) pins Node to `24`, and `package.json` declares
  `"engines": { "node": ">=24" }`.
- npm scripts use only plain `next`/`eslint` commands — no bash-only syntax
  (no `&&` env tricks, no `rm -rf`, no `export`), so they work in PowerShell,
  Git Bash and any POSIX shell without modification.
- There are no `.sh` shell scripts in this repo.
- The code currently reads no files at runtime. If you add a file path, build
  it with Node's `path.join(...)` rather than hardcoded `/` or `\` separators,
  and keep import paths' letter casing exactly matching the file names
  (macOS/Windows ignore case, Linux and Vercel do not).
- The mock fixture is a static JSON import
  (`import sample from "@/fixtures/sample-response.json"`) rather than a
  runtime file read, which is both OS-path-safe and Vercel-serverless-safe.

## Deployment (Vercel)

1. Import this GitHub repo into Vercel.
2. In the Vercel project's Environment Variables settings, add every
   variable from `.env.local` (`AI_PROVIDER`, `AI_MODEL`,
   `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_MOCK`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`).
3. Set `AI_MOCK=false` for the deployed environment so `/demo` makes real
   Gemini calls.
4. Deploy, then open `/status` on the deployed URL and confirm every check is
   green.
5. Live URL: **https://sdc-starter.vercel.app**

## Hackathon-day handover notes

Once the problem is revealed, replace the generic pieces with the real
product:

- Replace the system prompt constant in `src/lib/ai.ts` and the
  `AnalysisResult` schema in `src/lib/schema.ts` with the domain-specific
  versions.
- Replace `src/fixtures/sample-response.json` with a real, polished example
  for the demo path.
- Rename or replace the `items` table to match the domain.
- Rebuild the home page (`src/app/page.tsx`) as the actual product landing
  page.
- Keep the `/status` page — it's useful for a last check of the deployment
  just before the pitch.

## AI assistance

Parts of this starter were generated with AI coding assistance under human
supervision. See [DECLARATION.md](./DECLARATION.md) for which tools were
used and how.
