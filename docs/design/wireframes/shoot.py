# Shoots 1440 full-page PNGs of every wireframe, plus 390-wide PNGs of 02 and 04.
from playwright.sync_api import sync_playwright
import os
d = os.path.dirname(os.path.abspath(__file__)) + "/"
pages = ["01-landing", "02-profile", "03-interview", "04-pathway"]
mobile = ["02-profile", "04-pathway"]
def shoot(pg, name, w, out):
    pg.set_viewport_size({"width": w, "height": 900})
    pg.goto("file://" + d + name + ".html", wait_until="networkidle")
    pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(900)
    h = pg.evaluate("document.documentElement.scrollHeight")
    pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(400)
    pg.screenshot(path=d + out)
    sw = pg.evaluate("document.documentElement.scrollWidth")
    print(out, w, "x", h, "scrollWidth", sw)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(device_scale_factor=1)
    for n in pages: shoot(pg, n, 1440, n + ".png")
    mp = b.new_page(device_scale_factor=2)
    for n in mobile: shoot(mp, n, 390, n + "-mobile.png")
    b.close()
