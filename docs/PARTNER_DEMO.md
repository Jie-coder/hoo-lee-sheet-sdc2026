# Be Our Partner: demo disclosure

The "Be Our Partner" page (`/partner`) and the Sponsored cards on the pathway are a **front-end demo** for the SDC finals.

- **Fictional partners.** SkillForge Academy, Northbridge Learning and Northbridge University are made-up names. They are not affiliated with, and do not refer to, any real organisation. Their course titles, badges ("100k+ learners", "4.8 ★ · 2k reviews", "Partnered with …") and prices (RM 199 / RM 299, etc.) are invented.
- **Fictional pricing.** RM 0.80 / click, RM 25 / enrolment and RM 1,500 / month are illustrative, not a real rate card.
- **No real links or data.** Card links are `#`. The application form is prefilled with fictional details, never sends a request and stores nothing.
- **Never affects results.** Sponsored data (`src/data/sponsored-courses.json`) is never read by scoring, ranking, `buildPathwayPlan`, stops, weeks, the free count, the trend lock, progress or the certificate. It is hidden in print/PDF.
- **Caps.** At most 1 sponsored card per stop and 3 per pathway, only where the stop closes a skill gap. Free and government courses always come first.
