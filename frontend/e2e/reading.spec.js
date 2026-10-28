/** Exercise real local reading journeys; fixture automatically rejects browser errors. */
import { test, expect, captureEvidence } from './fixtures.js';

const account = {
  id: 'ada', username: 'ada', displayName: 'Ada Writer', password: 'demo', role: 'user',
  createdAt: '2024-01-01T00:00:00.000Z',
};
const posts = [1, 2, 3, 4].map((day) => ({
  id: `story-${day}`, title: `Story ${day}`, content: `Story ${day} first line\n\n  Indented <script>plain text</script>\n${'Words. '.repeat(30)}`,
  authorId: day === 4 ? 'ada' : 'other', authorName: day === 4 ? 'Ada Writer' : 'Other Writer',
  createdAt: `2024-02-0${day}T00:00:00.000Z`,
}));

/** Seed only initial browser-local records, leaving sessions and services real. */
async function seed(page, publications = posts) {
  await page.addInitScript(({ user, publications }) => {
    if (!localStorage.getItem('reading-fixture-ready')) {
      localStorage.setItem('writespace_users', JSON.stringify([user]));
      localStorage.setItem('writespace_posts', JSON.stringify(publications));
      localStorage.setItem('reading-fixture-ready', 'yes');
    }
  }, { user: account, publications });
}

/** Sign in through the real accessible form after clicking a public entry link. */
async function signIn(page, name = 'ada') {
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(name);
  await page.getByLabel('Password', { exact: true }).fill(name === 'admin' ? 'admin' : 'demo');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Follow persistent member navigation, opening its real mobile disclosure if needed. */
async function allBlogs(page) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('navigation', { name: 'Member navigation' }).getByRole('link', { name: 'All Blogs', exact: true }).click();
}

test('empty public landing routes reading to real login and gives member an empty Write CTA', async ({ page }, testInfo) => {
  await seed(page, []);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('WriteSpace');
  await expect(page.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await captureEvidence(page, testInfo, 'public-empty');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username', { exact: true }).fill('ada');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await captureEvidence(page, testInfo, 'member-empty');
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
});

test('latest three public previews use actual data and guest selection fails closed', async ({ page }, testInfo) => {
  await seed(page);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('article')).toHaveCount(3);
  await expect(latest.getByRole('article').first().getByRole('heading')).toHaveText('Story 4');
  await expect(latest.getByRole('heading', { name: 'Story 1', exact: true })).toHaveCount(0);
  await expect(latest.getByRole('article').first()).toContainText('Feb 04, 2024');
  await expect(latest.getByRole('article').first()).toContainText(posts[3].content.slice(0, 120));
  await expect(latest.getByRole('link', { name: /Edit/ })).toHaveCount(0);
  await captureEvidence(page, testInfo, 'public-latest');
  await latest.getByRole('link', { name: 'Read Story 4', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
});

test('member reads other work, cancels own deletion, then confirms and persists removal', async ({ page }, testInfo) => {
  await seed(page);
  await page.goto('/');
  await signIn(page);
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('article').first().getByRole('heading')).toHaveText('Story 4');
  await expect(page.getByRole('link', { name: 'Edit Story 4' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit Story 3' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Read Story 3' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Story 3');
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(posts[2].content);
  await expect(page.locator('main script')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('link', { name: 'Read Story 4' }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/edit/story-4');
  await captureEvidence(page, testInfo, 'own-reader');
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/story-4$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')).length)).toBe(4);
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete this post?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: 'Story 4', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts.slice(0, 3));
  await page.getByRole('link', { name: 'Read Story 3' }).click();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('admin reads and deletes another author through role navigation', async ({ page }, testInfo) => {
  await seed(page);
  await page.goto('/');
  await signIn(page, 'admin');
  await expect(page).toHaveURL(/\/admin$/);
  await allBlogs(page);
  await expect(page.getByRole('link', { name: /^Edit Story/ })).toHaveCount(4);
  await page.getByRole('link', { name: 'Read Story 3' }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
  await captureEvidence(page, testInfo, 'admin-reader');
  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts.filter((post) => post.id !== 'story-3'));
});

test('missing direct entry authenticates through real form, then missing reader has a recovery link', async ({ page }, testInfo) => {
  await seed(page);
  await page.goto('/blog/missing');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username', { exact: true }).fill('ada');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  // A real post becomes stale while its card is on screen; its link is the missing entry.
  await page.evaluate(() => localStorage.setItem('writespace_posts', '[]'));
  await page.getByRole('link', { name: 'Read Story 4' }).click();
  await expect(page.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
  await captureEvidence(page, testInfo, 'missing-reader');
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
});

test('phone reader and navigation remain usable without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeVisible();
  await page.getByRole('link', { name: 'Read Story 4' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Story 4');
  expect(await page.locator('.whitespace-pre-wrap').evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('pre-wrap');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await captureEvidence(page, testInfo, 'phone-reader');
  await allBlogs(page);
  expect(await page.getByRole('article').first().evaluate((element) => getComputedStyle(element.parentElement).gridTemplateColumns.split(' ').length)).toBe(1);
  await captureEvidence(page, testInfo, 'phone-grid');
});
