<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Open the app at `http://localhost:3000`. Next.js dev mode does not hydrate `http://127.0.0.1:3000`, so the landing hero stays blank on that host.
- The environment start script runs `npm run dev` with `AI_MOCK=true`. Sample CVs, mocked CV parsing, and role ranking use the bundled catalogue. Supabase and a Gemini key are not required for that path.
- Node.js 24 is required (`.nvmrc` and `engines`). The environment install puts `node` and `npm` on `/usr/local/bin`.

