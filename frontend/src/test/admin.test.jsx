/** Exercise admin rendering, real persistence, validation and live authorization boundaries. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import UserManagement from '../pages/UserManagement.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { UserRow } from '../components/UserRow.jsx';
import { createUser, deleteUser, getAllUsers, getSession, login, DEFAULT_ADMIN } from '../utils/auth.js';
import { getPosts, getUsers, savePosts, saveUsers } from '../utils/storage.js';

const member = {
  id: 'member', displayName: 'Member Writer', username: 'member', password: 'demo-pass',
  role: 'user', createdAt: '2025-01-02T00:00:00.000Z',
};
const owner = { ...member, id: 'owner', username: 'owner', displayName: 'Second Admin', role: 'admin' };
const input = { displayName: ' New Writer ', username: ' new-writer ', password: 'demo-pass', role: 'user' };

/** Produce distinguishable dates and foreign-authored posts for sorting and authorization. */
function post(number) {
  return {
    id: `post-${number}`, title: `Post ${number}`, content: 'Plain text',
    authorId: member.id, authorName: member.displayName, createdAt: `2025-01-0${number}T00:00:00.000Z`,
  };
}

/** Expose navigation outcomes without replacing the real route components. */
function Location() {
  return <p aria-label="Current route">{useLocation().pathname}</p>;
}

/** Mount with the existing single-router convention. */
function mount(element, path = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
      <Location />
    </MemoryRouter>,
  );
}

/** Fill account fields through their visible labels. */
async function fill(user, values = input) {
  for (const [label, key] of [['Display Name', 'displayName'], ['Username', 'username'], ['Password', 'password']]) {
    await user.clear(screen.getByLabelText(label, { exact: true }));
    await user.type(screen.getByLabelText(label, { exact: true }), values[key]);
  }
  await user.selectOptions(screen.getByLabelText('Role', { exact: true }), values.role);
}

/** Assert exact case-sensitive labels and their associated numbers. */
function expectStat(label, count) {
  expect(screen.getByText(label, { exact: true }).closest('dl')).toHaveTextContent(`${label}${count}`);
}

beforeEach(() => {
  localStorage.clear();
  login('admin', 'admin');
});

describe('admin components', () => {
  it.each([0, 42])('associates a statistic label with count %s', (count) => {
    render(<StatCard label="Total Posts" count={count} accent="teal" />);
    expectStat('Total Posts', count);
    expect(screen.getByText('Total Posts').closest('dl')).toHaveClass('border-teal-500');
  });
  it.each([false, true])('renders safe account metadata and eligible deletion in mobile=%s', async (mobile) => {
    const onDelete = vi.fn();
    const row = <UserRow user={member} currentUserId="admin" onDelete={onDelete} mobile={mobile} />;
    render(mobile ? row : <table><tbody>{row}</tbody></table>);
    expect(screen.getByText(member.displayName)).toBeVisible();
    expect(screen.getByText(member.username, { exact: true })).toBeVisible();
    expect(screen.getByRole('img')).toHaveAccessibleName('Member avatar');
    expect(screen.getByText('user', { exact: true })).toBeVisible();
    expect(screen.getByText('Jan 02, 2025')).toBeVisible();
    expect(screen.queryByText(member.password)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete member' }));
    expect(onDelete).toHaveBeenCalledWith(member);
  });
  it.each([false, true])('explains default and current protection but permits other admins, mobile=%s', async (mobile) => {
    for (const [account, current, reason] of [
      [DEFAULT_ADMIN, 'owner', 'Default admin cannot be deleted.'],
      [owner, 'owner', 'You cannot delete your current account.'],
      [owner, 'admin', null],
    ]) {
      const onDelete = vi.fn();
      const row = <UserRow user={account} currentUserId={current} onDelete={onDelete} mobile={mobile} />;
      render(mobile ? row : <table><tbody>{row}</tbody></table>);
      const button = screen.getByRole('button');
      expect(screen.getByRole('img')).toHaveAccessibleName('Admin avatar');
      if (reason) {
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('title', reason);
        await userEvent.click(button);
        expect(onDelete).not.toHaveBeenCalled();
      } else {
        expect(button).toBeEnabled();
        await userEvent.click(button);
        expect(onDelete).toHaveBeenCalledWith(owner);
      }
      cleanup();
    }
  });
});

describe('dashboard', () => {
  it('shows default-inclusive totals, a meaningful empty state and working quick routes', async () => {
    mount(<App />);
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    expectStat('Total Posts', 0);
    expectStat('Total Users', 1);
    expectStat('Total Admins', 1);
    expectStat('Total users', 0);
    expect(screen.getByText('No posts yet. Write your first post to get started.')).toBeVisible();
    expect(screen.getByText(/Never use real passwords or sensitive data/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveAttribute('href', '/write');
    await userEvent.click(screen.getByRole('link', { name: 'Manage Users' }));
    expect(screen.getByRole('heading', { name: 'User Management' })).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Back to Dashboard' }));
    await userEvent.click(screen.getByRole('link', { name: 'Write New Post' }));
    expect(screen.getByRole('heading', { name: 'Write a post' })).toBeVisible();
  });
  it('counts every role and shows only the newest five with real edit links', async () => {
    saveUsers([member, owner]);
    const records = [post(2), post(6), post(1), post(4), post(3), post(5)];
    savePosts(records);
    mount(<App />);
    expectStat('Total Posts', 6);
    expectStat('Total Users', 3);
    expectStat('Total Admins', 2);
    expectStat('Total users', 1);
    const recent = screen.getByRole('region', { name: 'Recent Posts' });
    expect(within(recent).getAllByRole('listitem').map((row) => within(row).getAllByRole('link')[0].textContent))
      .toEqual(['Post 6', 'Post 5', 'Post 4', 'Post 3', 'Post 2']);
    expect(within(recent).queryByText('Post 1', { exact: true })).not.toBeInTheDocument();
    expect(getPosts()).toEqual(records);
    await userEvent.click(screen.getByRole('link', { name: 'Edit Post 6' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Post 6');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/edit/post-6');
  });
  it('cancels without mutation then confirms a foreign post deletion and promotes the sixth newest', async () => {
    savePosts([1, 2, 3, 4, 5, 6].map(post));
    mount(<AdminDashboard />);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Post 6' }));
    expect(getPosts()).toHaveLength(6);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Post 6' }));
    expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
    expect(getPosts().map((record) => record.id)).toEqual([1, 2, 3, 4, 5].map((n) => `post-${n}`));
    expect(screen.queryByText('Post 6', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('Post 1', { exact: true })).toBeVisible();
    expectStat('Total Posts', 5);
    expect(screen.getByRole('status')).toHaveTextContent('Post deleted.');
  });
  it.each(['write', 'noSession', 'member', 'missing', 'stale'])('reports %s deletion failure without success', async (mode) => {
    saveUsers([member, owner]);
    if (mode === 'stale') login('owner', 'demo-pass');
    savePosts([post(1)]);
    mount(<AdminDashboard />);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    if (mode === 'noSession') localStorage.removeItem('writespace_session');
    if (mode === 'member') {
      saveUsers([{ ...member, id: 'visitor', username: 'visitor' }, member, owner]);
      login('visitor', 'demo-pass');
    }
    if (mode === 'missing') savePosts([]);
    if (mode === 'stale') saveUsers([member, { ...owner, role: 'user' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Post 1' }));
    const messages = {
      write: 'Could not save posts', noSession: 'Please log in', member: 'only delete your own posts',
      missing: 'Post not found.', stale: 'Please log in',
    };
    expect(screen.getByRole('alert')).toHaveTextContent(messages[mode]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(getPosts()).toEqual(mode === 'missing' ? [] : [post(1)]);
  });
  it('re-reads posts added after render and returns to empty after the final confirmed deletion', async () => {
    savePosts([post(1)]);
    mount(<AdminDashboard />);
    savePosts([post(1), post(2)]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Post 1' }));
    expect(getPosts()).toEqual([post(2)]);
    expect(screen.getByText('Post 2', { exact: true })).toBeVisible();
    expectStat('Total Posts', 1);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Post 2' }));
    expect(getPosts()).toEqual([]);
    expectStat('Total Posts', 0);
    expect(screen.getByText('No posts yet. Write your first post to get started.')).toBeVisible();
  });
  it('degrades malformed storage to a default-only, empty dashboard', () => {
    localStorage.setItem('writespace_posts', '{');
    localStorage.setItem('writespace_users', '{}');
    mount(<AdminDashboard />);
    expectStat('Total Users', 1);
    expectStat('Total Posts', 0);
    expect(screen.getByText(/No posts yet/)).toBeVisible();
  });
});

describe('account management', () => {
  it.each(['user', 'admin'])('creates %s through shared validation, re-reads UUID/time and leaves admin signed in', async (role) => {
    const user = userEvent.setup();
    mount(<UserManagement />, '/users');
    const session = getSession();
    const before = Date.now();
    await fill(user, { ...input, role });
    await user.click(screen.getByRole('button', { name: 'Create User', exact: true }));
    const saved = getUsers()[0];
    expect(saved).toMatchObject({ displayName: 'New Writer', username: 'new-writer', password: 'demo-pass', role });
    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(Date.parse(saved.createdAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(saved.createdAt)).toBeLessThanOrEqual(Date.now());
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([saved]);
    expect(getSession()).toEqual(session);
    expect(screen.getByRole('status')).toHaveTextContent('Account created for New Writer.');
    expect(screen.getByRole('heading', { name: 'Accounts (2)' })).toBeVisible();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getAllByText('New Writer', { exact: true })).toHaveLength(2);
  });
  it('associates all required errors with fields and does not mutate', async () => {
    mount(<UserManagement />);
    await userEvent.click(screen.getByRole('button', { name: 'Create User', exact: true }));
    for (const [label, message] of [
      ['Display Name', 'Display name is required.'], ['Username', 'Username is required.'],
      ['Password', 'Password is required.'], ['Role', 'Choose Admin or user.'],
    ]) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message);
    }
    expect(getUsers()).toEqual([]);
  });
  it.each([' ADMIN ', ' MEMBER '])('rejects reserved or case-insensitive duplicate username %s', async (username) => {
    saveUsers([member]);
    mount(<UserManagement />);
    const user = userEvent.setup();
    await fill(user, { ...input, username });
    await user.click(screen.getByRole('button', { name: 'Create User', exact: true }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is already taken.');
    expect(getUsers()).toEqual([member]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it.each(['write', 'noSession', 'member', 'stale'])('rejects %s creation at the live mutation boundary', async (mode) => {
    saveUsers([owner, member]);
    if (mode === 'stale') login('owner', 'demo-pass');
    mount(<UserManagement />);
    const user = userEvent.setup();
    await fill(user);
    if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    if (mode === 'noSession') localStorage.removeItem('writespace_session');
    if (mode === 'member') login('member', 'demo-pass');
    if (mode === 'stale') saveUsers([{ ...owner, role: 'user' }, member]);
    const before = getUsers();
    await user.click(screen.getByRole('button', { name: 'Create User', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent(mode === 'write' ? 'Could not save users' : 'Admin access is required.');
    expect(getUsers()).toEqual(before);
    expect(screen.getByLabelText('Username')).toHaveValue(input.username);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('shows desktop table/mobile cards, protection and deletes another admin only after confirmation, retaining posts', async () => {
    saveUsers([owner, member]);
    login('owner', 'demo-pass');
    savePosts([post(1)]);
    mount(<UserManagement />);
    expect(screen.getByRole('table').parentElement).toHaveClass('hidden', 'sm:block');
    expect(screen.getByRole('article', { name: 'Account member' }).parentElement).toHaveClass('sm:hidden');
    for (const name of ['admin', 'owner']) {
      for (const button of screen.getAllByRole('button', { name: `Delete ${name}` })) expect(button).toBeDisabled();
    }
    cleanup();
    login('admin', 'admin');
    mount(<UserManagement />);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete owner' })[0]);
    expect(getUsers()).toEqual([owner, member]);
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete owner' })[1]);
    expect(confirm).toHaveBeenCalledWith('Delete account owner? Their posts will be retained.');
    expect(getUsers()).toEqual([member]);
    expect(getPosts()).toEqual([post(1)]);
    expect(screen.queryByRole('button', { name: 'Delete owner' })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete member' })[0]);
    expect(getUsers()).toEqual([]);
    expect(getPosts()).toEqual([post(1)]);
    expect(screen.getByRole('heading', { name: 'Accounts (1)' })).toBeVisible();
  });
  it.each(['write', 'noSession', 'member', 'stale', 'current', 'missing'])('shows %s account deletion error and preserves live state', async (mode) => {
    saveUsers([owner, member]);
    mount(<UserManagement />);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    if (mode === 'write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    if (mode === 'noSession') localStorage.removeItem('writespace_session');
    if (mode === 'member') login('member', 'demo-pass');
    if (mode === 'current') login('owner', 'demo-pass');
    if (mode === 'stale') {
      login('owner', 'demo-pass');
      saveUsers([member]);
    }
    if (mode === 'missing') saveUsers([member]);
    const before = getUsers();
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete owner' })[0]);
    const messages = {
      write: 'Could not save users', noSession: 'Admin access', member: 'Admin access',
      stale: 'Admin access', current: 'current account', missing: 'User not found.',
    };
    expect(screen.getByRole('alert')).toHaveTextContent(messages[mode]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(getUsers()).toEqual(before);
  });
});

describe('auth integration and route access', () => {
  it.each(['', 'owner', null, 'Admin'])('rejects invalid role %s without saving an account', (role) => {
    expect(() => createUser({ ...input, role })).toThrow('Choose Admin or user.');
    expect(getUsers()).toEqual([]);
  });
  it('re-reads live accounts for duplicates, protected IDs and stale session after mutation', () => {
    const account = createUser({ ...input, role: 'admin' });
    expect(() => createUser({ ...input, username: ' NEW-WRITER ' })).toThrow('already taken');
    expect(() => deleteUser(DEFAULT_ADMIN.id)).toThrow('Default admin cannot be deleted.');
    login('new-writer', 'demo-pass');
    expect(() => deleteUser(account.id)).toThrow('current account');
    saveUsers([{ ...account, role: 'user' }]);
    expect(getSession()).toBeNull();
    expect(() => createUser({ ...input, username: 'another' })).toThrow('Admin access');
    expect(() => deleteUser(account.id)).toThrow('Admin access');
    expect(getAllUsers()).toEqual([DEFAULT_ADMIN, { ...account, role: 'user' }]);
  });
  it.each(['/admin', '/users'])('denies guest, member and stale admin initial entry at %s', (path) => {
    for (const mode of ['guest', 'member', 'stale']) {
      localStorage.clear();
      saveUsers([member, owner]);
      if (mode === 'member') login('member', 'demo-pass');
      if (mode === 'stale') {
        login('owner', 'demo-pass');
        saveUsers([member]);
      }
      mount(<App />, path);
      expect(screen.getByLabelText('Current route')).toHaveTextContent(mode === 'member' ? '/blogs' : '/login');
      expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'User Management' })).not.toBeInTheDocument();
      cleanup();
    }
  });
});
