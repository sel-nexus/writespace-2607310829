/** Verify writing mutations and form transitions using real local storage and routing. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { clearSession, login } from '../utils/auth.js';
import { getPosts, savePosts, saveUsers } from '../utils/storage.js';
import { createPost, updatePost, deletePost, validatePost } from '../utils/posts.js';

const member = {
  id: 'ada', username: 'ada', displayName: 'Ada Writer', password: 'demo', role: 'user',
  createdAt: '2024-01-01T00:00:00.000Z',
};
const otherMember = { ...member, id: 'bea', username: 'bea', displayName: 'Bea Writer' };
const post = {
  id: 'one', title: 'First thought', content: 'First line\n\n  Indented text  ',
  authorId: 'ada', authorName: 'Ada Writer', createdAt: '2024-02-09T10:00:00.000Z',
};
const other = { ...post, id: 'two', title: 'Another voice', authorId: 'bea', authorName: 'Bea Writer' };
const fields = { title: '  Changed title  ', content: '  Changed\n\n content  ' };

/** Expose real navigation outcomes without mocking the router. */
function Location() {
  return <p aria-label="Current route">{useLocation().pathname}</p>;
}

/** Mount the application inside its sole router with optional prior history. */
function mount(path = '/write', previous) {
  return render(
    <MemoryRouter
      initialEntries={previous ? [previous, path] : [path]}
      initialIndex={previous ? 1 : 0}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
      <Location />
    </MemoryRouter>,
  );
}

/** Replace visible draft fields through ordinary user input. */
async function fill(user, title = fields.title, content = fields.content) {
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), title);
  await user.clear(screen.getByLabelText('Content'));
  await user.type(screen.getByLabelText('Content'), content);
}

beforeEach(() => {
  localStorage.clear();
  saveUsers([member, otherMember]);
});

describe('plain-text validation', () => {
  it.each([undefined, null, [], 42, 'text', {}, { title: ' \t', content: '\n ' }, { title: 1, content: {} }])
  ('returns both field errors for invalid input %j', (input) => {
    expect(validatePost(input)).toEqual({ title: 'Title is required.', content: 'Content is required.' });
  });
  it('validates each field separately and leaves large literal input unchanged', () => {
    expect(validatePost({ title: 'Title', content: '' })).toEqual({ content: 'Content is required.' });
    expect(validatePost({ title: '', content: 'Content' })).toEqual({ title: 'Title is required.' });
    const input = { title: '<b>Title</b>', content: '  <script>alert(1)</script>\n' + 'x'.repeat(100000) };
    const original = { ...input };
    expect(validatePost(input)).toEqual({});
    expect(input).toEqual(original);
  });
});

describe('live writing mutations', () => {
  it.each(['ada', 'admin'])('creates a UUID and ISO timestamp with live %s authorship, ignoring caller metadata', (name) => {
    savePosts([other]);
    const session = login(name, name === 'admin' ? 'admin' : 'demo');
    const before = Date.now();
    const created = createPost({ ...fields, ...post, title: fields.title, content: fields.content });
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    expect(Date.parse(created.createdAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(created.createdAt)).toBeLessThanOrEqual(Date.now());
    expect(created).toEqual({
      id: created.id, createdAt: created.createdAt, title: 'Changed title', content: fields.content,
      authorId: session.userId, authorName: session.displayName,
    });
    expect(getPosts()).toEqual([other, created]);
  });
  it('uses crypto.randomUUID rather than supplied identity and preserves large HTML as text', () => {
    login('ada', 'demo');
    const uuid = 'a3167920-0bb1-48ca-9dd6-a8bc4791d780';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);
    const content = '  <img src=x onerror=alert(1)>\n' + 'x'.repeat(100000) + '  ';
    const created = createPost({ title: '<b>Title</b>', content, id: 'forged', authorId: 'admin' });
    expect(getPosts()).toEqual([{ ...created, id: uuid, content, authorId: 'ada', title: '<b>Title</b>' }]);
  });
  it.each(['ada', 'admin'])('updates eligible %s text while preserving stored metadata and unrelated posts', (name) => {
    savePosts([post, other]);
    login(name, name === 'admin' ? 'admin' : 'demo');
    const target = name === 'admin' ? other : post;
    const saved = updatePost(target.id, { ...fields, id: 'forged', createdAt: 'bad', authorId: 'admin', authorName: 'Forged' });
    expect(saved).toEqual({ ...target, title: 'Changed title', content: fields.content });
    expect(getPosts()).toEqual(name === 'admin' ? [post, saved] : [saved, other]);
  });
  it.each([undefined, null, '', ' ', 1, {}, [], 'missing'])('rejects invalid update identity %j without writing', (id) => {
    login('ada', 'demo');
    savePosts([post]);
    expect(() => updatePost(id, fields)).toThrow('Post not found');
    expect(getPosts()).toEqual([post]);
  });
  it.each(['create', 'update'])('rejects unauthenticated, forged and removed sessions for %s', (operation) => {
    savePosts([post]);
    const mutate = () => operation === 'create' ? createPost(fields) : updatePost('one', fields);
    expect(mutate).toThrow('Please log in');
    const session = login('ada', 'demo');
    localStorage.setItem('writespace_session', JSON.stringify({ ...session, role: 'admin' }));
    expect(mutate).toThrow('Please log in');
    login('ada', 'demo');
    saveUsers([otherMember]);
    expect(mutate).toThrow('Please log in');
    expect(getPosts()).toEqual([post]);
  });
  it('rejects nonowners, changed ownership and mixed duplicate ownership', () => {
    login('ada', 'demo');
    for (const posts of [[other], [{ ...post, authorId: 'bea' }], [post, { ...other, id: 'one' }]]) {
      savePosts(posts);
      expect(() => updatePost(posts[0].id, fields)).toThrow('only edit your own');
      expect(getPosts()).toEqual(posts);
    }
  });
  it('re-reads metadata and permission after switching live accounts', () => {
    savePosts([post]);
    login('ada', 'demo');
    const current = { ...post, authorName: 'Stored name', createdAt: '2025-01-01T00:00:00.000Z' };
    savePosts([current]);
    login('bea', 'demo');
    expect(() => updatePost('one', fields)).toThrow('only edit your own');
    login('admin', 'admin');
    expect(updatePost('one', fields)).toEqual({ ...current, title: 'Changed title', content: fields.content });
  });
  it.each(['create', 'update'])('rejects every invalid field shape for %s and retains stored data', (operation) => {
    login('ada', 'demo');
    savePosts([post]);
    for (const input of [null, [], {}, { title: ' ', content: 'ok' }, { title: 'ok', content: '\n' }]) {
      expect(() => operation === 'create' ? createPost(input) : updatePost('one', input)).toThrow(/is required/);
      expect(getPosts()).toEqual([post]);
    }
  });
  it.each(['create', 'update'])('reports storage write failure for %s without data loss', (operation) => {
    login('ada', 'demo');
    savePosts([post]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => operation === 'create' ? createPost(fields) : updatePost('one', fields)).toThrow('Could not save posts');
    expect(getPosts()).toEqual([post]);
  });
  it.each(['create', 'update', 'delete'])('refuses %s on unavailable post reads while writes remain usable', (operation) => {
    login('ada', 'demo');
    savePosts([post, other]);
    const retained = localStorage.getItem('writespace_posts');
    const originalRead = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'writespace_posts') throw new Error('blocked');
      return originalRead.call(this, key);
    });
    localStorage.setItem('write_probe', 'usable');
    expect(localStorage.getItem('write_probe')).toBe('usable');
    expect(getPosts()).toEqual([]);
    expect(() => operation === 'create' ? createPost(fields)
      : operation === 'update' ? updatePost('one', fields) : deletePost('one')).toThrow('Could not read posts');
    read.mockRestore();
    expect(localStorage.getItem('writespace_posts')).toBe(retained);
    expect(getPosts()).toEqual([post, other]);
  });
  it.each(['create', 'update', 'delete'])('refuses %s on corrupt post collections without dropping invalid siblings', (operation) => {
    login('ada', 'demo');
    for (const raw of ['{', 'null', '{}', JSON.stringify([post, { ...other, id: '' }])]) {
      localStorage.setItem('writespace_posts', raw);
      expect(() => operation === 'create' ? createPost(fields)
        : operation === 'update' ? updatePost('one', fields) : deletePost('one')).toThrow('Could not read posts');
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
    }
  });
});

describe('writing form and guarded routes', () => {
  it.each(['/write', '/edit/one'])('redirects guest route %s to login without a writing form', (path) => {
    savePosts([post]);
    mount(path);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.queryByLabelText('Content')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  });
  it('redirects a nonowner to blogs without showing editable content', () => {
    login('bea', 'demo');
    savePosts([post]);
    mount('/edit/one');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(screen.queryByLabelText('Content')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  });
  it('shows missing edit and a working back link', async () => {
    login('ada', 'demo');
    mount('/edit/missing');
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
  it('associates inline required errors, blocks whitespace drafts, and clears errors on valid submission', async () => {
    login('ada', 'demo');
    mount();
    const user = userEvent.setup();
    expect(screen.getByLabelText('Title')).toHaveClass('w-full');
    expect(screen.getByLabelText('Content')).toHaveClass('w-full', 'min-h-64');
    expect(screen.getByRole('status')).toHaveTextContent('0 characters');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    for (const label of ['Title', 'Content']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(new RegExp(`${label} is required`));
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
    }
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    await fill(user, '   ', '\n  ');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(getPosts()).toEqual([]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/write');
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Changed title');
    expect(getPosts()[0].content).toBe(fields.content);
    expect(screen.getByLabelText('Current route').textContent).toBe(`/blog/${getPosts()[0].id}`);
  });
  it('counts literal large HTML input and renders it safely after publishing', async () => {
    login('ada', 'demo');
    const view = mount();
    const user = userEvent.setup();
    const content = '  <script>alert(1)</script>\n' + 'x'.repeat(10000) + '  ';
    await user.type(screen.getByLabelText('Title'), '<b>Plain title</b>');
    await user.click(screen.getByLabelText('Content'));
    await user.paste(content);
    expect(screen.getByRole('status')).toHaveTextContent(`${content.length} characters`);
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(view.container.querySelector('script, b')).toBeNull();
    expect(view.container.querySelector('.whitespace-pre-wrap').textContent).toBe(content);
    expect(getPosts()[0].content).toBe(content);
  });
  it.each(['ada', 'admin'])('prefills and saves eligible %s edit preserving post identity', async (name) => {
    login(name, name === 'admin' ? 'admin' : 'demo');
    savePosts([post, other]);
    mount('/edit/one');
    expect(screen.getByLabelText('Title')).toHaveValue(post.title);
    expect(screen.getByLabelText('Content')).toHaveValue(post.content);
    expect(screen.getByRole('status')).toHaveTextContent(`${post.content.length} characters`);
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    expect(getPosts()).toEqual([{ ...post, title: 'Changed title', content: fields.content }, other]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/one');
  });
  it.each(['/write', '/edit/one'])('Cancel from %s returns through history and never saves', async (path) => {
    login('ada', 'demo');
    savePosts([post]);
    mount(path, '/blog/one');
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/one');
    expect(getPosts()).toEqual([post]);
  });
  it.each(['/write', '/edit/one'])('storage failure on %s stays inline with draft intact and permits retry', async (path) => {
    login('ada', 'demo');
    savePosts([post]);
    mount(path);
    const user = userEvent.setup();
    await fill(user);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: path === '/write' ? 'Publish' : 'Save', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save posts. Browser storage is unavailable or full.');
    expect(screen.getByLabelText('Current route').textContent).toBe(path);
    expect(screen.getByLabelText('Content')).toHaveValue(fields.content);
    expect(getPosts()).toEqual([post]);
    spy.mockRestore();
    await user.click(screen.getByRole('button', { name: path === '/write' ? 'Publish' : 'Save', exact: true }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Changed title');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each(['session', 'ownership', 'missing'])('rejects stale %s at save without success navigation or overwriting', async (change) => {
    login('ada', 'demo');
    savePosts([post]);
    mount('/edit/one');
    const user = userEvent.setup();
    await fill(user);
    if (change === 'session') clearSession();
    if (change === 'ownership') savePosts([{ ...post, authorId: 'bea' }]);
    if (change === 'missing') savePosts([]);
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    if (change === 'session') {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    } else {
      expect(screen.getByRole('alert')).toHaveTextContent(change === 'missing' ? 'Post not found' : 'only edit your own');
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/edit/one');
    }
    expect(getPosts()).toEqual(change === 'missing' ? [] : [{ ...post, authorId: change === 'ownership' ? 'bea' : 'ada' }]);
  });
  it('publishes under a newly logged-in live identity instead of the form-opening session', async () => {
    login('ada', 'demo');
    mount();
    const user = userEvent.setup();
    await fill(user);
    login('bea', 'demo');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(getPosts()[0]).toMatchObject({ authorId: 'bea', authorName: 'Bea Writer', content: fields.content });
    expect(screen.getByLabelText('Current route').textContent).toBe(`/blog/${getPosts()[0].id}`);
  });
  it('rejects blank edited content inline and retains the original post', async () => {
    login('ada', 'demo');
    savePosts([post]);
    mount('/edit/one');
    const user = userEvent.setup();
    await fill(user, 'Still a title', '  \n ');
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    expect(screen.getByLabelText('Content')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Content is required.');
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/edit/one');
    expect(getPosts()).toEqual([post]);
  });
  it('resets the draft when navigating from edit to write through existing navigation', async () => {
    login('ada', 'demo');
    savePosts([post]);
    mount('/edit/one');
    const navigation = within(screen.getByRole('navigation'));
    await userEvent.setup().click(navigation.getByRole('link', { name: 'Write', exact: true }));
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Content')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeVisible();
    expect(getPosts()).toEqual([post]);
  });
});
