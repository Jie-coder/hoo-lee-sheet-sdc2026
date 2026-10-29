# Trend uncertainty band (T04, Kai, P1)

No written spec existed for the band (searched docs/, GitHub issues, PR #86/#87 bodies, /workspace/sdc-finals). Sources:
Tasks.csv T04 "Uncertainty scenarios clearly labelled as estimates. Kai: uncertainty band", Must-have 6, and
the Domain 1 guide's Innovation criterion ("trend tracking that ... shows uncertainty").

## Method
Per keyword, momentum m = ln((r+1)/(p+1)) with r, p = arXiv paper counts in the last / previous 90 days.
Treating r and p as Poisson counts, the delta-method standard error is SE = sqrt(1/(r+1) + 1/(p+1)).
A skill's momentum is the mean over its k keywords, so SE_skill = sqrt(sum SE_i^2) / k (keywords assumed independent).
Band = momentum ± 1.96 · SE (approximate 95% range). If the band crosses zero, the UI says the direction is not clear.

Every number comes from data/keywords.csv (or keywords_prior.csv for the prior snapshot); 1.96 is the standard normal 95% value.

## Labels on /radar
When a Rising or Falling skill's 95% range crosses zero, /radar shows "Unclear" (BM "Tidak jelas") instead. Flat skills, scores and other pages are unchanged. With today's snapshot this changes 5 of the 6 Rising/Falling labels (asserted in src/lib/radar.test.ts via countUnclearLabels).

## Limitations
- A skill's keywords are correlated (they overlap in papers and topics), but the method treats them as independent, so the band may be too narrow.
- arXiv indexing has a lag: recent papers can still be missing from the last-90-days count, which biases recent momentum down. The band does not cover this.
- Keyword choice is not covered: a different set of keywords for the same skill could give a different momentum.
- Only 2 snapshots exist, too few for a spread across snapshots.
- The band is on /radar only. It is not part of the rank score (see README, Future Improvements).
