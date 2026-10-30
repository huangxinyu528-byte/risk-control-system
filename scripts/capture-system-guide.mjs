import { chromium } from 'playwright';
import path from 'node:path';

const base = 'http://localhost:3006';
const outDir = path.join(process.cwd(), 'reports/assets/system-guide');
const password = process.env.SITE_ACCESS_PASSWORD || 'zc-test-2026';

async function capture(page, url, filename) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true });
}

async function ensureLoggedIn(page) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    const input = page.locator('input[type="password"]');
    await input.fill(password);
    await page.getByRole('button', { name: '进入系统' }).click();
    await page.waitForLoadState('networkidle');
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
const page = await context.newPage();

await capture(page, `${base}/login`, '01-login.png');
await ensureLoggedIn(page);
await capture(page, `${base}/customers`, '02-customers.png');
await capture(page, `${base}/risk`, '03-risk-overview.png');
await capture(page, `${base}/risk/customers`, '04-risk-customers.png');
await capture(page, `${base}/risk/projects`, '05-risk-projects.png');
await capture(page, `${base}/customers/IMP-98320814F770`, '06-customer-detail.png');

await browser.close();
