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

## Not covered
Keyword choice, arXiv indexing lag, and snapshot-to-snapshot drift. The prior/today spread was considered but
there are only 2 snapshots, too few for a spread estimate. Role-level bands (and the "Trend ±x.x pts" row in PR #86) are not wired here because #86 is not on main.
