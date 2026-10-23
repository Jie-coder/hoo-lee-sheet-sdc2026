import asyncio,subprocess,os
from playwright.async_api import async_playwright
D='/workspace/hackathon/design/caldera'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=await b.new_page(viewport={'width':1440,'height':900})
    await pg.goto('file://'+D+'/landing-caldera-v6.html#still');await pg.wait_for_timeout(2500)
    await pg.screenshot(path=D+'/landing-caldera-v6.png',full_page=True)
    await pg.evaluate('window.__manual=true')
    os.makedirs('/tmp/fr',exist_ok=True)
    for i in range(360):
      await pg.evaluate(f'frame({i/30})');await pg.screenshot(path=f'/tmp/fr/{i:03d}.png')
    await b.close()
asyncio.run(main())
