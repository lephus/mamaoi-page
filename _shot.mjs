import { chromium } from 'playwright';
const base = 'http://localhost:3001';
const SP = '/private/tmp/claude-501/-Users-lehuuphu-Documents-workspace-DigitalUnicorn-tmp-mamaoi-page/c4c58999-9d8a-4e87-8075-5271d6ddeff8/scratchpad';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
for (const [path, name] of [['/', 'home'], ['/su-kien', 'su-kien']]) {
  await pg.goto(base + path, { waitUntil: 'load', timeout: 60000 });
  await pg.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); }
    window.scrollTo(0, 0);
  });
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: `${SP}/${name}.png`, fullPage: true });
  const h = await pg.evaluate(() => document.body.scrollHeight);
  console.log(`${name}: full-page height = ${h}px`);
}
await b.close();
