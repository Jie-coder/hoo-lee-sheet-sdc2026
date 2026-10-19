# Laluan design system (v1, 19 Oct 2026, Grace)

Approved by Bing Jie: name **Laluan**, results page = `results-reference.png`. Style follows `/workspace/design-refs/pitch-style-guide.md` (Cowork style).
Reference: `/workspace/hackathon/design/results-reference.html` (copy classes from here).

## Tailwind theme (tailwind.config / CSS vars)
```js
colors: {
  paper: '#FAF9F5',   // page background
  ink:   '#141413',   // main text, primary dark buttons, active pills
  grey:  '#5E5D59',   // secondary text
  line:  '#E5E3DC',   // borders, hairlines
  alt:   '#F3F2EE',   // chips, bar tracks
  btn2:  '#EFEDE7',   // secondary button
  sage: { DEFAULT:'#2F7D5B', dark:'#24634A', tint:'#B9CFC6', soft:'#E6EFEA', wash:'#F1F6F3' } // the ONE accent
}
fontFamily: {
  serif: ['Newsreader','"Source Serif 4"','Georgia','serif'],     // headings + big numbers
  sans:  ['Inter','"Noto Sans CJK SC"','system-ui','sans-serif'], // body/UI (CJK fallback for 中文 courses)
}
```
shadcn/ui: map `--background`=paper, `--foreground`=ink, `--muted-foreground`=grey, `--border`=line, `--primary`=ink, `--accent`=sage. Radius: cards `rounded-2xl`, chips `rounded-md`, pills `rounded-full`. Icons: lucide, stroke 1.6.

## Rules
- Warm paper background, white cards with 1px `line` border, no heavy shadows. Lots of whitespace; max width 1248px.
- Serif only for headings and hero numbers (e.g. "High · 0.71"); everything else Inter.
- Only one accent colour (sage). No rainbow SDG colours in the UI; SDG badges use sage.
- Numbers: band + max two decimals ("Medium · 0.48"), `tabular-nums`.
- Desktop first (1440); must still work at 390px phone width (cards stack).
- English UI only. The EN / BM / 中文 pill = **course language preference**, not UI language.

## Components
- **Source chip**: `rounded-md border border-line bg-alt px-2 py-0.5 text-[11px] text-grey` + database icon: "Dataset · Month Year". On every score and role card.
- **SDG badge tiers** (always with legend): Direct = solid sage bg + white text; Supporting = sage outline + value; AI-suggested = dashed sage outline + "AI-suggested". Target-level ("4.4 Skills for work"), max 3 per role; each missing skill also gets one.
- **Scenario tabs** (3 WEF futures) + **signal-date switch** "30 days ago | Today" + Refresh button with "Last refreshed …". One plain-words line explaining the scenario, marked illustrative.
- **Role card**: status pill (e.g. "Robust in all 3 futures"), rank "#1 of 3", title (serif), fit % + bar, top-5 missing skills, SDG badges, source chips, primary button "Choose this role" (user decides).
- **Steps indicator** in header: Profile → Interview → Results → Pathway.
- **Fixed footer** on results & pathway: "All scores and forecasts are estimates. Laluan supports your decision; it does not make hiring decisions."
- **Exposure card** always shows "Exposure is not job loss." Augmentation is the hero card.

## Assets
- Logo: `/workspace/hackathon/branding/logos/laluan-logo.svg|png` (light), `laluan-logo-dark`, `laluan-mark`, `laluan-favicon`.
- Sample CVs: `/workspace/hackathon/cvs/` (Aisyah, Lim Jia Hui, Pravin) → repo `public/samples/`.

Remaining screens (landing/consent, sample-CV picker, interview, pathway) follow these same rules; wireframes coming 20 Oct night.
