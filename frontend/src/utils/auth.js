/** Enforce local account rules and validate sessions against current accounts. */
import { getUsers, saveUsers } from './storage.js';

export const DEFAULT_ADMIN = Object.freeze({
  id: 'admin', displayName: 'Admin', username: 'admin', password: 'admin',
  role: 'admin', createdAt: '2024-01-01T00:00:00.000Z',
});

/** Normalize username comparisons without changing password semantics. */
function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Return the permanent admin plus stored accounts, ignoring reserved collisions.
 * Returns: Current local accounts, including the permanent default admin.
 * @returns {Array<object>}
 */
export function getAllUsers() {
  return [DEFAULT_ADMIN, ...getUsers().filter((user) => user.id !== 'admin' && normalize(user.username) !== 'admin')];
}

/** Project an account into the password-free session schema. */
function sessionFor(user) {
  return { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

/** Match all session fields to a live account; never trust a stored role alone. */
function validAccount(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  return getAllUsers().find((user) => user.id === session.userId
    && user.username === session.username && user.displayName === session.displayName
    && user.role === session.role) || null;
}

/** Read a validated session, failing closed on corruption or removed accounts.
 * Returns: Password-free session or null; never raises.
 * @returns {object|null}
 */
export function getSession() {
  try {
    const account = validAccount(JSON.parse(localStorage.getItem('writespace_session')));
    return account ? sessionFor(account) : null;
  } catch {
    return null;
  }
}

/** Persist only a session matching an existing account.
 * Args: session (object): userId, username, displayName and role.
 * Returns: Canonical password-free session.
 * Raises: Error on invalid identity or failed persistence.
 * @param {object} session
 * @returns {object}
 */
export function setSession(session) {
  const account = validAccount(session);
  if (!account) throw new Error('Cannot save session: account is invalid or no longer exists.');
  const canonical = sessionFor(account);
  try {
    localStorage.setItem('writespace_session', JSON.stringify(canonical));
  } catch {
    throw new Error('Could not save session. Browser storage is unavailable or full.');
  }
  return canonical;
}

/** Remove the persisted session; idempotent when absent.
 * Raises: Error if browser storage prevents logout.
 */
export function clearSession() {
  try {
    localStorage.removeItem('writespace_session');
  } catch {
    throw new Error('Could not log out. Browser storage is unavailable.');
  }
}

/** Return the role-specific start route. @param {object|null} session @returns {string} */
export function getRoleHome(session) {
  return session?.role === 'admin' ? '/admin' : '/blogs';
}

/** Authenticate permanent admin first, then stored accounts, and persist a session.
 * Args: username (string): Case-insensitive trimmed handle. password (string): Exact credential.
 * Returns: Password-free persisted session.
 * Raises: Error for invalid credentials or storage failure.
 * @param {string} username
 * @param {string} password
 * @returns {object}
 */
export function login(username, password) {
  const account = getAllUsers().find((user) => normalize(user.username) === normalize(username) && user.password === password);
  if (!account) throw new Error('Invalid username or password.');
  return setSession(sessionFor(account));
}

/** Validate account input and return field-specific errors for forms.
 * Args: fields (object): displayName, username, password, role and optional confirmPassword.
 * Returns: Error map keyed by field; empty means valid.
 * @param {object} fields
 * @returns {object}
 */
export function validateUser(fields = {}) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) fields = {};
  const errors = {};
  for (const key of ['displayName', 'username', 'password']) {
    if (typeof fields[key] !== 'string' || !fields[key].trim()) {
      errors[key] = `${{ displayName: 'Display name', username: 'Username', password: 'Password' }[key]} is required.`;
    }
  }
  if (!errors.username && getAllUsers().some((user) => normalize(user.username) === normalize(fields.username))) {
    errors.username = 'Username is already taken.';
  }
  if (!['admin', 'user'].includes(fields.role)) errors.role = 'Choose Admin or user.';
  if (Object.hasOwn(fields, 'confirmPassword')) {
    if (typeof fields.confirmPassword !== 'string' || !fields.confirmPassword.trim()) {
      errors.confirmPassword = 'Confirm password is required.';
    } else if (fields.password !== fields.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
  }
  return errors;
}

/** Create a validated UUID account without signing it in; admins alone choose roles.
 * Args: fields (object): displayName, username, password and role. Requires a live admin session.
 * Returns: Newly persisted account, including plaintext demo password.
 * Raises: Error for authorization, validation or storage failures.
 * @param {object} fields
 * @returns {object}
 */
export function createUser(fields) {
  if (getSession()?.role !== 'admin') throw new Error('Admin access is required.');
  return persistUser(fields);
}

/** Save a validated account used by admin creation and self-registration. */
function persistUser(fields) {
  const errors = validateUser(fields);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const account = {
    id: crypto.randomUUID(), displayName: fields.displayName.trim(), username: fields.username.trim(),
    password: fields.password, role: fields.role, createdAt: new Date().toISOString(),
  };
  saveUsers([...getUsers(), account]);
  return account;
}

/** Register an ordinary member and persist their session; role input is ignored.
 * Args: fields (object): displayName, username, password, confirmPassword.
 * Returns: Persisted session after successful account creation.
 * Raises: Error for validation or persistence failure; account may persist if session save fails.
 * @param {object} fields
 * @returns {object}
 */
export function register(fields) {
  const input = { ...fields, role: 'user', confirmPassword: fields?.confirmPassword };
  const account = persistUser(input);
  return setSession(sessionFor(account));
}

/** Delete another local account while preserving its posts and permanent admin.
 * Args: userId (string): Account identity to remove. Requires a current admin session.
 * Returns: Remaining stored accounts.
 * Raises: Error for forbidden, missing account or failed write.
 * @param {string} userId
 * @returns {Array<object>}
 */
export function deleteUser(userId) {
  const session = getSession();
  if (session?.role !== 'admin') throw new Error('Admin access is required.');
  if (userId === DEFAULT_ADMIN.id) throw new Error('Default admin cannot be deleted.');
  if (userId === session.userId) throw new Error('You cannot delete your current account.');
  const users = getUsers();
  if (!users.some((user) => user.id === userId)) throw new Error('User not found.');
  const remaining = users.filter((user) => user.id !== userId);
  saveUsers(remaining);
  return remaining;
}
