/** Verify reading contracts, safe text rendering and live mutation boundaries. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { BlogCard } from '../components/BlogCard.jsx';
import Home from '../pages/Home.jsx';
import LandingPage from '../pages/LandingPage.jsx';
import { clearSession, getSession, login } from '../utils/auth.js';
import { getPosts, savePosts, saveUsers } from '../utils/storage.js';
import { canManagePost, deletePost, formatDate, getPost, sortedPosts } from '../utils/posts.js';

const member = {
  id: 'ada', username: 'ada', displayName: 'Ada Writer', password: 'demo', role: 'user',
  createdAt: '2024-01-01T00:00:00.000Z',
};
const post = {
  id: 'one', title: 'First thought', content: 'First line\n\n  Indented <script>alert("x")</script>',
  authorId: 'ada', authorName: 'Ada Writer', createdAt: '2024-02-09T10:00:00.000Z',
};
const other = { ...post, id: 'two', title: 'Another voice', authorId: 'other', authorName: 'Other Writer' };

/** Expose route outcomes without mocking router services. */
function Location() {
  return <p aria-label="Current route">{useLocation().pathname}</p>;
}

/** Mount in the same single-router arrangement as the application. */
function mount(element, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
      <Location />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  saveUsers([member]);
});

describe('publication read utilities', () => {
  it('sorts by timestamp newest first and leaves stored order intact', () => {
    const newest = { ...other, createdAt: '2025-01-01T00:00:00.000Z' };
    savePosts([post, newest]);
    expect(sortedPosts()).toEqual([newest, post]);
    expect(getPosts()).toEqual([post, newest]);
    expect(getPost('two')).toEqual(newest);
  });
  it.each([undefined, null, '', ' ', 1, {}, [], 'missing', '../one'])('rejects invalid or missing ID %j', (id) => {
    savePosts([post]);
    expect(getPost(id)).toBeNull();
  });
  it('degrades empty, corrupt, invalid and unavailable post storage safely', () => {
    expect(sortedPosts()).toEqual([]);
    for (const raw of ['{', '{}', '[null,{}]']) {
      localStorage.setItem('writespace_posts', raw);
      expect(sortedPosts()).toEqual([]);
      expect(getPost('one')).toBeNull();
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(sortedPosts()).toEqual([]);
    expect(getPost('one')).toBeNull();
  });
  it('formats zero-padded UTC dates without locale or timezone drift', () => {
    expect(formatDate(post.createdAt)).toBe('Feb 09, 2024');
    expect(formatDate('2024-12-31T23:30:00-02:00')).toBe('Jan 01, 2025');
  });
  it.each([undefined, null, '', 'bad date', 0, {}])('uses a readable fallback date for %j', (value) => {
    expect(formatDate(value)).toBe('Unknown date');
  });
  it('allows owning members and admins, not guests, other members or unknown roles', () => {
    expect(canManagePost(post, null)).toBe(false);
    expect(canManagePost(post, { userId: 'ada', role: 'user' })).toBe(true);
    expect(canManagePost(post, { userId: 'other', role: 'user' })).toBe(false);
    expect(canManagePost(post, { userId: 'admin', role: 'admin' })).toBe(true);
    expect(canManagePost(post, { userId: 'ada', role: 'owner' })).toBe(false);
    expect(canManagePost(post, { role: 'admin' })).toBe(false);
    expect(canManagePost(null, { userId: 'admin', role: 'admin' })).toBe(false);
    expect(canManagePost({}, { userId: 'admin', role: 'admin' })).toBe(false);
    login('ada', 'demo');
    expect(canManagePost(post)).toBe(true);
    clearSession();
    expect(canManagePost(post)).toBe(false);
  });
});

describe('live deletion utility', () => {
  it.each(['ada', 'admin'])('persists eligible %s deletion and preserves unrelated posts exactly', (name) => {
    savePosts([post, other]);
    login(name, name === 'admin' ? 'admin' : 'demo');
    expect(deletePost('one')).toEqual([other]);
    expect(getPosts()).toEqual([other]);
    expect(JSON.parse(localStorage.getItem('writespace_posts'))).toEqual([other]);
  });
  it('lets admin delete another author and the final post', () => {
    savePosts([other]);
    login('admin', 'admin');
    deletePost('two');
    expect(getPosts()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('writespace_posts'))).toEqual([]);
  });
  it('rejects guests and other members without altering stored posts', () => {
    savePosts([post, other]);
    expect(() => deletePost('one')).toThrow('Please log in');
    expect(getPosts()).toEqual([post, other]);
    login('ada', 'demo');
    expect(() => deletePost('two')).toThrow('only delete your own');
    expect(getPosts()).toEqual([post, other]);
  });
  it.each([undefined, null, '', ' ', 1, {}, [], 'missing'])('rejects invalid deletion ID %j with storage intact', (id) => {
    savePosts([post]);
    login('admin', 'admin');
    expect(() => deletePost(id)).toThrow('Post not found');
    expect(getPosts()).toEqual([post]);
  });
  it('rechecks removed accounts, forged roles and current ownership rather than stale UI state', () => {
    savePosts([post]);
    const session = login('ada', 'demo');
    saveUsers([]);
    expect(() => deletePost('one')).toThrow('Please log in');
    saveUsers([member]);
    localStorage.setItem('writespace_session', JSON.stringify({ ...session, role: 'admin' }));
    expect(() => deletePost('one')).toThrow('Please log in');
    login('ada', 'demo');
    savePosts([{ ...post, authorId: 'other' }]);
    expect(() => deletePost('one')).toThrow('only delete your own');
    expect(getPosts()).toEqual([{ ...post, authorId: 'other' }]);
  });
  it('refuses ambiguous duplicate ownership and preserves both records', () => {
    const collision = { ...other, id: post.id };
    savePosts([post, collision]);
    login('ada', 'demo');
    expect(() => deletePost(post.id)).toThrow('only delete your own');
    expect(getPosts()).toEqual([post, collision]);
  });
  it('reports write failure without losing existing data', () => {
    savePosts([post, other]);
    login('ada', 'demo');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => deletePost('one')).toThrow('Could not save posts');
    expect(getPosts()).toEqual([post, other]);
  });
  it('fails closed when post reads are unavailable, not overwriting existing storage', () => {
    savePosts([post]);
    login('admin', 'admin');
    const read = Storage.prototype.getItem;
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'writespace_posts') throw new Error('blocked');
      return read.call(this, key);
    });
    expect(() => deletePost('one')).toThrow('Could not read posts');
    spy.mockRestore();
    expect(getPosts()).toEqual([post]);
  });
});

describe('BlogCard summaries', () => {
  it('renders the first 120 characters literally, date, author and encoded reader link', async () => {
    const content = '<img src=x onerror=alert(1)>' + 'a'.repeat(150);
    const view = mount(<BlogCard post={{ ...post, id: 'a/b', title: '<b>Title</b>', content }} session={null} />);
    expect(screen.getByText(content.slice(0, 120))).toBeVisible();
    expect(screen.getByRole('heading')).toHaveTextContent('<b>Title</b>');
    expect(view.container.querySelector('img, script, b')).toBeNull();
    expect(screen.getByText('Feb 09, 2024')).toBeVisible();
    expect(screen.getByText('Ada Writer')).toBeVisible();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/blog/a%2Fb');
    await userEvent.setup().click(screen.getByRole('link'));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/a%2Fb');
  });
  it.each([0, 1, 2, 3, 4])('cycles literal border accents at index %s', (index) => {
    mount(<BlogCard post={post} index={index} session={null} />);
    expect(screen.getByRole('article')).toHaveClass([
      'border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500', 'border-indigo-500',
    ][index]);
  });
  it.each([null, { userId: 'other', role: 'user' }, { userId: 'ada', role: 'user' }, { userId: 'admin', role: 'admin' }])
  ('shows edit only for eligible display session %j', async (session) => {
    mount(<BlogCard post={post} session={session} />);
    const edit = screen.queryByRole('link', { name: 'Edit First thought' });
    if (session?.userId === 'ada' || session?.role === 'admin') {
      expect(edit).toHaveAttribute('href', '/edit/one');
      await userEvent.setup().click(edit);
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/edit/one');
    } else expect(edit).not.toBeInTheDocument();
  });
  it('uses admin author avatars from live accounts, and member treatment for missing authors and empty excerpts', () => {
    mount(<BlogCard post={{ ...post, authorId: 'admin' }} session={null} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Admin avatar');
    cleanup();
    mount(<BlogCard post={{ ...post, authorId: 'removed', content: '' }} session={null} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Member avatar');
    expect(screen.getByRole('heading')).toHaveTextContent(post.title);
  });
});

describe('Home collection', () => {
  it('shows newest first with the required responsive grid', () => {
    login('ada', 'demo');
    savePosts([post, { ...other, createdAt: '2025-01-01T00:00:00.000Z' }]);
    mount(<Home />);
    const cards = screen.getAllByRole('article');
    expect(within(cards[0]).getByRole('heading')).toHaveTextContent('Another voice');
    expect(within(cards[1]).getByRole('heading')).toHaveTextContent('First thought');
    expect(cards[0].parentElement).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  });
  it.each(['ada', 'admin'])('offers an empty Write CTA to %s and navigates via the link', async (name) => {
    login(name, name === 'admin' ? 'admin' : 'demo');
    mount(<Home />);
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Write', exact: true }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/write');
  });
  it('uses the graceful empty state for corrupt posts', () => {
    localStorage.setItem('writespace_posts', '{');
    mount(<Home />);
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  });
});

describe('public landing', () => {
  it.each([false, true])('animates the preview wrapper rather than labels with populated=%s', (populated) => {
    if (populated) savePosts([post]);
    mount(<LandingPage />);
    const preview = screen.getByRole('complementary', { name: 'Inside your journal' });
    expect(preview).toHaveClass('motion-safe:animate-bounce', 'motion-safe:[animation-duration:6s]');
    expect(preview.querySelector('[class*="animate-"]')).toBeNull();
    expect(preview.querySelector('[class*="animation-duration"]')).toBeNull();
  });
  it('creates a real member and password-free session through the hero registration link', async () => {
    mount(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Get Started Free', exact: true }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your space starts here.');
    await user.type(screen.getByLabelText('Display Name', { exact: true }), 'New Writer');
    await user.type(screen.getByLabelText('Username', { exact: true }), 'new-writer');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'local-demo');
    await user.type(screen.getByLabelText('Confirm Password', { exact: true }), 'local-demo');
    await user.click(screen.getByRole('button', { name: 'Create Account', exact: true }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All Blogs');
    const users = JSON.parse(localStorage.getItem('writespace_users'));
    expect(users).toHaveLength(2);
    expect(users[0]).toEqual(member);
    expect(users[1]).toEqual({
      id: expect.any(String), createdAt: expect.any(String), displayName: 'New Writer',
      username: 'new-writer', password: 'local-demo', role: 'user',
    });
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual({
      userId: users[1].id, username: 'new-writer', displayName: 'New Writer', role: 'user',
    });
  });
  it.each([
    ['Home', '/', 'WriteSpace'], ['All Blogs', '/login', 'Welcome back.'],
    ['Login', '/login', 'Welcome back.'], ['Register', '/register', 'Your space starts here.'],
  ])('clicks the public footer %s link through the real route and guard', async (name, route, heading) => {
    savePosts([post]);
    mount(<App />);
    await userEvent.setup().click(within(screen.getByRole('navigation', { name: 'Footer navigation' }))
      .getByRole('link', { name, exact: true }));
    expect(screen.getByLabelText('Current route').textContent).toBe(route);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(getPosts()).toEqual([post]);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([member]);
  });
  it('logs in through the hero then clicks member reading, dashboard and list-card editing links', async () => {
    savePosts([post, other]);
    mount(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Start Reading', exact: true }));
    await user.type(screen.getByLabelText('Username', { exact: true }), 'ada');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'demo');
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    const session = { userId: 'ada', username: 'ada', displayName: 'Ada Writer', role: 'user' };
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
    await user.click(within(screen.getByRole('navigation', { name: 'Member navigation' }))
      .getByRole('link', { name: 'WriteSpace', exact: true }));
    await user.click(screen.getByRole('link', { name: 'Start Reading', exact: true }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/blogs');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All Blogs');
    await user.click(within(screen.getByRole('navigation', { name: 'Member navigation' }))
      .getByRole('link', { name: 'WriteSpace', exact: true }));
    await user.click(screen.getByRole('link', { name: 'Go to Dashboard', exact: true }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/blogs');
    expect(screen.queryByRole('link', { name: 'Edit Another voice' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Edit First thought', exact: true }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/edit/one');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Edit post');
    expect(screen.getByLabelText('Title')).toHaveValue(post.title);
    expect(screen.getByLabelText('Content')).toHaveValue(post.content);
    expect(getPosts()).toEqual([post, other]);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
  });
  it('shows exact product copy, features, empty message and footer routes/year', () => {
    mount(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WriteSpace');
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
    for (const title of ['Write Freely', 'Private & Local', 'Instant & Fast', 'Latest from the Blog']) {
      expect(screen.getByRole('heading', { name: title })).toBeVisible();
    }
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    const footer = within(screen.getByRole('navigation', { name: 'Footer navigation' }));
    for (const [name, href] of [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']]) {
      expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    expect(screen.getByText(`© ${new Date().getFullYear()} WriteSpace`)).toBeVisible();
  });
  it('shows only the latest three in the latest section and uses an actual newest hero card', () => {
    savePosts([1, 2, 3, 4].map((day) => ({ ...post, id: `${day}`, title: `Story ${day}`, createdAt: `2024-02-0${day}T00:00:00Z` })));
    mount(<LandingPage />);
    const latest = within(screen.getByRole('region', { name: 'Latest from the Blog' }));
    expect(latest.getAllByRole('article')).toHaveLength(3);
    expect(latest.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Latest from the Blog', 'Story 4', 'Story 3', 'Story 2',
    ]);
    expect(screen.queryByText('Story 1')).not.toBeInTheDocument();
    expect(within(screen.getByRole('complementary')).getByRole('article')).toHaveTextContent('Story 4');
  });
  it.each([null, { userId: 'ada', role: 'user' }, { userId: 'admin', role: 'admin' }])
  ('routes Start Reading for %j and exposes free registration', async (session) => {
    mount(<LandingPage session={session} />);
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
    await userEvent.setup().click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(session ? '/blogs' : '/login');
  });
  it('redirects guest preview clicks to login and keeps public data literal', async () => {
    savePosts([post]);
    mount(<App />);
    const latest = within(screen.getByRole('region', { name: 'Latest from the Blog' }));
    expect(latest.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
    await userEvent.setup().click(latest.getByRole('link', { name: 'Read First thought' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  });
});

describe('reader and confirmed mutation', () => {
  it('renders full content literally with preserved whitespace and member avatar', () => {
    login('ada', 'demo');
    savePosts([post]);
    const view = mount(<App />, '/blog/one');
    const content = view.container.querySelector('.whitespace-pre-wrap');
    expect(content.textContent).toBe(post.content);
    expect(content).toHaveClass('whitespace-pre-wrap');
    expect(view.container.querySelector('script')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(post.title);
    expect(within(screen.getByRole('article')).getByRole('img')).toHaveAccessibleName('Member avatar');
    expect(screen.getByText('Feb 09, 2024')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/edit/one');
  });
  it('shows an admin author avatar, but no management controls for other members', async () => {
    login('ada', 'demo');
    savePosts([{ ...other, authorId: 'admin' }]);
    mount(<App />, '/blog/two');
    expect(within(screen.getByRole('article')).getByRole('img')).toHaveAccessibleName('Admin avatar');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
  it.each(['missing', '%20', '..'])('shows missing entry %s with a working back link', async (id) => {
    login('ada', 'demo');
    mount(<App />, `/blog/${id}`);
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
  it('does not navigate or mutate when confirmation is cancelled', async () => {
    login('ada', 'demo');
    savePosts([post]);
    mount(<App />, '/blog/one');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(getPosts()).toEqual([post]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/one');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each(['ada', 'admin'])('confirms %s deletion and returns to list only after storage removal', async (name) => {
    login(name, name === 'admin' ? 'admin' : 'demo');
    savePosts([post, other]);
    mount(<App />, name === 'admin' ? '/blog/two' : '/blog/one');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(screen.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(getPosts()).toEqual([name === 'admin' ? post : other]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All Blogs');
  });
  it('shows storage write failure and stays in the reader with post intact', async () => {
    login('ada', 'demo');
    savePosts([post]);
    mount(<App />, '/blog/one');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save posts');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/one');
    expect(getPosts()).toEqual([post]);
  });
  it.each(['session', 'ownership', 'missing'])('rechecks %s changed while confirmation was open and shows error without success navigation', async (change) => {
    login('ada', 'demo');
    savePosts([post]);
    mount(<App />, '/blog/one');
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (change === 'session') clearSession();
      if (change === 'ownership') savePosts([{ ...post, authorId: 'other' }]);
      if (change === 'missing') savePosts([]);
      return true;
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent({
      session: 'Please log in', ownership: 'only delete your own', missing: 'Post not found',
    }[change]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/one');
    expect(getPosts()).toEqual(change === 'missing' ? [] : [{ ...post, authorId: change === 'ownership' ? 'other' : 'ada' }]);
  });
  it('lets a logged-in member enter from the landing CTA, read, return and see persisted content', async () => {
    login('ada', 'demo');
    savePosts([post]);
    mount(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    await user.click(screen.getByRole('link', { name: 'Read First thought' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('First thought');
    await user.click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByRole('article')).toHaveTextContent('First thought');
    expect(getPosts()).toEqual([post]);
    expect(getSession().userId).toBe('ada');
  });
});
