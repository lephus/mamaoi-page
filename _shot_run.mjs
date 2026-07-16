import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const base = 'http://localhost:3000';
const SP = '/private/tmp/claude-501/-Users-lehuuphu-Documents-workspace-DigitalUnicorn-tmp-mamaoi-page/1f015305-02e9-4c9e-84a4-2fbcb30d69b4/scratchpad';
const out = [];
const say = s => { out.push(s); writeFileSync(`${SP}/shot.log`, out.join('\n') + '\n'); };
try {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  pg.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  for (const [path, name] of [['/', 'home'], ['/su-kien', 'su-kien'], ['/privacy-policy', 'privacy'], ['/terms-conditions', 'terms']]) {
    try {
      const resp = await pg.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await pg.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
        window.scrollTo(0, 0);
      });
      await pg.waitForTimeout(700);
      await pg.screenshot({ path: `${SP}/${name}.png`, fullPage: true });
      const info = await pg.evaluate(() => ({ h: document.body.scrollHeight, title: document.title }));
      say(`${name.padEnd(10)} status=${resp.status()} height=${info.h}px title="${info.title}"`);
    } catch (e) {
      say(`${name.padEnd(10)} ERROR: ${e.message.split('\n')[0]}`);
    }
  }
  say('console/page errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  await b.close();
  say('DONE');
} catch (e) {
  say('FATAL: ' + e.message);
}
