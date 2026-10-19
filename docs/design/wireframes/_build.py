# Builds the Laluan wireframes from shared parts (head, header, footer) copied from results-reference.html.
# Output files are plain static HTML. Run: python3 _build.py
import os
D = os.path.dirname(os.path.abspath(__file__))
LOGO = "../../branding/logos/laluan-logo.svg"

def head(title):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laluan · {title} (wireframe)</title>
<link rel="icon" href="../../branding/logos/laluan-favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
<script>
tailwind.config = {{
  theme: {{
    extend: {{
      colors: {{
        paper: '#FAF9F5', ink: '#141413', grey: '#5E5D59', line: '#E5E3DC',
        alt: '#F3F2EE', btn2: '#EFEDE7',
        sage: {{ DEFAULT: '#2F7D5B', dark: '#24634A', tint: '#B9CFC6', soft: '#E6EFEA', wash: '#F1F6F3' }}
      }},
      fontFamily: {{
        serif: ['Newsreader', '"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', '"Noto Sans CJK SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      }}
    }}
  }}
}}
</script>
<style>
  body {{ font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased; }}
  .chip-src {{ font-size: 11px; line-height: 16px; }}
  .lucide {{ stroke-width: 1.6; }}
  input[type=range] {{ accent-color: #2F7D5B; }}
</style>
</head>
'''

STEPS = ["Profile", "Interview", "Results", "Pathway"]

def header(active, langs=("EN",)):
    """active: 0 = none (landing), 1..4 = step index."""
    parts = []
    for i, name in enumerate(STEPS, start=1):
        if active and i < active:
            parts.append(f'''      <div class="flex items-center gap-2 text-grey">
        <span class="w-6 h-6 rounded-full bg-sage-soft text-sage flex items-center justify-center"><i data-lucide="check" class="w-3.5 h-3.5"></i></span><span class="hidden md:inline">{name}</span>
      </div>''')
        elif i == active:
            parts.append(f'''      <div class="flex items-center gap-2 font-medium text-ink" aria-current="step">
        <span class="w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center text-[12px]">{i}</span>{name}
      </div>''')
        else:
            parts.append(f'''      <div class="flex items-center gap-2 text-grey/70">
        <span class="w-6 h-6 rounded-full border border-line flex items-center justify-center text-[12px]">{i}</span><span class="hidden md:inline">{name}</span>
      </div>''')
    sep = '\n      <span class="w-4 md:w-10 h-px bg-line"></span>\n'
    pills = "".join(
        f'<span class="px-2.5 py-1 rounded-full bg-ink text-white font-medium" aria-pressed="true">{l}</span>' if l in langs
        else f'<span class="px-2.5 py-1 rounded-full text-grey" aria-pressed="false">{l}</span>'
        for l in ("EN", "BM", "中文"))
    return f'''<!-- ============ HEADER (from results-reference.html; official logo; responsive wrap at < md) ============ -->
<header class="min-h-16 md:h-16 border-b border-line bg-paper/95">
  <div class="max-w-[1248px] mx-auto px-4 md:px-6 h-full py-3 md:py-0 flex flex-wrap md:flex-nowrap items-center justify-between gap-y-3">
    <!-- logo -->
    <a href="01-landing.html" class="flex items-center md:w-[260px]">
      <img src="{LOGO}" alt="Laluan" class="h-[26px] md:h-[28px] w-auto">
    </a>

    <!-- steps -->
    <nav class="order-3 md:order-none w-full md:w-auto flex items-center justify-center gap-3 text-[13px]" aria-label="Progress">
{sep.join(parts)}
    </nav>

    <!-- course-language preference (multi-select; not the UI language) -->
    <div class="flex items-center justify-end gap-2.5 md:w-[260px]" title="Course language preference: pick one or more. The app itself stays in English.">
      <span class="text-[12px] text-grey flex items-center gap-1.5"><i data-lucide="book-open" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">Course language</span></span>
      <div class="flex items-center gap-0.5 rounded-full border border-line bg-white p-0.5 text-[12px]" role="group" aria-label="Course language, multi-select">
        {pills}
      </div>
    </div>
  </div>
</header>
'''

def src(text, icon="database"):
    return f'<span class="chip-src inline-flex items-center gap-1 rounded-md border border-line bg-alt px-2 py-0.5 text-grey"><i data-lucide="{icon}" class="w-3 h-3"></i>{text}</span>'

def example_note(text):
    return f'''  <!-- example-data note -->
  <p class="mt-8 mb-6 pt-4 border-t border-line text-[11px] text-grey/80 leading-relaxed">{text}</p>
'''

FIXED_FOOTER = '''<!-- ============ FIXED FOOTER (from results-reference.html) ============ -->
<footer class="fixed bottom-0 inset-x-0 min-h-11 md:h-11 border-t border-line bg-paper/95 backdrop-blur">
  <div class="max-w-[1248px] mx-auto px-4 md:px-6 h-full py-2 md:py-0 flex items-center justify-between gap-3 text-[12px] text-grey">
    <p class="flex items-center gap-2"><i data-lucide="scale" class="w-3.5 h-3.5 shrink-0"></i>All scores and forecasts are estimates. Laluan supports your decision; it does not make hiring decisions.</p>
    <span class="rounded border border-line px-1.5 py-0.5 text-[11px] shrink-0">Example data</span>
  </div>
</footer>
'''

END = '''
<script>lucide.createIcons();</script>
</body>
</html>
'''

def write(name, html):
    with open(os.path.join(D, name), "w") as f:
        f.write(html)
    print("wrote", name)

# Cost tags: one accent only; ordered free -> subsidised -> hrdcorp_claimable -> paid
COST = {
    "free": '<span class="inline-flex items-center gap-1 rounded-md bg-sage-soft text-sage-dark px-2 py-0.5 text-[12px] font-medium"><i data-lucide="gift" class="w-3 h-3"></i>Free</span>',
    "subsidised": '<span class="inline-flex items-center gap-1 rounded-md border border-sage text-sage-dark px-2 py-0.5 text-[12px]"><i data-lucide="hand-coins" class="w-3 h-3"></i>Subsidised</span>',
    "hrdcorp_claimable": '<span class="inline-flex items-center gap-1 rounded-md border border-line bg-alt text-ink px-2 py-0.5 text-[12px]"><i data-lucide="building-2" class="w-3 h-3"></i>HRD Corp claimable</span>',
    "paid": '<span class="inline-flex items-center gap-1 rounded-md border border-line text-grey px-2 py-0.5 text-[12px]"><i data-lucide="wallet" class="w-3 h-3"></i>Paid</span>',
}
def tag(text, icon):
    return f'<span class="inline-flex items-center gap-1 rounded-md border border-line bg-white text-ink px-2 py-0.5 text-[12px]"><i data-lucide="{icon}" class="w-3 h-3 text-grey"></i>{text}</span>'

import pages
pages.build(globals())
