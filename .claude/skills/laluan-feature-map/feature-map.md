# Laluan feature map

Hand-written. `npm run feature-map:check` fails if a route in `src/app` has no
`### Route:` heading here, or if a `data-testid` in the code is not mentioned
in backticks. Machine-found facts: `routes.generated.json`. Picture: `feature-map.png`.

User journey: `/` -> `/profile` -> `/interview` -> `/results` -> `/pathway`.
Side pages: `/radar`, `/status`, `/demo`.

## Global: site header (every page)

- Logo link `header-home` (aria-label "Laluan home") -> goes to `/`.
- Progress stepper (Profile, Interview, Results, Pathway) is display-only on flow pages.
- Course language group (aria-label "Course language"): buttons EN / BM / 中文.

### Route: `/`

Landing page (`src/components/landing-view.tsx`).
- Reach: open `/`.
- Elements:
  - `landing-consent` (role checkbox): tick "I understand Laluan uses synthetic CVs...".
  - `landing-start` (button "Start").
- Expected: Start with consent -> `/profile`. Start without consent -> stays on `/`,
  consent label shakes and gets focus (flow `consent-guard`).

### Route: `/profile`

Pick a sample CV or upload one (`src/components/profile-view.tsx`).
- Reach: `/` -> tick `landing-consent` -> `landing-start`.
- Elements:
  - `persona-card-*` (role radio), ids: `persona-card-aisyah`, `persona-card-lim-jia-hui`, `persona-card-pravin`.
    Keyboard: Enter or Space selects a focused card. "View CV" link opens the PDF in a new tab.
  - `profile-upload-browse` (button "browse"): opens file picker (synthetic PDF, max 2 MB); drag-and-drop also works.
  - After choosing: editable skills (Enter adds a skill, Escape cancels), roles, education,
    course language chips; "Remove ..." buttons by aria-label.
  - `profile-continue` (button "Continue").
- Expected: details panel appears after choosing a CV; Continue -> `/interview`.

### Route: `/interview`

Five quick questions (`src/components/interview-view.tsx`).
- Reach: full journey to `/profile`, choose a persona, `profile-continue`.
- Elements: answer chips (buttons with aria-pressed), task-share sliders,
  `interview-back` ("Back", disabled on question 1), `interview-skip` ("Skip"),
  `interview-next` ("Next"; on question 5 it reads "See results").
- Expected: after the 5th `interview-next` -> `/results`.

### Route: `/results`

Ranked roles for the profile, from `POST /api/roles` (curated data, no secrets).
- Reach: finish `/interview`.
- Elements:
  - `scenario-tab-*` (role tab): `scenario-tab-co` Co-Pilot Economy, `scenario-tab-dis`
    Age of Displacement, `scenario-tab-sup` Supercharged Progress.
    Keyboard: ArrowLeft/ArrowRight/ArrowUp/ArrowDown move between tabs, Home/End jump to first/last.
  - Trend signal date toggle (role group "Trend signal date"): latest vs 30 days earlier.
  - `role-choose` (one per role card, "Choose this role").
  - `results-radar-link` -> `/radar`.
  - `results-retry` ("Try again", only shown when the API call fails).
- Expected: ranking reorders per scenario; `role-choose` -> `/pathway?role=<occupationId>`.

### Route: `/pathway`

Week-by-week plan for the chosen role (`src/components/pathway-view.tsx`).
- Reach: on `/results`, click a `role-choose`.
- Elements: course links (open provider site), `pathway-back-to-roles` (-> `/results`),
  `pathway-download` ("Download PDF": shows a toast that download is not available in the demo),
  `pathway-delete-data` ("Delete my data": clears flow state, -> `/`).
- Expected: heading "Your N-week route to <role>".

### Route: `/radar`

Future Skills Radar, rising/declining skills from arXiv keyword counts (`src/components/radar-view.tsx`).
- Reach: open `/radar`, or `results-radar-link` on `/results`.
- Elements: trend signal date toggle, keyword links (arXiv), info popovers,
  `radar-match-skills` ("Match your own skills" -> `/`).
- Expected: rising and declining lists render from `data/keywords*.csv`.

### Route: `/status`

Integration health checks (`src/app/status/page.tsx`).
- Reach: open `/status` (not linked from the UI).
- Expected: one card per integration, badge "OK" or "Error". Needs `.env` secrets for OK.

### Route: `/demo`

Starter demo of `/api/analyze` (`src/app/demo/page.tsx`).
- Reach: open `/demo` (not linked from the UI).
- Elements: `demo-input` (textarea), `demo-load-example`, `demo-submit`,
  `demo-save` (shown after a result; POSTs to `/api/items`, needs Supabase).
- Expected: result cards; "Mock mode" badge when `AI_MOCK=true`.
