/** Capture browser failures before navigation and save review evidence on demand. */
import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors, 'Browser console and uncaught errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** Save HTML, accessibility and computed styles beside a human-review screenshot. */
export async function captureEvidence(page, testInfo, name) {
  const data = {
    accessibility: await page.locator('body').ariaSnapshot(),
    html: await page.content(),
    styles: await page.locator('main').evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, font: style.fontFamily };
    }),
  };
  await writeFile(testInfo.outputPath(`${name}-preflight.txt`), JSON.stringify(data, null, 2));
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}
