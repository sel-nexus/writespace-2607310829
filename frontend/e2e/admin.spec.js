/** Author real admin journeys on both configured desktop and mobile projects without mocks. */
import { test, expect, captureEvidence } from './fixtures.js';

/** Log in through the visible public login link. */
async function login(page, username = 'admin', password = 'admin') {
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(username === 'writer-demo' ? /\/blogs$/ : /\/admin$/);
}

/** Follow the actual responsive navbar, opening the mobile disclosure when necessary. */
async function navigate(page, name) {
  const nav = page.getByRole('navigation', { name: 'Member navigation' });
  await expect(nav).toBeVisible();
  const link = nav.getByRole('link', { name, exact: true });
  if (!await link.isVisible()) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await link.click();
}

/** Clear the session using the account menu. */
async function logout(page, displayName) {
  await page.getByRole('button', { name: `Account: ${displayName}`, exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
}

/** Fill and submit the real account form with demo-only credentials. */
async function createAccount(page, displayName, username, role) {
  await page.getByLabel('Display Name', { exact: true }).fill(displayName);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo-pass');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(`Account created for ${displayName}.`);
}

/** Locate the account representation actually visible at the current viewport. */
function accountView(page, username, mobile) {
  return mobile ? page.getByRole('article', { name: `Account ${username}`, exact: true })
    : page.getByRole('row').filter({ has: page.getByRole('button', { name: `Delete ${username}`, exact: true }) });
}

/** Check a metric's exact-case label and associated real value. */
async function stat(page, label, count) {
  const metric = page.locator('dl').filter({ has: page.getByText(label, { exact: true }) });
  await expect(metric.locator('dd')).toHaveText(String(count));
}

/** Handle a real browser confirmation once and assert its explanatory text. */
function confirmOnce(page, message, accept) {
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe(message);
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  });
}

test('admin creates both roles, manages a member post, protects accounts and confirms eligible deletion', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.goto('/');
  await login(page);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await stat(page, 'Total Posts', 0);
  await stat(page, 'Total Users', 1);
  await stat(page, 'Total Admins', 1);
  await stat(page, 'Total users', 0);
  await expect(page.getByText('No posts yet. Write your first post to get started.')).toBeVisible();
  await captureEvidence(page, testInfo, 'admin-empty');
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await expect(page.getByText(/Never use real passwords or sensitive data/)).toBeVisible();
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  for (const label of ['Display Name', 'Username', 'Password', 'Role']) {
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
  }
  await captureEvidence(page, testInfo, 'admin-required-errors');
  await createAccount(page, 'Demo Writer', 'writer-demo', 'user');
  await createAccount(page, 'Demo Manager', 'manager-demo', 'admin');
  const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(accounts.map((account) => account.role)).toEqual(['user', 'admin']);
  for (const account of accounts) {
    expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  }
  const defaultDelete = accountView(page, 'admin', mobile).getByRole('button', { name: 'Delete admin', exact: true });
  await expect(defaultDelete).toBeDisabled();
  await expect(defaultDelete).toHaveAttribute('title', 'Default admin cannot be deleted.');
  await expect(accountView(page, 'writer-demo', mobile)).toContainText('Demo Writer');
  await expect(accountView(page, 'writer-demo', mobile).getByRole('img')).toHaveAccessibleName('Member avatar');
  await expect(accountView(page, 'manager-demo', mobile).getByRole('img')).toHaveAccessibleName('Admin avatar');
  if (mobile) await expect(page.getByRole('table')).toBeHidden();
  else await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Display Name', { exact: true }).fill('Duplicate Demo');
  await page.getByLabel('Username', { exact: true }).fill(' WRITER-DEMO ');
  await page.getByLabel('Password', { exact: true }).fill('demo-pass');
  await page.getByLabel('Role', { exact: true }).selectOption('user');
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Username is already taken.')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(accounts);
  await page.getByRole('link', { name: 'Back to Dashboard' }).click();
  await stat(page, 'Total Users', 3);
  await stat(page, 'Total Admins', 2);
  await stat(page, 'Total users', 1);
  await logout(page, 'Admin');
  await login(page, 'writer-demo', 'demo-pass');
  await navigate(page, 'Write');
  await page.getByLabel('Title').fill('Member publication');
  await page.getByLabel('Content').fill('Member text retained after account deletion.');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Member publication');
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
  expect(original.authorId).toBe(accounts[0].id);
  await logout(page, 'Demo Writer');
  await login(page);
  await stat(page, 'Total Posts', 1);
  await page.getByRole('link', { name: 'Edit Member publication', exact: true }).click();
  await expect(page.getByLabel('Content')).toHaveValue(original.content);
  await page.getByLabel('Title').fill('Admin revised member publication');
  await page.getByLabel('Content').fill('Revised by the administrator.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin revised member publication');
  const revised = { ...original, title: 'Admin revised member publication', content: 'Revised by the administrator.' };
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([revised]);
  await navigate(page, 'Dashboard');
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title').fill('Admin publication');
  await page.getByLabel('Content').fill('A second post written through the quick action.');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await navigate(page, 'Dashboard');
  await stat(page, 'Total Posts', 2);
  await captureEvidence(page, testInfo, 'admin-populated');
  await page.getByRole('link', { name: 'Manage Users' }).click();
  confirmOnce(page, 'Delete account writer-demo? Their posts will be retained.', false);
  await accountView(page, 'writer-demo', mobile).getByRole('button').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(accounts);
  confirmOnce(page, 'Delete account writer-demo? Their posts will be retained.', true);
  await accountView(page, 'writer-demo', mobile).getByRole('button').click();
  await expect(page.getByRole('status')).toContainText('Account writer-demo deleted. Their posts were retained.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0])).toEqual(revised);
  await expect(page.getByRole('button', { name: 'Delete writer-demo', exact: true })).toHaveCount(0);
  await captureEvidence(page, testInfo, 'admin-accounts');
  await logout(page, 'Admin');
  await login(page, 'manager-demo', 'demo-pass');
  await page.getByRole('link', { name: 'Manage Users' }).click();
  const selfDelete = accountView(page, 'manager-demo', mobile).getByRole('button');
  await expect(selfDelete).toBeDisabled();
  await expect(selfDelete).toHaveAttribute('title', 'You cannot delete your current account.');
  await logout(page, 'Demo Manager');
  await login(page);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(accountView(page, 'manager-demo', mobile).getByRole('button')).toBeEnabled();
  confirmOnce(page, 'Delete account manager-demo? Their posts will be retained.', true);
  await accountView(page, 'manager-demo', mobile).getByRole('button').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([]);
  await page.getByRole('link', { name: 'Back to Dashboard' }).click();
  const savedPosts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  confirmOnce(page, 'Delete this post? This cannot be undone.', false);
  await page.getByRole('button', { name: `Delete ${revised.title}`, exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(savedPosts);
  confirmOnce(page, 'Delete this post? This cannot be undone.', true);
  await page.getByRole('button', { name: `Delete ${revised.title}`, exact: true }).click();
  await stat(page, 'Total Posts', 1);
  await expect(page.getByRole('link', { name: revised.title, exact: true })).toHaveCount(0);
  confirmOnce(page, 'Delete this post? This cannot be undone.', true);
  await page.getByRole('button', { name: 'Delete Admin publication', exact: true }).click();
  await stat(page, 'Total Posts', 0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
  await expect(page.getByText('No posts yet. Write your first post to get started.')).toBeVisible();
});

for (const path of ['/admin', '/users']) {
  test(`ordinary user is denied direct initial entry ${path} after real account creation and login`, async ({ page, context }, testInfo) => {
    await page.goto('/');
    await login(page);
    await page.getByRole('link', { name: 'Manage Users' }).click();
    await createAccount(page, 'Demo Writer', 'writer-demo', 'user');
    await logout(page, 'Admin');
    await login(page, 'writer-demo', 'demo-pass');
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    // This separate page's first navigation is the protected route, not an intermediate jump.
    const direct = await context.newPage();
    const errors = [];
    direct.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    direct.on('pageerror', (error) => errors.push(error.message));
    try {
      await direct.goto(path);
      await expect(direct).toHaveURL(/\/blogs$/);
      await expect(direct.getByRole('heading', { name: 'Admin Dashboard' })).toHaveCount(0);
      await expect(direct.getByRole('heading', { name: 'User Management' })).toHaveCount(0);
      expect(await direct.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe('user');
      await captureEvidence(direct, testInfo, `member-denied-${path.slice(1)}`);
      expect(errors).toEqual([]);
    } finally {
      await direct.close();
    }
  });
}
