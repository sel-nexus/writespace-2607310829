/** Exercise local identity journeys through visible links on desktop and mobile. */
import { test, expect, captureEvidence } from './fixtures.js';

/** Enter registration values using accessible field labels. */
async function fillRegistration(page, username, confirmation = 'demo-pass') {
  await page.getByLabel('Display Name', { exact: true }).fill('Ada Writer');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo-pass');
  await page.getByLabel('Confirm Password', { exact: true }).fill(confirmation);
}

/** Log out through the account disclosure. */
async function logout(page, name) {
  await page.getByRole('button', { name: `Account: ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
}

test('register, reload, logout, reject duplicates and mismatch, then log in', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await fillRegistration(page, 'ada', 'wrong');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
  await captureEvidence(page, testInfo, 'registration-error');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo-pass');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users'))[0].role)).toBe('user');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account: Ada Writer', exact: true })).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  }
  await page.getByRole('navigation', { name: 'Member navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await captureEvidence(page, testInfo, 'member-navigation');
  await logout(page, 'Ada Writer');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await fillRegistration(page, ' ADA ');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Username is already taken.');
  await page.getByRole('main').getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back.', exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('ada');
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('ada');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await page.getByLabel('Password', { exact: true }).fill('demo-pass');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
});

test('admin login, role navigation, public dashboard return and logout', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByText('Demo credentials: admin / admin')).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.reload();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await page.getByRole('navigation').getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await logout(page, 'Admin');
});

for (const path of ['/blogs', '/blog/missing', '/write', '/edit/missing', '/admin', '/users']) {
  test(`guest direct entry ${path} fails closed`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  });
}

for (const path of ['/admin', '/users']) {
  test(`member direct entry ${path} rejects admin access`, async ({ page }) => {
    await page.addInitScript(() => {
      const account = {
        id: 'member', username: 'member', displayName: 'Member', password: 'demo', role: 'user',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      localStorage.setItem('writespace_users', JSON.stringify([account]));
      localStorage.setItem('writespace_session', JSON.stringify({
        userId: account.id, username: account.username, displayName: account.displayName, role: account.role,
      }));
    });
    await page.goto(path);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('button', { name: 'Account: Member', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  });
}
