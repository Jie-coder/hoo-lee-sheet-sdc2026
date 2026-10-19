from playwright.sync_api import sync_playwright
import html as H

CVS = [
 dict(slug="aisyah-binti-rahman", name="Aisyah binti Rahman", alt=None,
  title="Administrative Clerk", loc="Bayan Lepas, Pulau Pinang", phone="01X-XXX 4821",
  email="aisyah.rahman@example.com", age="23",
  summary="Organised administrative clerk with two years in a busy trading office in Penang. I keep records accurate, schedules on time and customers informed. Comfortable with Excel and quick to learn new tools. Looking to grow into a role where I can work with data and help my community.",
  jobs=[
   ("Administrative Clerk","Seri Mutiara Trading Sdn Bhd, Bayan Lepas, Penang","Jul 2024 – Present",[
     "Key in 80–120 sales orders and delivery notes a day into Excel and the company's billing system",
     "Manage the meeting and delivery schedule for a team of 12 using a shared Outlook calendar",
     "Prepare and file weekly sales and stock reports for the branch manager",
     "Reply to customer emails and WhatsApp enquiries on order status, in BM and English",
     "Maintain physical and digital filing for invoices, purchase orders and supplier documents"]),
   ("Customer Service Assistant (part-time)","Kedai Buku Pelita, George Town, Penang","Jan 2023 – Jun 2024",[
     "Served walk-in customers, handled payments and processed special book orders",
     "Updated the stock list in Excel and flagged low-stock titles to the owner"]),
   ("Industrial Trainee","Pejabat Pentadbiran Daerah (district office), Seberang Perai","Aug 2022 – Dec 2022",[
     "Supported front-desk enquiries and digitised paper application forms"]),
  ],
  skills=["Data entry and record keeping","Scheduling and coordination","Report filing","Customer correspondence (BM, English)","Attention to detail","Teamwork"],
  tools=["Microsoft Excel (sorting, filters, basic formulas)","Microsoft Word, Outlook","WhatsApp Business","Google Forms","ChatGPT (tried once)"],
  edu=[("Diploma in Business Studies","Politeknik Seberang Perai, Penang","2020 – 2022","CGPA 3.21"),
       ("Sijil Pelajaran Malaysia (SPM)","SMK Bayan Lepas, Penang","2019","6A, 3B")],
  langs=[("Bahasa Melayu","Native"),("English","Good, spoken and written")],
  extra=("Community","Volunteer, monthly food bank run by a local youth association in Bayan Lepas (2023 – present): register families and keep the donation list."),
  pref="Course language: Bahasa Melayu or English"),

 dict(slug="lim-jia-hui", name="Lim Jia Hui", alt="林佳慧",
  title="Senior Accounts Assistant", loc="Johor Bahru, Johor", phone="01X-XXX 7350",
  email="jiahui.lim@example.com", age="30",
  summary="Accounts assistant with eight years of experience in full-set bookkeeping for SMEs in Johor. Reliable with month-end closing, reconciliations and e-invoicing. Much of my routine work is now being automated, so I want to move towards analysis and advisory work. I learn best in Mandarin.",
  jobs=[
   ("Senior Accounts Assistant","Teguh Jaya Logistics Sdn Bhd, Johor Bahru","Mar 2021 – Present",[
     "Process 300+ supplier invoices and payment vouchers a month in AutoCount",
     "Run monthly bank reconciliations for 4 accounts and chase unmatched items",
     "Prepare month-end closing schedules, accruals and aged debtor reports for the finance manager",
     "Issue and validate e-invoices through the LHDN MyInvois portal since its 2024 rollout",
     "Supervise and train one junior accounts clerk"]),
   ("Accounts Assistant","Kim Hoe Hardware Trading, Skudai, Johor","Jun 2018 – Feb 2021",[
     "Kept full-set accounts in SQL Account: sales, purchases, petty cash and payroll inputs",
     "Prepared SST returns and supporting documents for the external auditor"]),
   ("Accounts Clerk","Nusa Bina Sdn Bhd, Johor Bahru","Jan 2017 – May 2018",[
     "Data entry of invoices and receipts; filing and document control"]),
  ],
  skills=["Full-set bookkeeping","Bank and intercompany reconciliation","Month-end closing","Accounts payable and receivable","SST and e-invoicing compliance","Training junior staff"],
  tools=["AutoCount, SQL Account","Microsoft Excel (VLOOKUP, pivot tables)","LHDN MyInvois portal","Google Sheets","WeChat, WhatsApp"],
  edu=[("Diploma in Accounting","Southern University College, Skudai, Johor","2014 – 2016","CGPA 3.05"),
       ("Unified Examination Certificate (UEC) and SPM","Foon Yew High School, Johor Bahru","2013","")],
  langs=[("Mandarin","Native"),("English","Good, written; fair, spoken"),("Bahasa Melayu","Working"),("Cantonese","Conversational")],
  extra=("Certificates","LCCI Level 3 Certificate in Accounting (2016)"),
  pref="Course language: 中文 Chinese preferred"),

 dict(slug="pravin-a-l-murugan", name="Pravin a/l Murugan", alt=None,
  title="Customer Support Agent", loc="Cyberjaya, Selangor", phone="01X-XXX 2196",
  email="pravin.murugan@example.com", age="23",
  summary="Environmental science graduate (2025) currently working as a customer support agent while I look for a role that uses my degree. Strong communicator with a good grasp of data from my final-year project on river water quality. I want to work on sustainability and climate data.",
  jobs=[
   ("Customer Support Agent (contract)","Laju Connect BPO Sdn Bhd, Cyberjaya","Sep 2025 – Present",[
     "Handle 60–80 inbound calls and chats a day for a telco client, in English and BM",
     "Log and tag every case in Salesforce Service Cloud; average handling time 6 min",
     "Follow scripted troubleshooting and escalate complex billing cases to tier 2",
     "Consistently in the top 20% of the team for customer satisfaction scores"]),
   ("Warehouse Assistant (part-time)","Gemilang Fulfilment Hub, Shah Alam","Jun 2024 – Aug 2025",[
     "Picked and packed e-commerce orders; updated stock counts in the warehouse system",
     "Helped reorganise bin locations, cutting average pick time by about 10%"]),
   ("Final-year project","Water quality in the Langat River basin","Nov 2024 – Jun 2025",[
     "Collected and cleaned 18 months of sampling data; built charts in Excel and basic R"]),
  ],
  skills=["Customer communication","Case logging and problem solving","Environmental sampling and analysis","Data cleaning and charts","Report writing","Working under KPIs"],
  tools=["Salesforce Service Cloud","Microsoft Excel, PowerPoint","R (basic), QGIS (basic)","Google Workspace","ChatGPT (weekly, for emails and study)"],
  edu=[("Bachelor of Science (Hons) Environmental Science","Universiti Putra Malaysia, Serdang","2021 – 2025","CGPA 3.12"),
       ("Sijil Tinggi Persekolahan Malaysia (STPM)","SMK Bandar Klang, Selangor","2020","CGPA 3.25")],
  langs=[("English","Fluent"),("Tamil","Native"),("Bahasa Melayu","Good")],
  extra=("Activities","Member, university nature society; led two campus recycling drives (2023, 2024)."),
  pref="Course language: English"),
]

CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin:0; font-family: Inter, 'Noto Sans CJK SC', sans-serif; color:#141413; font-size:10pt; line-height:1.48; }
.page { width:210mm; height:297mm; padding:15mm 16mm 12mm; position:relative; }
h1 { font-family: Newsreader, 'Noto Serif CJK SC', Georgia, serif; font-weight:600; font-size:25pt; margin:0; letter-spacing:-0.01em; line-height:1.1;}
h1 .alt { font-weight:500; font-size:17pt; color:#5E5D59; margin-left:6px; }
.role { font-size:11pt; color:#2F7D5B; font-weight:500; margin-top:3px;}
.contact { color:#5E5D59; font-size:8.8pt; margin-top:6px; }
.contact span + span:before { content:"·"; margin:0 7px; color:#B0AEA6; }
h2 { font-family: Newsreader, Georgia, serif; font-size:13pt; font-weight:600; margin:15px 0 6px; padding-bottom:3px; border-bottom:1px solid #E5E3DC; }
p { margin:0; }
.job { margin-bottom:9px; }
.jh { display:flex; justify-content:space-between; align-items:baseline; }
.jt { font-weight:600; }
.jd { color:#5E5D59; font-size:8.8pt; white-space:nowrap; }
.jc { color:#5E5D59; font-size:8.8pt; }
ul { margin:2px 0 0; padding-left:14px; }
li { margin:1px 0; }
.cols { display:grid; grid-template-columns: 1fr 1fr; gap: 0 22px; }
.tags { display:flex; flex-wrap:wrap; gap:4px; }
.tag { border:1px solid #E5E3DC; background:#F3F2EE; border-radius:4px; padding:1px 6px; font-size:8.6pt; }
.edu { display:flex; justify-content:space-between; margin-bottom:4px; }
.lang { display:flex; justify-content:space-between; border-bottom:1px dotted #E5E3DC; padding:1.5px 0; }
.lang span:last-child { color:#5E5D59; }
.pref { display:inline-block; margin-top:6px; font-size:8.8pt; color:#24634A; background:#E6EFEA; border-radius:4px; padding:2px 7px; }
.foot { position:absolute; left:16mm; right:16mm; bottom:9mm; border-top:1px solid #E5E3DC; padding-top:5px; font-size:8pt; color:#5E5D59; display:flex; justify-content:space-between; letter-spacing:0.02em;}
"""

def esc(s): return H.escape(s)

def render(c):
    jobs = "".join(f"""<div class="job"><div class="jh"><span class="jt">{esc(t)}</span><span class="jd">{esc(d)}</span></div>
      <div class="jc">{esc(co)}</div><ul>{''.join(f'<li>{esc(b)}</li>' for b in bs)}</ul></div>""" for t,co,d,bs in c["jobs"])
    edu = "".join(f"""<div class="edu"><div><b style="font-weight:600">{esc(q)}</b><div class="jc">{esc(i)}</div></div><div style="text-align:right"><div class="jd">{esc(y)}</div><div class="jd">{esc(g)}</div></div></div>""" for q,i,y,g in c["edu"])
    langs = "".join(f'<div class="lang"><span>{esc(l)}</span><span>{esc(v)}</span></div>' for l,v in c["langs"])
    alt = f'<span class="alt">{c["alt"]}</span>' if c["alt"] else ""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="page">
<h1>{esc(c['name'])}{alt}</h1>
<div class="role">{esc(c['title'])}</div>
<div class="contact"><span>{esc(c['loc'])}</span><span>{esc(c['phone'])}</span><span>{esc(c['email'])}</span><span>Age {c['age']}</span></div>
<h2>Summary</h2><p>{esc(c['summary'])}</p>
<h2>Work experience</h2>{jobs}
<div class="cols">
 <div><h2>Skills</h2><div class="tags">{''.join(f'<span class="tag">{esc(s)}</span>' for s in c['skills'])}</div></div>
 <div><h2>Tools</h2><div class="tags">{''.join(f'<span class="tag">{esc(s)}</span>' for s in c['tools'])}</div></div>
</div>
<div class="cols">
 <div><h2>Education</h2>{edu}</div>
 <div><h2>Languages</h2>{langs}<div class="pref">{c['pref']}</div></div>
</div>
<h2>{esc(c['extra'][0])}</h2><p>{esc(c['extra'][1])}</p>
<div class="foot"><span>SYNTHETIC CV – for SDC Hackathon demo only</span><span>Fictional person · no real personal data</span></div>
</div></body></html>"""

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for c in CVS:
        pg.set_content(render(c)); pg.evaluate("document.fonts.ready")
        ov = pg.evaluate("(()=>{const e=document.querySelector('.page');const f=document.querySelector('.foot').getBoundingClientRect().top;const last=[...e.children].filter(x=>!x.classList.contains('foot')).pop().getBoundingClientRect().bottom;return [last,f]})()")
        print(c['slug'], 'content bottom / footer top:', ov)
        pg.pdf(path=f"cv-{c['slug']}.pdf", format="A4", print_background=True, margin={"top":"0","bottom":"0","left":"0","right":"0"})
    b.close()
