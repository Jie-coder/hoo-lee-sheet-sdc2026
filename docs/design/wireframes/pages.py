def build(g):
    head, header, src, example_note, FIXED_FOOTER, END, write, COST, tag = (
        g["head"], g["header"], g["src"], g["example_note"], g["FIXED_FOOTER"], g["END"], g["write"], g["COST"], g["tag"])

    # ======================================================= 01 LANDING
    steps = [
        ("user-round", "Profile", "Pick a sample CV. We read your roles, tasks and skills, and you can edit them.", "About 1 min"),
        ("messages-square", "Interview", "Five quick questions with tap-to-answer chips, only about what the CV can't tell us.", "About 2 min"),
        ("gauge", "Results", "AI exposure and augmentation from dated public data, and three roles ranked under three possible futures.", "Scores + 3 roles"),
        ("route", "Pathway", "You pick a role. We build a week-by-week plan from free courses and government programmes.", "Free items first"),
    ]
    strip = "\n".join(f'''      <li class="rounded-2xl border border-line bg-white p-5 flex flex-col">
        <div class="flex items-center justify-between">
          <span class="w-8 h-8 rounded-full bg-sage-soft text-sage flex items-center justify-center"><i data-lucide="{ic}" class="w-4 h-4"></i></span>
          <span class="text-[12px] text-grey tabular-nums">Step {i}</span>
        </div>
        <h3 class="font-serif text-[22px] leading-tight font-medium mt-4">{t}</h3>
        <p class="text-[13px] text-grey leading-relaxed mt-1.5">{d}</p>
        <p class="mt-auto pt-4 text-[12px] text-ink flex items-center gap-1.5"><i data-lucide="clock-3" class="w-3.5 h-3.5 text-grey"></i>{m}</p>
      </li>''' for i, (ic, t, d, m) in enumerate(steps, 1))

    landing = head("Landing") + '<body class="bg-paper text-ink font-sans">\n\n' + header(0, ("EN",)) + f'''
<main class="max-w-[1248px] mx-auto px-4 md:px-6">

  <!-- ============ 1. HERO ============ -->
  <section class="pt-10 md:pt-16 pb-10 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-center">
    <div class="md:col-span-7">
      <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">FOR MALAYSIAN WORKERS · FREE · NO LOGIN</p>
      <h1 class="font-serif text-[40px] md:text-[56px] leading-[1.05] font-medium tracking-tight mt-3">See how AI changes your work <span class="text-grey/50">—</span> and the free path forward</h1>
      <p class="text-[16px] text-grey leading-relaxed mt-5 max-w-[560px]">Laluan reads a CV, asks five quick questions, and shows which of your tasks AI can amplify. Then you choose a future role and get a week-by-week plan built from free courses and government programmes.</p>
      <div class="mt-7 flex flex-wrap items-center gap-3">
        <a href="02-profile.html" class="inline-flex items-center gap-2 rounded-lg bg-ink text-white px-5 py-3 text-[15px] font-medium">Start<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
        <a href="#how" class="inline-flex items-center gap-2 rounded-lg bg-btn2 border border-line px-4 py-3 text-[14px] font-medium">How it works</a>
        <span class="text-[13px] text-grey flex items-center gap-1.5"><i data-lucide="timer" class="w-4 h-4"></i>Takes about 3 minutes</span>
      </div>
    </div>

    <!-- example result preview -->
    <div class="md:col-span-5">
      <div class="rounded-2xl border border-line bg-white p-6">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">WHAT YOU GET</p>
          <span class="rounded border border-line px-1.5 py-0.5 text-[11px] text-grey">Example result</span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-5">
          <div>
            <p class="text-[12px] text-grey">Augmentation</p>
            <p class="font-serif text-[36px] leading-none font-medium text-sage mt-1.5 tracking-tight">High <span class="text-sage-tint">·</span> 0.71</p>
          </div>
          <div class="border-l border-line pl-5">
            <p class="text-[12px] text-grey">AI exposure</p>
            <p class="font-serif text-[36px] leading-none font-medium mt-1.5 tracking-tight">Med <span class="text-grey/40">·</span> 0.48</p>
          </div>
        </div>
        <p class="text-[13px] text-ink font-medium mt-3">Exposure is not job loss.</p>
        <div class="mt-4 pt-4 border-t border-line">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-sage-soft text-sage-dark px-2.5 py-1 text-[12px] font-medium"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i>Robust in all 3 futures</span>
            <span class="text-[12px] text-grey">72% fit</span>
          </div>
          <p class="font-serif text-[22px] leading-tight font-medium mt-3">Data Operations Analyst</p>
          <div class="mt-2.5 flex flex-wrap gap-1.5 text-[12px]">
            <span class="rounded-md bg-sage text-white px-2 py-0.5 font-medium">4.4 Skills for work</span>
            <span class="rounded-md bg-sage text-white px-2 py-0.5 font-medium">5.5 Women in leadership</span>
          </div>
          <p class="text-[13px] text-grey mt-3 flex items-center gap-1.5"><i data-lucide="route" class="w-4 h-4"></i>12-week plan · 6 h/week · mostly free</p>
        </div>
        <div class="mt-4 flex flex-wrap gap-1.5">
          {src("Anthropic Economic Index · Sep 2026")}
          {src("arXiv momentum · 19 Oct 2026", "activity")}
        </div>
      </div>
    </div>
  </section>

  <!-- ============ 2. HOW IT WORKS ============ -->
  <section id="how" class="pt-4">
    <div class="flex flex-wrap items-end justify-between gap-2 mb-3">
      <h2 class="font-serif text-[24px] font-medium tracking-tight">How it works</h2>
      <p class="text-[13px] text-grey">Four steps. The same four you will see at the top of every screen.</p>
    </div>
    <ol class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
{strip}
    </ol>
  </section>

  <!-- ============ 3. PRIVACY + CONSENT ============ -->
  <section class="mt-5 grid grid-cols-1 md:grid-cols-12 gap-5">
    <div class="md:col-span-8 rounded-2xl border border-line bg-white p-6">
      <div class="flex items-center gap-2">
        <i data-lucide="lock-keyhole" class="w-4 h-4 text-sage"></i>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">PRIVACY AND CONSENT</p>
      </div>
      <h2 class="font-serif text-[24px] font-medium tracking-tight mt-2">Before you start</h2>
      <ul class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <li>
          <p class="text-[14px] font-medium flex items-center gap-2"><i data-lucide="user-x" class="w-4 h-4 text-sage"></i>Synthetic data only</p>
          <p class="text-[13px] text-grey leading-relaxed mt-1">This demo uses made-up sample CVs. Please do not upload a real CV or real personal details.</p>
        </li>
        <li>
          <p class="text-[14px] font-medium flex items-center gap-2"><i data-lucide="hard-drive" class="w-4 h-4 text-sage"></i>Nothing stored</p>
          <p class="text-[13px] text-grey leading-relaxed mt-1">No login and no account. Your profile, answers and plan live only in this browser session.</p>
        </li>
        <li>
          <p class="text-[14px] font-medium flex items-center gap-2"><i data-lucide="trash-2" class="w-4 h-4 text-sage"></i>Delete anytime</p>
          <p class="text-[13px] text-grey leading-relaxed mt-1">One click clears everything from this session. Closing the tab does the same.</p>
        </li>
      </ul>
      <div class="mt-5 pt-4 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <label class="flex items-start gap-2.5 text-[13px] leading-relaxed max-w-[520px]">
          <span class="mt-0.5 w-4 h-4 rounded border border-ink bg-ink text-white flex items-center justify-center shrink-0"><i data-lucide="check" class="w-3 h-3"></i></span>
          I understand Laluan uses synthetic CVs, gives estimates, and does not make hiring decisions.
        </label>
        <a href="02-profile.html" class="inline-flex items-center justify-center gap-2 rounded-lg bg-ink text-white px-5 py-2.5 text-[14px] font-medium whitespace-nowrap">Start<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
      </div>
    </div>

    <!-- dated sources -->
    <div class="md:col-span-4 rounded-2xl border border-line bg-white p-6 flex flex-col">
      <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">BUILT ON DATED PUBLIC DATA</p>
      <p class="text-[13px] text-grey leading-relaxed mt-2">Every score is computed by code from these sources, and each one shows its date. AI writes explanations, never numbers or links.</p>
      <div class="mt-4 flex flex-wrap gap-1.5">
        {src("ESCO v1.2")}
        {src("O*NET 31.0")}
        {src("Anthropic Economic Index · Sep 2026")}
        {src("ILO GenAI Exposure · 2025")}
        {src("arXiv momentum · daily", "activity")}
        {src("WEF Four Futures · 2026")}
      </div>
      <p class="mt-auto pt-4 text-[12px] text-grey flex items-center gap-1.5"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Trend signal last refreshed 19 Oct 2026</p>
    </div>
  </section>

{example_note("Example data: the result preview, scores, role, SDG links and source dates on this page are illustrative example data for the synthetic persona Aisyah (SDC Hackathon demo). They are not real measurements. Team Hoo Lee Sheet · SDC Hackathon 2026.")}
</main>
''' + END
    write("01-landing.html", landing)

    # ======================================================= 02 PROFILE
    personas = [
        dict(ini="AR", name="Aisyah binti Rahman", age=23, job="Administrative Clerk", loc="Bayan Lepas, Penang",
             langs=["BM", "EN"], note="Data entry, scheduling, reports and customer emails at a trading office.",
             cv="cv-aisyah-binti-rahman.pdf", sel=True),
        dict(ini="LJ", name="Lim Jia Hui <span class=\"font-sans text-[18px] text-grey font-normal\">林佳慧</span>", age=30, job="Senior Accounts Assistant", loc="Johor Bahru, Johor",
             langs=["中文"], note="Eight years of bookkeeping, reconciliations and e-invoicing for SMEs.",
             cv="cv-lim-jia-hui.pdf", sel=False),
        dict(ini="PM", name="Pravin a/l Murugan", age=23, job="Customer Support Agent", loc="Cyberjaya, Selangor",
             langs=["EN"], note="Environmental science graduate (2025) in a contract call-centre job.",
             cv="cv-pravin-a-l-murugan.pdf", sel=False),
    ]
    cards = []
    for p in personas:
        sel = p["sel"]
        langchips = "".join(f'<span class="rounded-md border border-line bg-white px-2 py-0.5 text-[12px]">{l}</span>' for l in p["langs"])
        top = ('<span class="inline-flex items-center gap-1.5 rounded-full bg-sage-soft text-sage-dark px-2.5 py-1 text-[12px] font-medium"><i data-lucide="check" class="w-3.5 h-3.5"></i>Selected</span>'
               if sel else '<span class="inline-flex items-center gap-1.5 rounded-full bg-alt text-grey px-2.5 py-1 text-[12px]"><i data-lucide="user-x" class="w-3.5 h-3.5"></i>Synthetic CV</span>')
        btn = ('<button class="w-full rounded-lg bg-ink text-white py-2.5 text-[14px] font-medium flex items-center justify-center gap-1.5"><i data-lucide="check" class="w-4 h-4"></i>Using this CV</button>'
               if sel else '<button class="w-full rounded-lg bg-btn2 border border-line py-2.5 text-[14px] font-medium">Use this CV</button>')
        cls = "rounded-2xl border border-sage-tint bg-white p-6 flex flex-col ring-1 ring-sage-tint/60" if sel else "rounded-2xl border border-line bg-white p-6 flex flex-col"
        cards.append(f'''      <article class="{cls}">
        <div class="flex items-center justify-between">
          {top}
          <span class="w-10 h-10 rounded-full bg-alt border border-line flex items-center justify-center text-[13px] font-medium text-grey" aria-hidden="true">{p["ini"]}</span>
        </div>
        <h3 class="font-serif text-[24px] leading-tight font-medium mt-4">{p["name"]}</h3>
        <p class="text-[14px] mt-1">Age <span class="tabular-nums">{p["age"]}</span> · {p["job"]}</p>
        <p class="text-[13px] text-grey mt-1 flex items-center gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i>{p["loc"]}</p>
        <p class="text-[13px] text-grey leading-relaxed mt-3">{p["note"]}</p>
        <div class="mt-4 pt-3 border-t border-line flex items-center justify-between">
          <span class="text-[12px] text-grey flex items-center gap-1.5"><i data-lucide="book-open" class="w-3.5 h-3.5"></i>Course language</span>
          <span class="flex gap-1">{langchips}</span>
        </div>
        <div class="mt-5 flex items-center gap-3">
          <a href="../../cvs/{p["cv"]}" class="text-[13px] font-medium underline underline-offset-4 decoration-line hover:decoration-ink whitespace-nowrap flex items-center gap-1.5"><i data-lucide="file-text" class="w-4 h-4"></i>View CV</a>
          <div class="flex-1">{btn}</div>
        </div>
      </article>''')
    cards = "\n".join(cards)

    def skill(label, origin="cv"):
        dot = '' if origin == "cv" else '<span class="text-[10px] uppercase tracking-wide text-grey/80">added</span>'
        return f'<span class="inline-flex items-center gap-1.5 rounded-md border border-line bg-alt pl-2.5 pr-1.5 py-1 text-[13px]">{label}{dot}<button aria-label="Remove {label}" class="text-grey hover:text-ink"><i data-lucide="x" class="w-3.5 h-3.5"></i></button></span>'
    skills = " ".join(skill(s) for s in ["Data entry and record keeping", "Scheduling and coordination", "Report filing",
        "Customer correspondence (BM, English)", "Attention to detail", "Teamwork", "Microsoft Excel (filters, basic formulas)",
        "Microsoft Word", "Outlook calendar", "WhatsApp Business", "Google Forms", "Stock list updates"])
    skills += " " + skill("Volunteer coordination", "added")

    profile = head("Profile") + '<body class="bg-paper text-ink font-sans">\n\n' + header(1, ("EN", "BM")) + f'''
<main class="max-w-[1248px] mx-auto px-4 md:px-6">

  <!-- page title -->
  <section class="pt-7 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-3">
    <div>
      <p class="text-[13px] text-grey">Step 1 of 4 · Profile</p>
      <h1 class="font-serif text-[30px] md:text-[36px] leading-[1.1] font-medium tracking-tight mt-1">Pick a sample CV</h1>
    </div>
    <p class="text-[13px] text-grey md:max-w-[400px] md:text-right leading-relaxed">These three people are fictional. Each one shows a different situation, so you can compare how Laluan responds.</p>
  </section>

  <!-- ============ 1. PERSONA CARDS ============ -->
  <section class="grid grid-cols-1 md:grid-cols-3 gap-5">
{cards}
  </section>

  <!-- ============ 2. UPLOAD (secondary) ============ -->
  <section class="mt-5 rounded-2xl border border-dashed border-line bg-white/60 px-5 py-4 flex flex-col md:flex-row md:items-center gap-4">
    <div class="flex items-center gap-3 flex-1">
      <span class="w-10 h-10 rounded-full bg-alt flex items-center justify-center shrink-0"><i data-lucide="upload" class="w-4 h-4 text-grey"></i></span>
      <div>
        <p class="text-[14px] font-medium">Upload your own (synthetic only)</p>
        <p class="text-[13px] text-grey">Drop a PDF here or <span class="underline underline-offset-4">browse</span>. PDF only, up to 2 MB.</p>
      </div>
    </div>
    <p class="md:max-w-[520px] rounded-lg bg-alt border border-line px-3 py-2 text-[12px] text-ink leading-relaxed flex items-start gap-2">
      <i data-lucide="triangle-alert" class="w-4 h-4 shrink-0 mt-px"></i>
      <span><span class="font-medium">Do not upload a real CV.</span> This demo is for synthetic CVs only. Leave out real names, IC numbers, phone numbers and addresses.</span>
    </p>
  </section>

  <!-- ============ 3. PARSED PROFILE ============ -->
  <section class="mt-5 rounded-2xl border border-line bg-white p-6">
    <div class="flex flex-col md:flex-row md:items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">READ FROM AISYAH'S CV</p>
        <h2 class="font-serif text-[24px] font-medium tracking-tight mt-1">Check your skills</h2>
        <p class="text-[13px] text-grey mt-1">Remove anything wrong and add what's missing. These chips feed your role fit.</p>
      </div>
      <div class="flex flex-wrap gap-1.5 md:justify-end">
        {src("ESCO v1.2 · 11 of 13 skills matched")}
        {src("Parsed 19 Oct 2026", "scan-text")}
      </div>
    </div>

    <div class="mt-5 grid grid-cols-1 md:grid-cols-12 gap-6">
      <!-- skills -->
      <div class="md:col-span-8">
        <p class="text-[12px] text-grey mb-2">Skills and tools <span class="tabular-nums">(13)</span></p>
        <div class="flex flex-wrap gap-2">
          {skills}
          <span class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-grey/50 px-2.5 py-1 text-[13px] text-grey"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Add a skill</span>
        </div>
        <p class="text-[12px] text-grey mt-3 flex items-center gap-1.5"><i data-lucide="info" class="w-3.5 h-3.5 text-sage"></i>Skills you add count as self-reported (half weight) until a course confirms them.</p>
      </div>

      <!-- roles / education / languages -->
      <div class="md:col-span-4 md:border-l border-line md:pl-6 space-y-4 text-[13px]">
        <div>
          <p class="text-[12px] text-grey mb-1.5">Roles</p>
          <ul class="divide-y divide-line border-y border-line">
            <li class="flex justify-between py-2"><span>Administrative Clerk</span><span class="text-grey tabular-nums">2 yrs</span></li>
            <li class="flex justify-between py-2"><span>Customer Service Assistant</span><span class="text-grey tabular-nums">1.5 yrs</span></li>
            <li class="flex justify-between py-2"><span>Industrial Trainee</span><span class="text-grey tabular-nums">5 mo</span></li>
          </ul>
        </div>
        <div>
          <p class="text-[12px] text-grey mb-1">Education</p>
          <p>Diploma in Business Studies · Politeknik Seberang Perai</p>
        </div>
        <div>
          <p class="text-[12px] text-grey mb-1.5">Preferred course language <span class="text-grey/80">(choose one or more)</span></p>
          <div class="flex gap-1.5">
            <span class="inline-flex items-center gap-1 rounded-md bg-ink text-white px-2.5 py-1 text-[12px] font-medium"><i data-lucide="check" class="w-3 h-3"></i>EN</span>
            <span class="inline-flex items-center gap-1 rounded-md bg-ink text-white px-2.5 py-1 text-[12px] font-medium"><i data-lucide="check" class="w-3 h-3"></i>BM</span>
            <span class="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[12px] text-grey">中文</span>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 pt-4 border-t border-line flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
      <p class="text-[13px] text-grey flex items-center gap-2"><i data-lucide="messages-square" class="w-4 h-4"></i>Next: 5 quick questions about how you spend your week.</p>
      <a href="03-interview.html" class="inline-flex items-center justify-center gap-2 rounded-lg bg-ink text-white px-5 py-2.5 text-[14px] font-medium whitespace-nowrap">Continue to interview<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
    </div>
  </section>

{example_note("Example data: all three people and their CVs are synthetic, made for the SDC Hackathon demo. The parsed skills, ESCO match counts and dates on this page are illustrative example data. They are not real measurements.")}
</main>
''' + END
    write("02-profile.html", profile)

    # ======================================================= 03 INTERVIEW
    tasks = [("Data entry (orders, delivery notes)", 40), ("Customer emails and WhatsApp", 25), ("Weekly sales and stock reports", 25), ("Team and delivery scheduling", 10)]
    opts = [10, 25, 40, 50]
    rows = []
    for t, v in tasks:
        chips = "".join(
            (f'<span class="px-2.5 py-1 rounded-md bg-ink text-white font-medium">{"50%+" if o==50 else "~"+str(o)+"%"}</span>' if o == v
             else f'<span class="px-2.5 py-1 rounded-md border border-line bg-white text-grey">{"50%+" if o==50 else "~"+str(o)+"%"}</span>')
            for o in opts)
        if v not in opts:
            chips = chips
        rows.append(f'''          <li class="py-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span class="text-[14px]">{t}</span>
              <div class="flex items-center gap-1.5 text-[12px] tabular-nums">{chips}</div>
            </div>
            <div class="mt-2 flex items-center gap-3">
              <div class="flex-1 h-1.5 rounded-full bg-alt"><div class="h-1.5 rounded-full bg-sage" style="width:{v*2}%"></div></div>
              <span class="w-10 text-right text-[13px] text-grey tabular-nums">{v}%</span>
            </div>
          </li>''')
    rows = "\n".join(rows)
    # task 4 has 15%: show custom value from slider (no chip exact) -> mark ~10%? keep chips none selected
    rows = rows.replace('<span class="w-10 text-right text-[13px] text-grey tabular-nums">15%</span>', '<span class="w-10 text-right text-[13px] text-grey tabular-nums">15%</span>')

    def slot(label, value, origin, state="filled"):
        if state == "filled":
            ic = '<span class="w-5 h-5 rounded-full bg-sage-soft text-sage flex items-center justify-center shrink-0"><i data-lucide="check" class="w-3 h-3"></i></span>'
            val = f'<span class="text-ink text-right">{value}</span>'
        elif state == "now":
            ic = '<span class="w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center shrink-0"><i data-lucide="pencil" class="w-3 h-3"></i></span>'
            val = f'<span class="text-ink text-right font-medium">{value}</span>'
        else:
            ic = '<span class="w-5 h-5 rounded-full border border-line shrink-0"></span>'
            val = f'<span class="text-grey/80 text-right">{value}</span>'
        return f'''          <li class="flex items-start justify-between gap-3 py-2.5">
            <span class="flex items-start gap-2.5">{ic}<span><span class="block {'text-grey' if state=='later' else 'text-ink'}">{label}</span><span class="block text-[11px] text-grey">{origin}</span></span></span>
            {val}
          </li>'''
    slots = "\n".join([
        slot("Current role", "Administrative Clerk · 2 yrs", "From CV"),
        slot("State · age band", "Penang · 18–30", "From CV"),
        slot("Course languages", '<span class="inline-flex gap-1"><span class="rounded-md bg-ink text-white px-1.5 text-[11px] font-medium">EN</span><span class="rounded-md bg-ink text-white px-1.5 text-[11px] font-medium">BM</span></span>', "From CV · you confirmed"),
        slot("Hours per week", "6 h", "Question 1"),
        slot("Budget", "Free only", "Question 1"),
        slot("Tasks and time share", "4 tasks · 100%", "Question 2 · answering now", "now"),
        slot("Tools and AI use", "Asked next", "Question 3", "later"),
        slot("Work status · PERKESO", "Question 4", "For programme eligibility", "later"),
        slot("Impact you care about", "Question 5", "Links to SDG targets", "later"),
    ])

    dots = ('<span class="w-2 h-2 rounded-full bg-sage" title="Question 1 answered"></span>'
            '<span class="w-5 h-2 rounded-full bg-ink" title="Question 2, current"></span>'
            + '<span class="w-2 h-2 rounded-full bg-line"></span>' * 3)

    interview = head("Interview") + '<body class="bg-paper text-ink font-sans">\n\n' + header(2, ("EN", "BM")) + f'''
<main class="max-w-[1248px] mx-auto px-4 md:px-6">

  <!-- page title -->
  <section class="pt-7 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-3">
    <div>
      <p class="text-[13px] text-grey">Aisyah, 23 · Admin clerk · Penang</p>
      <h1 class="font-serif text-[30px] md:text-[36px] leading-[1.1] font-medium tracking-tight mt-1">A few quick questions</h1>
    </div>
    <p class="text-[13px] text-grey md:max-w-[400px] md:text-right leading-relaxed">We only ask what your CV can't tell us. Tap a chip, or type if you prefer. Five questions at most.</p>
  </section>

  <section class="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">

    <!-- ============ 1. CHAT PANEL ============ -->
    <div class="md:col-span-8 rounded-2xl border border-line bg-white flex flex-col">
      <!-- panel top: progress -->
      <div class="px-6 py-4 border-b border-line flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <p class="text-[13px] font-medium">Question <span class="tabular-nums">2</span> of <span class="tabular-nums">5</span></p>
          <div class="flex items-center gap-1.5" role="progressbar" aria-valuemin="1" aria-valuemax="5" aria-valuenow="2">{dots}</div>
        </div>
        <span class="text-[12px] text-grey flex items-center gap-1.5"><i data-lucide="timer" class="w-3.5 h-3.5"></i>About 1 min left</span>
      </div>

      <div class="px-6 py-6 space-y-5">
        <!-- Q1 (answered) -->
        <div class="flex items-start gap-3">
          <img src="../../branding/logos/laluan-mark.svg" alt="" class="w-7 h-7 shrink-0">
          <div class="rounded-2xl rounded-tl-md bg-alt px-4 py-3 text-[14px] leading-relaxed max-w-[520px]">How many hours a week can you spend learning, and what can you spend on courses?</div>
        </div>
        <div class="flex justify-end">
          <div class="rounded-2xl rounded-tr-md bg-ink text-white px-4 py-2.5 text-[14px]">6 hours a week · Free only</div>
        </div>

        <!-- Q2 (current) -->
        <div class="flex items-start gap-3">
          <img src="../../branding/logos/laluan-mark.svg" alt="" class="w-7 h-7 shrink-0">
          <div class="flex-1 min-w-0">
            <div class="rounded-2xl rounded-tl-md bg-alt px-4 py-3 text-[14px] leading-relaxed max-w-[560px]">
              <p class="font-medium">Roughly how much of your week goes to each task?</p>
              <p class="text-grey text-[13px] mt-0.5">I found these four tasks in your CV. A rough guess is fine.</p>
            </div>

            <!-- quick replies per task -->
            <div class="mt-3 rounded-xl border border-line px-4">
              <ul class="divide-y divide-line">
{rows}
              </ul>
            </div>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-wrap gap-1.5 text-[13px]">
                <span class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-grey/50 px-2.5 py-1 text-grey"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Add a task</span>
                <span class="inline-flex items-center rounded-md border border-line px-2.5 py-1 text-grey">Split them evenly</span>
              </div>
              <p class="text-[13px] flex items-center gap-1.5"><i data-lucide="circle-check" class="w-4 h-4 text-sage"></i>Total <span class="font-medium tabular-nums">100%</span></p>
            </div>
            <p class="mt-3 text-[12px] text-grey flex items-start gap-1.5"><i data-lucide="info" class="w-3.5 h-3.5 mt-px text-sage shrink-0"></i>Why we ask: the time you spend on each task weights your AI exposure and augmentation scores.</p>
          </div>
        </div>
      </div>

      <!-- composer -->
      <div class="mt-auto px-6 py-4 border-t border-line flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1 rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-grey/80 flex items-center gap-2"><i data-lucide="keyboard" class="w-4 h-4"></i>Or type your answer…</div>
        <div class="flex items-center gap-2">
          <button class="rounded-lg bg-btn2 border border-line px-4 py-2.5 text-[14px] font-medium">Skip</button>
          <a href="#" class="inline-flex items-center gap-2 rounded-lg bg-ink text-white px-5 py-2.5 text-[14px] font-medium whitespace-nowrap">Next question<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
        </div>
      </div>
    </div>

    <!-- ============ 2. WHAT WE KNOW ============ -->
    <aside class="md:col-span-4 rounded-2xl border border-line bg-white p-6">
      <div class="flex items-center justify-between">
        <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">WHAT WE KNOW SO FAR</p>
        <span class="text-[12px] text-grey tabular-nums">6 of 9</span>
      </div>
      <div class="h-1.5 mt-3 rounded-full bg-alt"><div class="h-1.5 rounded-full bg-sage" style="width:66%"></div></div>
      <ul class="mt-3 divide-y divide-line text-[13px]">
{slots}
      </ul>
      <div class="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2">
        {src("From CV · parsed 19 Oct 2026", "scan-text")}
        <a href="02-profile.html" class="text-[12px] text-grey underline underline-offset-4">Edit profile</a>
      </div>
    </aside>
  </section>

{example_note("Example data: the questions, answers, task shares and filled slots on this page are illustrative example data for the synthetic persona Aisyah (SDC Hackathon demo). They are not real measurements.")}
</main>
''' + END
    write("03-interview.html", interview)

    # ======================================================= 04 PATHWAY
    steps = [
        dict(wk="Weeks 1–2", kind="program", title="AI Untuk Rakyat", prov="Rakyat Digital · rakyatdigital.gov.my",
             cost="free", langs=["BM", "EN"], hrs="8 h", cert="Certificate", skill="Checking AI output for errors",
             sdg=("4.4 Skills for work", "direct"), checked="15 Oct 2026", srcname="Rakyat Digital",
             elig=("ok", "Eligible: aged 18–30 and Malaysian"),
             why="Free AI basics in BM; finishing the modules unlocks 3 months of free AI tools."),
        dict(wk="Week 3", kind="course", title="Data cleaning with Excel Power Query", prov="HRD Corp e-LATiH · elatih.hrdcorp.gov.my",
             cost="free", langs=["BM"], hrs="6 h", cert="Certificate", skill="Data cleaning in Power Query",
             sdg=("4.4 Skills for work", "direct"), checked="14 Oct 2026", srcname="e-LATiH catalogue",
             elig=("ok", "Open to all Malaysians"),
             why="Builds on the Excel you already use every day for sales orders."),
        dict(wk="Weeks 4–5", kind="course", title="Looker Studio: build your first dashboard", prov="Google Skills · grow.google",
             cost="free", langs=["EN"], hrs="8 h", cert="No certificate", skill="Dashboards in Looker Studio",
             sdg=("4.4 Skills for work", "direct"), checked="13 Oct 2026", srcname="Grow with Google",
             elig=None,
             why="Turn your weekly sales and stock report into a live dashboard."),
        dict(wk="Week 5", kind="program", title="Career counselling session", prov="PERKESO · myfuturejobs.gov.my",
             cost="free", langs=["BM", "EN"], hrs="1.5 h", cert="No certificate", skill="Job-search plan for data roles",
             sdg=("8.6 Youth in work · 0.61", "supporting"), checked="16 Oct 2026", srcname="MYFutureJobs",
             elig=("check", "Check eligibility"),
             why="A counsellor reviews your plan and CV for data operations roles."),
        dict(wk="Weeks 6–10", kind="course", title="Google Data Analytics Certificate (courses 1–3 of 8)", prov="Grow with Google · Coursera",
             cost="subsidised", langs=["EN"], hrs="30 h", cert="Certificate after all 8", skill="SQL basics",
             sdg=("5.5 Women in leadership", "direct"), checked="12 Oct 2026", srcname="Coursera",
             elig=("ok", "Financial aid: apply on the course page"),
             why="An industry certificate employers recognise; the first three courses cover SQL."),
        dict(wk="Weeks 11–12", kind="course", title="Writing SOPs and process documentation", prov="HRD Corp-registered provider (example)",
             cost="hrdcorp_claimable", langs=["BM"], hrs="12 h", cert="Certificate", skill="Process documentation",
             sdg=("8.2 Productivity", "supporting"), checked="10 Oct 2026", srcname="HRD Corp training directory",
             elig=("info", "Your employer claims the fee from its HRD Corp levy"),
             why="Ask your manager: no cost to you if the company registers the claim."),
    ]
    items = []
    for i, s in enumerate(steps, 1):
        kind = ('<span class="flex items-center gap-1.5"><i data-lucide="landmark" class="w-3.5 h-3.5"></i>Government programme</span>' if s["kind"] == "program"
                else '<span class="flex items-center gap-1.5"><i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>Course</span>')
        langs = "".join(tag(l, "languages") for l in s["langs"])
        certic = "award" if not s["cert"].startswith("No") else "circle-slash"
        sdgtxt, tier = s["sdg"]
        sdgchip = (f'<span class="rounded-md bg-sage text-white px-2 py-0.5 text-[12px] font-medium">{sdgtxt}</span>' if tier == "direct"
                   else f'<span class="rounded-md border border-sage text-sage-dark px-2 py-0.5 text-[12px]">{sdgtxt}</span>')
        el = ""
        flagged = False
        if s["elig"]:
            k, txt = s["elig"]
            if k == "ok":
                el = f'<p class="text-[12px] text-sage-dark flex items-center gap-1.5"><i data-lucide="circle-check" class="w-3.5 h-3.5"></i>{txt}</p>'
            elif k == "info":
                el = f'<p class="text-[12px] text-grey flex items-center gap-1.5"><i data-lucide="info" class="w-3.5 h-3.5"></i>{txt}</p>'
            else:
                flagged = True
                el = '''<div class="rounded-lg border border-ink/70 bg-paper px-3 py-2.5 text-[12px] leading-relaxed flex items-start gap-2">
                <i data-lucide="circle-help" class="w-4 h-4 shrink-0 mt-px"></i>
                <div><p class="font-medium text-[13px]">Check eligibility</p><p class="text-grey">We don't know yet if you are registered with PERKESO (you answered "Not sure"). <a href="#" class="underline underline-offset-4 text-ink">How to check</a></p></div>
              </div>'''
        node = (f'<span class="w-8 h-8 rounded-full bg-white border {"border-ink" if flagged else "border-sage"} text-[13px] font-medium flex items-center justify-center tabular-nums">{i}</span>')
        items.append(f'''      <li class="relative grid grid-cols-[32px_1fr] md:grid-cols-[96px_32px_1fr] gap-x-4">
        <p class="hidden md:block pt-1.5 text-[13px] text-grey text-right tabular-nums">{s["wk"]}</p>
        <div class="relative flex justify-center">{node}</div>
        <article class="rounded-2xl border border-line bg-white p-5 mb-4">
          <div class="flex items-center justify-between gap-3 text-[12px] text-grey">
            {kind}
            <span class="md:hidden tabular-nums">{s["wk"]}</span>
          </div>
          <h3 class="font-serif text-[22px] leading-tight font-medium mt-2">{s["title"]}</h3>
          <p class="text-[13px] text-grey mt-0.5">{s["prov"]}</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            {COST[s["cost"]]}{langs}{tag(s["hrs"], "clock-3")}{tag(s["cert"], certic)}
          </div>
          <div class="mt-4 pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-center">
            <p class="text-[13px] flex items-center gap-1.5"><i data-lucide="target" class="w-4 h-4 text-sage shrink-0"></i><span class="text-grey">Closes</span> <span class="font-medium">{s["skill"]}</span></p>
            <div class="sm:justify-self-end">{sdgchip}</div>
          </div>
          <p class="text-[13px] text-grey mt-2 leading-relaxed">{s["why"]}</p>
          {('<div class="mt-3">' + el + '</div>') if el else ''}
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            {src(s["srcname"] + " · last checked " + s["checked"], "calendar-check")}
            <a href="#" class="text-[12px] text-grey underline underline-offset-4 flex items-center gap-1">Open source<i data-lucide="arrow-up-right" class="w-3 h-3"></i></a>
          </div>
        </article>
      </li>''')
    timeline = "\n".join(items)

    gap = [("Checking AI output for errors", 1), ("Data cleaning in Power Query", 2), ("Dashboards in Looker Studio", 3), ("SQL basics", 5), ("Process documentation", 6)]
    gaplist = "\n".join(f'          <li class="flex items-center justify-between py-2"><span class="flex items-center gap-2"><i data-lucide="circle-check" class="w-4 h-4 text-sage"></i>{g_}</span><span class="text-[11px] rounded border border-line px-1.5 text-grey tabular-nums">Step {n}</span></li>' for g_, n in gap)

    stat = lambda label, big, sub: f'''      <div class="px-0 md:px-6 py-3 md:py-0 first:pl-0">
        <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">{label}</p>
        <p class="font-serif text-[28px] md:text-[36px] leading-none font-medium tracking-tight mt-2 whitespace-nowrap">{big}</p>
        <p class="text-[12px] text-grey mt-1.5">{sub}</p>
      </div>'''

    pathway = head("Pathway") + '<body class="bg-paper text-ink font-sans pb-24 md:pb-16">\n\n' + header(4, ("EN", "BM")) + f'''
<main class="max-w-[1248px] mx-auto px-4 md:px-6">

  <!-- page title -->
  <section class="pt-7 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
      <p class="text-[13px] text-grey">Aisyah, 23 · Admin clerk · Penang <span class="text-grey/60">→</span> <span class="text-ink">Data Operations Analyst</span></p>
      <h1 class="font-serif text-[30px] md:text-[36px] leading-[1.1] font-medium tracking-tight mt-1">Your 12-week path to Data Operations Analyst</h1>
      <p class="text-[13px] text-grey mt-2 flex items-center gap-2"><i data-lucide="hand" class="w-4 h-4"></i>You chose this role on the results page. Courses are in BM and English, free first.</p>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <a href="#" class="inline-flex items-center gap-1.5 rounded-lg bg-btn2 border border-line px-4 py-2.5 text-[14px] font-medium whitespace-nowrap"><i data-lucide="arrow-left" class="w-4 h-4"></i>Back to roles</a>
      <a href="#" class="inline-flex items-center gap-1.5 rounded-lg bg-ink text-white px-4 py-2.5 text-[14px] font-medium whitespace-nowrap"><i data-lucide="download" class="w-4 h-4"></i>Download plan (PDF)</a>
    </div>
  </section>

  <!-- ============ 1. SUMMARY BAR ============ -->
  <section class="rounded-2xl border border-line bg-white px-6 py-5">
    <div class="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-line gap-x-4">
{stat("DURATION", "12 weeks", "6 steps · 19 Oct 2026 – 10 Jan 2027")}
{stat("PACE", '6 h <span class="text-grey/50 text-[20px] md:text-[24px]">/ week</span>', '<span class="tabular-nums">65.5 h</span> in total, never over 6 h a week')}
{stat("COST", '<span class="text-sage">Mostly free</span>', '4 free · 1 subsidised · 1 HRD Corp claimable')}
      <div class="md:px-6 py-3 md:py-0">
        <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">SKILLS CLOSED</p>
        <p class="font-serif text-[28px] md:text-[36px] leading-none font-medium tracking-tight mt-2 tabular-nums">5 <span class="text-grey/50">/</span> 5</p>
        <div class="h-1.5 mt-2.5 rounded-full bg-alt"><div class="h-1.5 rounded-full bg-sage" style="width:100%"></div></div>
      </div>
    </div>
    <div class="mt-4 pt-3 border-t border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-1.5 text-[12px] text-grey">
        <span class="mr-1">Cost types, in plan order:</span>
        {COST["free"]}{COST["subsidised"]}{COST["hrdcorp_claimable"]}{COST["paid"]}<span class="ml-1">Paid: none, you chose free only</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        {src("Laluan curated catalogue · checked 10–16 Oct 2026")}
      </div>
    </div>
  </section>

  <section class="mt-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">

    <!-- ============ 2. TIMELINE ============ -->
    <div class="md:col-span-8">
      <div class="flex flex-wrap items-end justify-between gap-2 mb-3">
        <h2 class="font-serif text-[24px] font-medium tracking-tight">Week by week</h2>
        <div class="flex items-center gap-4 text-[12px] text-grey">
          <span class="flex items-center gap-1.5"><i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>Course</span>
          <span class="flex items-center gap-1.5"><i data-lucide="landmark" class="w-3.5 h-3.5"></i>Government programme</span>
        </div>
      </div>
      <ol class="relative">
        <span class="absolute top-4 bottom-8 left-[15px] md:left-[127px] w-px bg-line" aria-hidden="true"></span>
{timeline}
      </ol>
    </div>

    <!-- ============ 3. SIDE PANEL ============ -->
    <aside class="md:col-span-4 space-y-5 md:mt-[44px]">
      <div class="rounded-2xl border border-line bg-white p-6">
        <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">YOUR SKILL GAP</p>
        <p class="text-[13px] text-grey mt-1">The top 5 skills from your role card, and the step that closes each one.</p>
        <ul class="mt-3 text-[13px] divide-y divide-line border-y border-line">
{gaplist}
        </ul>
        <div class="mt-3 flex flex-wrap gap-1.5">{src("ESCO v1.2")}{src("arXiv momentum · 19 Oct 2026", "activity")}</div>
      </div>

      <div class="rounded-2xl border border-line bg-white p-6">
        <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">SDG TARGETS THIS MOVE ADVANCES</p>
        <div class="mt-3 flex flex-wrap gap-1.5 text-[12px]">
          <span class="rounded-md bg-sage text-white px-2 py-0.5 font-medium">4.4 Skills for work</span>
          <span class="rounded-md bg-sage text-white px-2 py-0.5 font-medium">5.5 Women in leadership</span>
          <span class="rounded-md border border-sage text-sage-dark px-2 py-0.5">8.6 Youth in work · 0.61</span>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-grey">
          <span class="flex items-center gap-1.5"><span class="inline-block w-6 h-3.5 rounded bg-sage"></span>Direct</span>
          <span class="flex items-center gap-1.5"><span class="inline-block w-6 h-3.5 rounded border border-sage"></span>Supporting</span>
          <span class="flex items-center gap-1.5"><span class="inline-block w-6 h-3.5 rounded border border-dashed border-sage"></span>AI-suggested</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">{src("Laluan SDG rules · Oct 2026")}{src("OSDG classifier · 2025")}</div>
      </div>

      <div class="rounded-2xl border border-line bg-white p-6">
        <p class="text-[11px] font-semibold tracking-[0.12em] text-grey">HOW THIS PLAN WAS BUILT</p>
        <ul class="mt-3 space-y-2.5 text-[13px] text-grey leading-relaxed">
          <li class="flex gap-2"><i data-lucide="filter" class="w-4 h-4 mt-px text-sage shrink-0"></i>Only items in your languages (BM, EN) that fit 6 h a week and a free-only budget.</li>
          <li class="flex gap-2"><i data-lucide="list-ordered" class="w-4 h-4 mt-px text-sage shrink-0"></i>Free first, then subsidised, then HRD Corp claimable, then paid. Prerequisites go first.</li>
          <li class="flex gap-2"><i data-lucide="shield-check" class="w-4 h-4 mt-px text-sage shrink-0"></i>Eligibility is checked by rules against your answers. If an answer is missing, we say "Check eligibility".</li>
          <li class="flex gap-2"><i data-lucide="link" class="w-4 h-4 mt-px text-sage shrink-0"></i>Every link comes from our checked catalogue. AI orders the steps; it never writes a link.</li>
        </ul>
        <p class="mt-4 pt-3 border-t border-line text-[12px] text-grey flex items-center gap-1.5"><i data-lucide="shield-check" class="w-3.5 h-3.5 text-sage"></i>Role is robust in all 3 futures (Results, 19 Oct 2026)</p>
      </div>
    </aside>
  </section>

  <!-- bottom actions -->
  <section class="mt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
    <a href="#" class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-btn2 border border-line px-4 py-2.5 text-[14px] font-medium"><i data-lucide="arrow-left" class="w-4 h-4"></i>Back to roles</a>
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <button class="text-[13px] text-grey underline underline-offset-4 flex items-center justify-center gap-1.5"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Delete my data</button>
      <a href="#" class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink text-white px-5 py-2.5 text-[14px] font-medium"><i data-lucide="download" class="w-4 h-4"></i>Download plan (PDF)</a>
    </div>
  </section>

{example_note("Example data: the plan, weeks, hours, cost types, eligibility results, SDG links and last-checked dates on this page are illustrative example data for the synthetic persona Aisyah (SDC Hackathon demo). Course titles and programme details are examples, not verified listings; always confirm on the provider's site.")}
</main>

''' + FIXED_FOOTER + END
    write("04-pathway.html", pathway)
