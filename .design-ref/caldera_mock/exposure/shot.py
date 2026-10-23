import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome');pg=await b.new_page(viewport={'width':1440,'height':900})
    await pg.goto('file:///workspace/hackathon/design/caldera/exposure-intro-v1.html');await pg.wait_for_timeout(2500)
    await pg.screenshot(path='/workspace/hackathon/design/caldera/exposure-intro-v1.png',full_page=True);await b.close()
asyncio.run(m())
