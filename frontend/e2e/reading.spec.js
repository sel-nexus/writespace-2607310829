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
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({
    userId: 'ada', username: 'ada', displayName: 'Ada Writer', role: 'user',
  });
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await captureEvidence(page, testInfo, 'member-empty');
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
});

test('hero Get Started Free creates a real ordinary account and password-free session', async ({ page }, testInfo) => {
  await seed(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your space starts here.');
  await page.getByLabel('Display Name', { exact: true }).fill('New Writer');
  await page.getByLabel('Username', { exact: true }).fill('new-writer');
  await page.getByLabel('Password', { exact: true }).fill('local-demo');
  await page.getByLabel('Confirm Password', { exact: true }).fill('local-demo');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All Blogs');
  const stored = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
  }));
  expect(stored.users).toHaveLength(2);
  expect(stored.users[0]).toEqual(account);
  expect(stored.users[1]).toEqual({
    id: expect.any(String), createdAt: expect.any(String), displayName: 'New Writer',
    username: 'new-writer', password: 'local-demo', role: 'user',
  });
  expect(stored.session).toEqual({
    userId: stored.users[1].id, username: 'new-writer', displayName: 'New Writer', role: 'user',
  });
  expect(stored.posts).toEqual(posts);
  await expect(page.getByRole('link', { name: /^Edit Story/ })).toHaveCount(0);
  await captureEvidence(page, testInfo, 'hero-registered-member');
});

for (const [name, route, heading] of [
  ['Home', /\/$/, 'WriteSpace'], ['All Blogs', /\/login$/, 'Welcome back.'],
  ['Login', /\/login$/, 'Welcome back.'], ['Register', /\/register$/, 'Your space starts here.'],
]) {
  test(`public footer ${name} clicks through the real route and guest guard`, async ({ page }, testInfo) => {
    await seed(page);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Footer navigation' })
      .getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([account]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
    await captureEvidence(page, testInfo, `footer-${name.toLowerCase().replaceAll(' ', '-')}`);
  });
}

test('ordinary member clicks authenticated Start Reading, Go to Dashboard and own list-card Edit', async ({ page }, testInfo) => {
  await seed(page);
  await page.goto('/');
  await signIn(page);
  await expect(page).toHaveURL(/\/blogs$/);
  const session = { userId: 'ada', username: 'ada', displayName: 'Ada Writer', role: 'user' };
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  await page.getByRole('navigation', { name: 'Member navigation' })
    .getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All Blogs');
  await expect(page.getByRole('article')).toHaveCount(4);
  await page.getByRole('navigation', { name: 'Member navigation' })
    .getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All Blogs');
  await expect(page.getByRole('link', { name: 'Edit Story 3', exact: true })).toHaveCount(0);
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Story 4', exact: true }) })
    .getByRole('link', { name: 'Edit Story 4', exact: true }).click();
  await expect(page).toHaveURL(/\/edit\/story-4$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit post');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(posts[3].title);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(posts[3].content);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  await captureEvidence(page, testInfo, 'member-list-card-edit');
});

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`hero preview card respects ${reducedMotion} motion preference`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    await seed(page);
    await page.goto('/');
    const preview = page.getByRole('complementary', { name: 'Inside your journal' });
    await expect(preview.getByRole('article')).toContainText('Story 4');
    const motion = await preview.evaluate((element) => {
      const style = getComputedStyle(element);
      return { name: style.animationName, duration: style.animationDuration };
    });
    expect(motion.name).toBe(reducedMotion === 'reduce' ? 'none' : 'bounce');
    if (reducedMotion === 'no-preference') expect(motion.duration).toBe('6s');
    await expect(preview.locator('[class*="animate-"]')).toHaveCount(0);
    await captureEvidence(page, testInfo, `hero-motion-${reducedMotion}`);
    await testInfo.attach('hero-motion', {
      body: JSON.stringify({ reducedMotion, ...motion }), contentType: 'application/json',
    });
  });
}

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
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Read Story 4' })).toBeVisible();
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
