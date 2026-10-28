/** Manage local demo accounts while keeping protected identities and posts intact. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRow } from '../components/UserRow.jsx';
import { createUser, deleteUser, getAllUsers, getSession, validateUser } from '../utils/auth.js';

const emptyForm = { displayName: '', username: '', password: '', role: '' };
const fields = [
  { key: 'displayName', label: 'Display Name', type: 'text', autocomplete: 'name' },
  { key: 'username', label: 'Username', type: 'text', autocomplete: 'off' },
  { key: 'password', label: 'Password', type: 'password', autocomplete: 'new-password' },
];

/** Render account creation, responsive metadata and confirmed guarded deletion. */
export default function UserManagement() {
  const [users, setUsers] = useState(getAllUsers);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const session = getSession();

  /** Validate fields through the shared rules before calling live-admin creation. */
  function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const nextErrors = validateUser(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      const user = createUser(form);
      setUsers(getAllUsers());
      setForm(emptyForm);
      setSuccess(`Account created for ${user.displayName}.`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  /** Confirm removal, delegating live authorization and protected IDs to deleteUser. */
  function removeUser(user) {
    setError('');
    setSuccess('');
    if (!window.confirm(`Delete account ${user.username}? Their posts will be retained.`)) return;
    try {
      deleteUser(user.id);
      setUsers(getAllUsers());
      setSuccess(`Account ${user.username} deleted. Their posts were retained.`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-4 py-10 text-slate-800">
      <header>
        <Link to="/admin" className="text-sm text-indigo-700 underline focus-visible:ring-2">Back to Dashboard</Link>
        <h1 className="mt-4 font-[Georgia] text-3xl font-bold sm:text-4xl">User Management</h1>
        <p className="mt-3 text-slate-600">Create local accounts and manage access. Deleting an account keeps its posts.</p>
      </header>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Local-only demo. Never use real passwords or sensitive data. Credentials are stored in plaintext in this browser.
      </p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-teal-50 p-4 text-teal-800">{success}</p>}
      <section aria-labelledby="create-user" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 id="create-user" className="font-[Georgia] text-2xl font-bold">Create User</h2>
        <form noValidate onSubmit={submit} className="mt-5 grid gap-5 sm:grid-cols-2">
          {fields.map(({ key, label, type, autocomplete }) => (
            <div key={key}>
              <label htmlFor={`create-${key}`} className="block text-sm font-medium">{label}</label>
              <input
                id={`create-${key}`}
                type={type}
                autoComplete={autocomplete}
                required
                aria-required="true"
                aria-invalid={Boolean(errors[key])}
                aria-describedby={errors[key] ? `error-${key}` : undefined}
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors[key] && <p id={`error-${key}`} role="alert" className="mt-2 text-sm text-red-700">{errors[key]}</p>}
            </div>
          ))}
          <div>
            <label htmlFor="create-role" className="block text-sm font-medium">Role</label>
            <select
              id="create-role"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? 'error-role' : undefined}
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Choose a role</option>
              <option value="admin">Admin</option>
              <option value="user">user</option>
            </select>
            {errors.role && <p id="error-role" role="alert" className="mt-2 text-sm text-red-700">{errors.role}</p>}
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:ring-2"
            >
              Create User
            </button>
          </div>
        </form>
      </section>
      <section aria-labelledby="accounts">
        <h2 id="accounts" className="mb-4 font-[Georgia] text-2xl font-bold">Accounts ({users.length})</h2>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
          <table className="w-full text-left">
            <caption className="sr-only">Local accounts, including the permanent default admin</caption>
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                {['Display name', 'Username', 'Role', 'Created', 'Actions'].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} currentUserId={session?.userId} onDelete={removeUser} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 sm:hidden">
          {users.map((user) => (
            <UserRow key={user.id} user={user} currentUserId={session?.userId} onDelete={removeUser} mobile />
          ))}
        </div>
      </section>
    </main>
  );
}
