# Laluan data files

Hand-collected seed data. Each file is exported as CSV from the team's Google Sheets and committed by the person who collected it. Every row must be checked against the official page and carry a date. Never guess a value: leave it blank and explain in `notes`.

Lists inside one cell use a comma for codes (`en,ms`) and a semicolon for names and URIs (`skill a; skill b`).

## Tiffany: courses and programmes (due: 30 courses + 5 programmes on 21 Oct, about 60 + 10 on 22 Oct)

### `courses.csv`
| column | values |
|---|---|
| id | c001, c002, ... |
| title, provider, url | as shown on the official course page |
| languages | en, ms, zh (comma-separated if several) |
| hours | number |
| cost_type | free, subsidised, hrdcorp_claimable, paid (free audit with a paid certificate = free, certificate no, note it) |
| certificate | yes / no |
| skills | ESCO skill names, 1 to 4, semicolon-separated |
| skill_uris | ESCO URIs in the same order, semicolon-separated |
| sdg_target | 4.3 or 4.4 |
| sdg_reason | one sentence |
| summary | one sentence in our own words (do not copy the site) |
| last_checked | YYYY-MM-DD |
| notes | anything uncertain |

Language mix: at least 10 BM courses, at least 5 Chinese courses, the rest English.

### `programmes.csv`
| column | values |
|---|---|
| id | p001, p002, ... |
| name, agency, url | from the official site only |
| benefits | one sentence |
| cost_type | free, subsidised, hrdcorp_claimable, paid |
| deadline | YYYY-MM-DD or blank |
| age_min, age_max | number or blank |
| citizen | yes / no / blank (not stated) |
| employment | employed, underemployed, unemployed, student, self_employed (comma-separated), or `any` alone |
| perkeso_contributor | yes / no / blank |
| states | johor, kedah, kelantan, melaka, negeri_sembilan, pahang, perak, perlis, pulau_pinang, sabah, sarawak, selangor, terengganu, kuala_lumpur, labuan, putrajaya (comma-separated), or `all` alone |
| last_checked | YYYY-MM-DD |
| notes | anything uncertain |

## Henry: AI-trend signals (due: sources 20 Oct, keywords 21 Oct, exposure 22 Oct)

### `sources.csv`
`name, url, publisher, what_it_measures, update_frequency, last_updated, data_format (API / CSV / PDF only), licence, use_for (exposure / trend / scenario), notes`

The licence must be filled in. A source with unclear or no-reuse terms can't be used for scoring.

### `keywords.csv` (about 25 arXiv keywords)
`keyword, arxiv_query, skills, skill_uris, direction (up / down), count_last_90d, count_prev_90d, checked_on`

Drop keywords with fewer than 20 papers in the last 90 days, and keywords that are too broad.

### `exposure.csv` (the 40 occupations; Peter sends the draft list by 20 Oct)
`occupation, code (ISCO or ESCO), exposure_value (copied as published), scale (e.g. 0-1, %, ILO gradient 1-4), source_name, source_url, table_or_page, as_of, notes`

Never invent a number. If there's no exact match, use the closest occupation and explain the match in `notes`.
