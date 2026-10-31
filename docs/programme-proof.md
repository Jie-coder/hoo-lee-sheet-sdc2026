# Programme completion proof (self-reported)

Mentor feedback: "prove they finished". On the pathway page each stop has a
"Mark as done" checkbox and, once done, an optional certificate link field.
The page header shows "N/M programmes done".

## What it does
- Storage: browser `localStorage`, key `laluan:progress:v1:<roleId>` (one entry per chosen role's pathway). Shape: `{ [itemId]: { completedAt, certificateUrl? } }`.
- Code: `src/lib/programme-progress.ts` (helpers + tests in `programme-progress.test.ts`), UI in `src/components/pathway-view.tsx`.
- SSR-safe: helpers return `{}` / no-op without `window`; the component reads storage after mount.
- The certificate link must be a valid `http(s)` URL; anything else (e.g. `javascript:`) is rejected on save and dropped on load.
- "Delete my data" on the pathway page also clears this role's saved progress.
- No network calls. Nothing leaves the browser.

## What it does not do
- It is **self-reported**: the UI says so. A pasted link is not checked, fetched or matched to the learner.
- No Coursera OAuth, API or certificate verification.

## Future work
- Verified Coursera certificate integration: [待确认] (whether Coursera offers a suitable API/partnership, what it would require, and who owns it are all unconfirmed).
- Progress is per browser: it does not sync across devices and is lost if site data is cleared. Server-side storage would need a privacy review first ([待确认]).
- `src/components/privacy-view.tsx` lists browser storage; adding this `localStorage` key to the privacy copy is [待确认] with the team.
