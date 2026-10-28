/** Verify identity state transitions, storage boundaries and accessible interactions. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import { Navbar } from '../components/Navbar.jsx';
import { PublicNavbar } from '../components/PublicNavbar.jsx';
import { Avatar, getAvatar } from '../components/Avatar.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { getPosts, savePosts, getUsers, saveUsers } from '../utils/storage.js';
import {
  DEFAULT_ADMIN, getAllUsers, getSession, setSession, clearSession, getRoleHome,
  login, register, validateUser, createUser, deleteUser,
} from '../utils/auth.js';

const account = {
  id: 'ada', displayName: 'Ada Writer', username: 'ada', password: 'demo-pass', role: 'user',
  createdAt: '2024-01-01T00:00:00.000Z',
};
const post = {
  id: 'post', title: 'A thought', content: '<script>plain text</script>\n  Keep spacing',
  authorId: 'ada', authorName: 'Ada Writer', createdAt: '2024-01-01T00:00:00.000Z',
};
const fields = { displayName: ' Ada Writer ', username: ' ada ', password: 'demo-pass', confirmPassword: 'demo-pass' };

/** Expose route transitions as user-visible text in component tests. */
function Location() {
  return <p aria-label="Current route">{useLocation().pathname}</p>;
}

/** Mount a component with the single test router and visible route evidence. */
function mount(element, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
      <Location />
    </MemoryRouter>,
  );
}

/** Fill a registration card as a user rather than accessing component state. */
async function fillForm(user, values = fields) {
  for (const [label, key] of [['Display Name', 'displayName'], ['Username', 'username'], ['Password', 'password'], ['Confirm Password', 'confirmPassword']]) {
    await user.type(screen.getByLabelText(label, { exact: true }), values[key]);
  }
}

beforeEach(() => localStorage.clear());

describe('resilient array persistence', () => {
  it.each([
    ['posts', getPosts, savePosts, post], ['users', getUsers, saveUsers, account],
  ])('saves and re-reads %s and allows an empty array', (label, read, save, value) => {
    save([value]);
    expect(read()).toEqual([value]);
    expect(JSON.parse(localStorage.getItem(`writespace_${label}`))).toEqual([value]);
    save([]);
    expect(read()).toEqual([]);
  });
  it.each(['posts', 'users'])('returns empty %s for missing, malformed JSON, nonarrays and blocked reads', (label) => {
    const read = label === 'posts' ? getPosts : getUsers;
    expect(read()).toEqual([]);
    for (const raw of ['{', '{}', 'null', '1', '"text"']) {
      localStorage.setItem(`writespace_${label}`, raw);
      expect(read()).toEqual([]);
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(read()).toEqual([]);
  });
  it.each([
    ['posts', getPosts, post], ['users', getUsers, account],
  ])('filters malformed %s without discarding valid siblings', (label, read, value) => {
    const invalid = [null, [], {}, 5, { ...value, id: '' }, { ...value, createdAt: 'yesterday' }];
    for (const key of Object.keys(value)) invalid.push({ ...value, [key]: null });
    if (label === 'users') invalid.push({ ...value, role: 'owner' });
    localStorage.setItem(`writespace_${label}`, JSON.stringify([...invalid, value]));
    expect(read()).toEqual([value]);
  });
  it.each([
    ['posts', savePosts, getPosts, post], ['users', saveUsers, getUsers, account],
  ])('rejects invalid %s saves and preserves state on write failure', (label, save, read, value) => {
    save([value]);
    for (const invalid of [null, {}, [null], [{ ...value, createdAt: 'bad' }]]) {
      expect(() => save(invalid)).toThrow('invalid record shape');
    }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => save([])).toThrow(`Could not save ${label}`);
    expect(read()).toEqual([value]);
  });
  it('preserves large plain-text post content, including empty content and extra schema fields', () => {
    const large = { ...post, content: 'text\n'.repeat(10000), extra: 'retained' };
    savePosts([large, { ...post, id: 'empty', content: '' }]);
    expect(getPosts()).toEqual([large, { ...post, id: 'empty', content: '' }]);
  });
  it('reports serialization failure without overwriting existing posts', () => {
    savePosts([post]);
    const circular = { ...post };
    circular.extra = circular;
    expect(() => savePosts([circular])).toThrow('Could not save posts');
    expect(getPosts()).toEqual([post]);
  });
});

describe('account and session business rules', () => {
  it('always includes the permanent admin and ignores reserved stored collisions', () => {
    saveUsers([account, { ...account, id: 'admin' }, { ...account, id: 'fake', username: ' ADMIN ' }]);
    expect(getAllUsers()).toEqual([DEFAULT_ADMIN, account]);
    expect(login(' ADMIN ', 'admin')).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
    expect(getSession()).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  });
  it('logs in stored members and admins with exact passwords and role-specific homes', () => {
    saveUsers([account, { ...account, id: 'other', username: 'owner', role: 'admin' }]);
    expect(getRoleHome(login(' ADA ', 'demo-pass'))).toBe('/blogs');
    expect(getSession().userId).toBe('ada');
    expect(getRoleHome(login('owner', 'demo-pass'))).toBe('/admin');
    expect(getSession().userId).toBe('other');
    expect(getRoleHome(null)).toBe('/blogs');
  });
  it.each([['admin', 'wrong'], ['missing', 'demo'], [null, null], ['ada', ' demo-pass ']])('rejects invalid credentials %s', (name, password) => {
    saveUsers([account]);
    expect(() => login(name, password)).toThrow('Invalid username or password.');
    expect(getSession()).toBeNull();
  });
  it('validates and strips extra session fields, persists and clears idempotently', () => {
    saveUsers([account]);
    const session = { userId: 'ada', username: 'ada', displayName: 'Ada Writer', role: 'user' };
    expect(setSession({ ...session, password: 'secret' })).toEqual(session);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
    clearSession();
    clearSession();
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });
  it.each([null, [], {}, { userId: 'missing' }])('rejects invalid session objects %j', (value) => {
    expect(() => setSession(value)).toThrow('account is invalid');
    localStorage.setItem('writespace_session', JSON.stringify(value));
    expect(getSession()).toBeNull();
  });
  it('fails closed on each tampered session field and removed or changed accounts', () => {
    saveUsers([account]);
    const session = login('ada', 'demo-pass');
    for (const key of ['userId', 'username', 'displayName', 'role']) {
      localStorage.setItem('writespace_session', JSON.stringify({ ...session, [key]: 'forged' }));
      expect(getSession()).toBeNull();
      expect(() => setSession({ ...session, [key]: 'forged' })).toThrow('account is invalid');
    }
    setSession(session);
    saveUsers([{ ...account, role: 'admin' }]);
    expect(getSession()).toBeNull();
    saveUsers([]);
    expect(getSession()).toBeNull();
  });
  it('returns no session on bad JSON or blocked reads and reports failed session writes/removal', () => {
    localStorage.setItem('writespace_session', '{');
    expect(getSession()).toBeNull();
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getSession()).toBeNull();
    read.mockRestore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(() => login('admin', 'admin')).toThrow('Could not save session');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => clearSession()).toThrow('Could not log out');
  });
  it('registers a UUID ordinary member, trims names and auto-persists the exact session schema', () => {
    const current = register({ ...fields, role: 'admin' });
    const saved = getUsers()[0];
    expect(saved).toMatchObject({ displayName: 'Ada Writer', username: 'ada', password: 'demo-pass', role: 'user' });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
    expect(getSession()).toEqual(current);
    expect(current).toEqual({ userId: saved.id, username: 'ada', displayName: 'Ada Writer', role: 'user' });
  });
  it.each(['displayName', 'username', 'password', 'confirmPassword'])('rejects missing registration %s without mutation', (key) => {
    expect(() => register({ ...fields, [key]: '' })).toThrow('required');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('validates invalid types, bad role, duplicate handles and mismatched confirmation', () => {
    for (const invalid of [null, [], 1, 'text']) {
      expect(validateUser(invalid)).toEqual(validateUser());
    }
    expect(validateUser()).toEqual({
      displayName: 'Display name is required.', username: 'Username is required.',
      password: 'Password is required.', role: 'Choose Admin or user.',
    });
    expect(validateUser({ displayName: 2, username: [], password: null, role: 'owner', confirmPassword: 3 }))
      .toHaveProperty('confirmPassword', 'Confirm password is required.');
    saveUsers([account]);
    for (const username of [' ADA ', ' ADMIN ']) {
      expect(() => register({ ...fields, username })).toThrow('Username is already taken.');
    }
    expect(() => register({ ...fields, username: 'new', confirmPassword: 'bad' })).toThrow('Passwords do not match.');
    expect(getUsers()).toEqual([account]);
  });
  it('reports registration storage failure and makes a saved account recoverable after session failure', () => {
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(() => register(fields)).toThrow('Could not save users');
    expect(getUsers()).toEqual([]);
    write.mockImplementation(function (key, value) {
      if (key === 'writespace_session') throw new Error('blocked');
      return original.call(this, key, value);
    });
    expect(() => register(fields)).toThrow('Could not save session');
    expect(getUsers()[0].username).toBe('ada');
    expect(getSession()).toBeNull();
  });
  it('restricts create/delete to admins, creates both roles and deletes without removing authored posts', () => {
    expect(() => createUser({ ...fields, role: 'user' })).toThrow('Admin access');
    expect(() => deleteUser('ada')).toThrow('Admin access');
    saveUsers([account]);
    login('ada', 'demo-pass');
    expect(() => createUser({ ...fields, role: 'admin' })).toThrow('Admin access');
    expect(() => deleteUser('ada')).toThrow('Admin access');
    login('admin', 'admin');
    const owner = createUser({ ...fields, username: 'owner', role: 'admin' });
    const member = createUser({ ...fields, username: 'member', role: 'user' });
    expect(getUsers()).toEqual([account, owner, member]);
    expect(getSession().userId).toBe('admin');
    savePosts([post]);
    deleteUser(owner.id);
    expect(getUsers()).toEqual([account, member]);
    expect(getPosts()).toEqual([post]);
  });
  it('prevents default/self deletion, missing IDs, invalid creation and failed mutation writes', () => {
    login('admin', 'admin');
    expect(() => deleteUser('admin')).toThrow('Default admin cannot be deleted.');
    expect(() => deleteUser('missing')).toThrow('User not found.');
    expect(() => createUser({ ...fields, role: 'owner' })).toThrow('Choose Admin or user.');
    const owner = createUser({ ...fields, username: 'owner', role: 'admin' });
    login('owner', 'demo-pass');
    expect(() => deleteUser(owner.id)).toThrow('current account');
    login('admin', 'admin');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(() => deleteUser(owner.id)).toThrow('Could not save users');
    expect(() => createUser({ ...fields, role: 'user' })).toThrow('Could not save users');
    expect(getUsers()).toEqual([owner]);
  });
});

describe('guards and role navigation', () => {
  it('re-reads the guard on rerender after account removal', () => {
    saveUsers([account]);
    login('ada', 'demo-pass');
    const view = mount(
      <ProtectedRoute>
        <h1>Protected content</h1>
      </ProtectedRoute>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Protected content');
    saveUsers([]);
    view.rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProtectedRoute>
          <h1>Protected content</h1>
        </ProtectedRoute>
        <Location />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });
  it('refreshes the parent on cross-tab session removal and cleans up after unmount', () => {
    login('admin', 'admin');
    const view = mount(<App />, '/admin');
    clearSession();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'writespace_session' })));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.queryByRole('button', { name: 'Account: Admin', exact: true })).not.toBeInTheDocument();
    view.unmount();
    act(() => window.dispatchEvent(new StorageEvent('storage')));
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
  it('closes the mobile disclosure by toggle and Escape from a navigation link', async () => {
    const user = userEvent.setup();
    const session = login('admin', 'admin');
    mount(<Navbar session={session} onSessionChange={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    await user.click(toggle);
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    screen.getByRole('link', { name: 'Users', exact: true }).focus();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
  it.each(['user', 'admin'])('renders allowed guard children for %s', (role) => {
    saveUsers([{ ...account, role }]);
    login('ada', 'demo-pass');
    mount(
      <ProtectedRoute adminOnly={role === 'admin'}>
        <h1>Allowed content</h1>
      </ProtectedRoute>,
    );
    expect(screen.getByRole('heading', { name: 'Allowed content' })).toBeVisible();
  });
  it.each(['/blogs', '/blog/missing', '/write', '/edit/missing', '/admin', '/users'])('redirects guests at %s', (path) => {
    mount(<App />, path);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  });
  it.each(['/admin', '/users'])('redirects ordinary members away from %s', (path) => {
    saveUsers([account]);
    login('ada', 'demo-pass');
    mount(<App />, path);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(screen.queryByRole('link', { name: 'Users', exact: true })).not.toBeInTheDocument();
  });
  it.each([['admin', '/admin'], ['user', '/blogs']])('redirects %s from both auth forms', (role, home) => {
    saveUsers([{ ...account, role }]);
    login('ada', 'demo-pass');
    for (const path of ['/login', '/register']) {
      mount(<App />, path);
      expect(screen.getByLabelText('Current route')).toHaveTextContent(home);
      expect(screen.queryByRole('button', { name: 'Login', exact: true })).not.toBeInTheDocument();
      cleanup();
    }
  });
  it('exposes avatar roles and guest/member/admin public links', () => {
    const view = mount(
      <PublicNavbar />,
    );
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    view.unmount();
    for (const role of ['admin', 'user']) {
      mount(
        <PublicNavbar session={{ role, displayName: 'Ada' }} />,
      );
      expect(screen.getByRole('img')).toHaveAccessibleName(role === 'admin' ? 'Admin avatar' : 'Member avatar');
      expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', role === 'admin' ? '/admin' : '/blogs');
      cleanup();
    }
    render(getAvatar('unknown'));
    expect(screen.getByRole('img')).toHaveAccessibleName('Member avatar');
    cleanup();
    render(<Avatar role="admin" />);
    expect(screen.getByRole('img')).toHaveTextContent('👑');
  });
  it('toggles mobile/account disclosures, closes on Escape and navigation, and logs out', async () => {
    const user = userEvent.setup();
    login('admin', 'admin');
    mount(<App />, '/admin');
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('link', { name: 'Users', exact: true }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/users');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.click(screen.getByRole('link', { name: 'Write', exact: true }));
    expect(screen.getByRole('link', { name: 'Write', exact: true })).toHaveAttribute('aria-current', 'page');
    const chip = screen.getByRole('button', { name: 'Account: Admin', exact: true });
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await user.click(chip);
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeVisible();
  });
  it('keeps a failed logout visible without clearing the account or navigating', async () => {
    const user = userEvent.setup();
    const session = login('admin', 'admin');
    mount(<Navbar session={session} onSessionChange={vi.fn()} />, '/admin');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: 'Account: Admin', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not log out');
    expect(getSession()).toEqual(session);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
  });
});

describe('accessible forms and parent session refresh', () => {
  it('shows associated login required errors and rejects invalid credentials without navigation', async () => {
    const user = userEvent.setup();
    mount(<LoginPage onSessionChange={vi.fn()} />, '/login');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    for (const label of ['Username', 'Password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
    }
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });
  it('shows all required registration errors, mismatch and duplicate error associations', async () => {
    const user = userEvent.setup();
    mount(<RegisterPage onSessionChange={vi.fn()} />, '/register');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    for (const label of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-describedby');
    }
    await fillForm(user, { ...fields, confirmPassword: 'bad' });
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Confirm Password')).toHaveAccessibleDescription('Passwords do not match.');
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is already taken.');
    expect(getUsers()).toEqual([]);
  });
  it('registers through public links, refreshes the parent navbar, logs out and logs in the saved account', async () => {
    const user = userEvent.setup();
    mount(<App />);
    await user.click(screen.getByRole('link', { name: 'Get Started' }));
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getUsers()[0].displayName).toBe('Ada Writer');
    await user.click(screen.getByRole('button', { name: 'Account: Ada Writer', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login', exact: true }));
    await user.type(screen.getByLabelText('Username'), 'ada');
    await user.type(screen.getByLabelText('Password'), 'demo-pass');
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    expect(screen.getByRole('button', { name: 'Account: Ada Writer', exact: true })).toBeVisible();
    expect(getSession().username).toBe('ada');
  });
  it('logs the permanent admin into the parent role navbar and exposes public return navigation', async () => {
    const user = userEvent.setup();
    mount(<App />, '/login');
    expect(screen.getByText('Demo credentials: admin / admin')).toBeVisible();
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'WriteSpace' }));
    await user.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
  });
  it.each(['login', 'register'])('keeps %s storage failures inline without success navigation', async (mode) => {
    const user = userEvent.setup();
    mount(<App />, `/${mode}`);
    if (mode === 'register') await fillForm(user);
    else {
      await user.type(screen.getByLabelText('Username'), 'admin');
      await user.type(screen.getByLabelText('Password'), 'admin');
    }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    await user.click(screen.getByRole('button', { name: mode === 'login' ? 'Login' : 'Create Account', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent(mode === 'login' ? 'Could not save session' : 'Could not save users');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(`/${mode}`);
    expect(getSession()).toBeNull();
  });
  it('links between both auth forms and back to the public root', async () => {
    const user = userEvent.setup();
    mount(<App />, '/login');
    await user.click(screen.getByRole('link', { name: 'Register', exact: true }));
    expect(screen.getByRole('heading', { name: 'Your space starts here.' })).toBeVisible();
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Login', exact: true }));
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'WriteSpace' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
  });
});
