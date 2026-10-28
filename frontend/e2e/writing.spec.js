/** Author real writing journeys for both configured desktop and mobile projects. */
import { test, expect } from './fixtures.js';

/** Register a local member through the actual public UI. */
async function register(page, username, displayName) {
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name', { exact: true }).fill(displayName);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo-pass');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo-pass');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
}

/** Open responsive member navigation before following a visible link. */
async function followNavigation(page, name) {
  const nav = page.getByRole('navigation', { name: 'Member navigation' });
  const link = nav.getByRole('link', { name, exact: true });
  if (!await link.isVisible()) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await link.click();
}

/** Log out using the account disclosure, not browser storage manipulation. */
async function logout(page, displayName) {
  await page.getByRole('button', { name: `Account: ${displayName}`, exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('register, publish, read, edit, reload, cancel, login and confirm delete', async ({ page }) => {
  await page.goto('/');
  await register(page, 'ada-writing', 'Ada Writer');
  await followNavigation(page, 'Write');
  await expect(page.getByRole('heading', { name: 'Write a post' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByLabel('Title')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Content')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
  await expect(page.getByText('Content is required.', { exact: true })).toBeVisible();
  const content = '  First line\n\n  <script>alert("plain text")</script>  ';
  await page.getByLabel('Title').fill('A writing journey');
  await page.getByLabel('Content').fill(content);
  await expect(page.getByRole('status')).toHaveText(`${content.length} characters`);
  await expect(page.getByLabel('Content')).toHaveCSS('min-height', '256px');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page).toHaveURL(/\/blog\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A writing journey');
  expect(await page.getByRole('article').locator('.whitespace-pre-wrap').textContent()).toBe(content);
  await expect(page.getByRole('article').locator('script')).toHaveCount(0);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
  expect(original.authorName).toBe('Ada Writer');
  expect(original.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(original.createdAt).toISOString()).toBe(original.createdAt);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue(original.title);
  await expect(page.getByLabel('Content')).toHaveValue(content);
  const revised = '  Revised first line\n\n  Still plain text  ';
  await page.getByLabel('Title').fill('Revised writing journey');
  await page.getByLabel('Content').fill(revised);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revised writing journey');
  expect(await page.getByRole('article').locator('.whitespace-pre-wrap').textContent()).toBe(revised);
  const saved = { ...original, title: 'Revised writing journey', content: revised };
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([saved]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title').fill('Unsaved edit');
  await page.getByLabel('Content').fill('Discard this edit');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saved.title);
  await followNavigation(page, 'Write');
  await page.getByLabel('Title').fill('Unsaved new post');
  await page.getByLabel('Content').fill('Discard this new post');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([saved]);
  await logout(page, 'Ada Writer');
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('ada-writing');
  await page.getByLabel('Password', { exact: true }).fill('demo-pass');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('link', { name: `Read ${saved.title}`, exact: true }).click();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Delete this post? This cannot be undone.');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saved.title);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([saved]);
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Delete this post? This cannot be undone.');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
});

test('nonowner direct edit entry rejects access after real registration and login', async ({ page, context }) => {
  await page.goto('/');
  await register(page, 'owner-writing', 'Owner Writer');
  await followNavigation(page, 'Write');
  await page.getByLabel('Title').fill('Owned post');
  await page.getByLabel('Content').fill('Only the owner may edit this.');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Owned post');
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
  const editURL = await page.getByRole('link', { name: 'Edit', exact: true }).getAttribute('href');
  await logout(page, 'Owner Writer');
  await register(page, 'visitor-writing', 'Visitor Writer');
  await logout(page, 'Visitor Writer');
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('visitor-writing');
  await page.getByLabel('Password', { exact: true }).fill('demo-pass');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('link', { name: 'Read Owned post', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  // A separate page's initial entry explicitly exercises the forbidden deep link.
  const direct = await context.newPage();
  const errors = [];
  direct.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  direct.on('pageerror', (error) => errors.push(error.message));
  await direct.goto(editURL);
  await expect(direct).toHaveURL(/\/blogs$/);
  await expect(direct.getByLabel('Content', { exact: true })).toHaveCount(0);
  expect(await direct.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([original]);
  expect(errors).toEqual([]);
  await direct.close();
});
