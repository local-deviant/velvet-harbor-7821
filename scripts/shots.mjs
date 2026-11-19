// Token Radar v4 screenshots: 3 PNGs at 1440px wide, from the built dashboard.
//   node scripts/shots.mjs [--dir <output dir>] [--shots <dir>]
// Serves the output dir over localhost, opens the dashboard, and shoots:
//   01-board.png  the cover strip + validation + KPI + the top of the board,
//                 clipped to end exactly at a table-row boundary
//   02-detail.png the detail drawer open on row #1 (viewport 1440x900)
//   03-farm.png   the FARM-only filter, full page (scatter + legend + footer in frame)
// Fails loudly on any console error or page error, so a broken page never ships.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const OUT = path.resolve(opt('--dir', '/tmp/v4-test-out'));
const SHOTS = path.resolve(opt('--shots', path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'screenshots')));
const CHROME = '/home/hatch/workspace/makefun/chrome-linux64/chrome';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(OUT, url === '/' ? 'dashboard/index.html' : url);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found: ' + url); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
async function shot(name, url, options) {
  const page = await browser.newPage({ viewport: options.viewport || { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(600);
  const out = path.join(SHOTS, name);
  await page.screenshot({ path: out, type: 'png', ...options.shot });
  console.log(`${name}: ${fs.statSync(out).size} bytes`);
  await page.close();
}

fs.mkdirSync(SHOTS, { recursive: true });

// Shot 1: board. Clip the bottom to the nearest table-row boundary under ~1150px.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`01-board pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`01-board console: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${port}/dashboard/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(600);
  const bottom = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#rows tr')];
    const tops = rows.map((tr) => tr.getBoundingClientRect().bottom + window.scrollY);
    const under = tops.filter((b) => b <= 2200);
    return under.length ? under[under.length - 1] : tops[0];
  });
  const out = path.join(SHOTS, '01-board.png');
  // fullPage: true is required for the clip to reach past the 900px viewport.
  await page.screenshot({ path: out, type: 'png', fullPage: true, clip: { x: 0, y: 0, width: 1440, height: Math.round(bottom) } });
  console.log(`01-board.png: ${fs.statSync(out).size} bytes (clipped at row boundary y=${Math.round(bottom)})`);
  await page.close();
}

// Shot 2: detail drawer on row #1. A taller viewport so the farm plan shows.
const firstSlug = JSON.parse(fs.readFileSync(path.join(OUT, 'board.json'), 'utf8')).rows[0].slug;
await shot('02-detail.png', `http://127.0.0.1:${port}/dashboard/index.html#detail=${encodeURIComponent(firstSlug)}`, {
  viewport: { width: 1440, height: 1500 },
  shot: { fullPage: false },
});

// Shot 3: FARM filter, full page.
await shot('03-farm.png', `http://127.0.0.1:${port}/dashboard/index.html#filter=FARM`, {
  shot: { fullPage: true },
});

await browser.close();
server.close();

// The scorer caps each screenshot at 524,288 bytes. A full-page PNG of a dense
// table can exceed that; a 256-colour palette re-save of this flat UI stays
// visually identical and lands well under the cap.
import { execFileSync } from 'node:child_process';
for (const name of ['01-board.png', '02-detail.png', '03-farm.png']) {
  const p = path.join(SHOTS, name);
  if (fs.statSync(p).size > 524288) {
    execFileSync('python3', ['-c',
      `from PIL import Image; im = Image.open(${JSON.stringify(p)}); im.convert('P', palette=Image.ADAPTIVE, colors=256).save(${JSON.stringify(p)}, optimize=True)`],
      { stdio: 'inherit' });
    console.log(`${name}: palette-optimised to ${fs.statSync(p).size} bytes`);
  }
}

if (errors.length) {
  console.error('ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ERRORS: none');
