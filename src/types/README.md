# Shared contracts

`contracts.ts` is the source of truth for shapes the client and the server both use. Import a Zod schema to parse, and use the inferred type (`export type ParsedCV = z.infer<typeof ParsedCVSchema>`). Run `npm test` to check them.

There is no login and no CV file storage. These shapes have no `user_id` and no `cv_path`. Objects are strict, so those keys fail validation.

Section 08 contracts (`ParsedCV`, `RoleResult`, `PlanStep`, and the analyze response) use camelCase. Interview slot keys and the programme eligibility JSON stay snake_case, matching sections 03 and 07.

| Export | One line |
|---|---|
| `IsoDate` | Calendar date `YYYY-MM-DD`, the grain of `as_of` and release dates. |
| `UnitScore` | A number in `[0, 1]` (exposure, augmentation, fit, SDG confidence). |
| `scoreBand` | Maps a unit score to Low / Medium / High using the section 05 cut points. |
| `SdgTargetId` | A target id such as `"8.6"`. Goal-only labels are rejected. |
| `ScenarioId` | `co`, `dis`, or `sup`. |
| `CostType` | `free`, `subsidised`, `hrdcorp_claimable`, or `paid`, in that pathway order. |
| `LanguageCode` | `en`, `ms`, or `zh`. |
| `AiUsage` | `none`, `tried`, `occasional`, or `regular`. |
| `AgeBand` | Interview age chip. `AGE_BAND_RANGES` gives inclusive min/max for eligibility. |
| `MalaysiaState` | State or federal territory code used by slots and eligibility. |
| `EmploymentStatus` | `employed`, `underemployed`, `unemployed`, `student`, or `self_employed`. |
| `ImpactInterest` | `environment`, `education`, `health`, `community`, or `none`. |
| `Source` | Source chip: dataset name, release date, url, and `asOf` (the brief's `as_of`). |
| `SdgSubject` | `{kind: "occupation", occupationId}` or `{kind: "skill", skillId}`. |
| `SdgLink` | Target-level claim: subject, `kind` role\|transition, tier, confidence, reason, source. |
| `ParsedCV` | CV parse: optional name, roles, skills, education, languages. |
| `TaskShare` | A current task (`text`) plus its fraction of the week (`share` in `[0, 1]`). |
| `PartialSlots` | Interview slots filled so far. Omitted keys are unknown. |
| `Slots` | Complete section 03 slots. Task shares must sum to 1. `languages` is one or more of `en`, `ms`, `zh`. `budget` is MYR (0 = none). `hours_per_week` is at most 168. |
| `InterviewTurn` | Question, chips, `filled` partial slots, and `done`. |
| `GapSkill` | Missing skill: `skillId`, label, importance. At most five on a role card. |
| `ScenarioScores` | Ranking score `R` for `co`, `dis`, and `sup`. |
| `RoleResult` | Role card, including `signalsAsOf` and an optional plain-language `explanation`. |
| `SignalReading` | One skill metric over a window. Momentum (`value`) may be negative. |
| `SignalSnapshot` | Readings that share one `asOf`. Compare two snapshots to re-rank cards. |
| `CurrentWorkScores` | Exposure and augmentation of the user's current work, with sources. |
| `AnalyzeResponse` | Current-work scores, role cards, and the `signalsAsOf` they were computed from. |
| `ProgrammeEligibility` | Section 07 eligibility JSON. Null turns a rule off. `"any"` / `"all"` stand alone. |
| `Course` | Curated course the pathway cites by id. `languages` lists every language it is offered in. |
| `Programme` | Government programme, including eligibility and a cost type for ordering. |
| `PlanStep` | ID-only step: course or `program`, 1-based weeks, skills closed, optional SDG target, why. |
| `PathwayPlan` | Steps for one occupation. No profile id. URLs are resolved from the catalogue, not written by the model. |

`MAX_INTERVIEW_TURNS` is 5. A course matches a user's language preference when the two `languages` lists intersect. Skill-level SDG links use `SdgLink` with `subject.kind === "skill"`; they are not copied onto the gap array. A role card's `sdg` list is one to three links whose subject is that occupation.
