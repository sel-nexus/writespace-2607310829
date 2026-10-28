/** Read local publications and enforce live ownership before deletion. */
import { getPosts, savePosts } from './storage.js';
import { getSession } from './auth.js';

/** Return valid posts newest first without changing persisted order.
 * Returns: A newly read, sorted post array; storage failures become empty.
 * @returns {Array<object>}
 */
export function sortedPosts() {
  return getPosts().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Find an exact local post identity, rejecting blank and nonstring IDs.
 * Args: id (string): Stored identity, not a URL or array index.
 * Returns: Current post or null; never raises.
 * @param {string} id
 * @returns {object|null}
 */
export function getPost(id) {
  if (typeof id !== 'string' || !id.trim()) return null;
  return getPosts().find((post) => post.id === id) || null;
}

/** Format a publication date consistently in UTC.
 * Args: value (string): Stored ISO timestamp.
 * Returns: MMM DD, YYYY, or Unknown date for unusable input.
 * @param {string} value
 * @returns {string}
 */
export function formatDate(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

/** Determine display eligibility; mutations must independently re-read identity.
 * Args: post (object): Publication with authorId. session (object|null): Display session.
 * Returns: Whether an admin or the owning member may manage this post.
 * @param {object|null} post
 * @param {object|null} session
 * @returns {boolean}
 */
export function canManagePost(post, session = getSession()) {
  return Boolean(post && typeof post.authorId === 'string' && session?.userId
    && (session.role === 'admin' || (session.role === 'user' && post.authorId === session.userId)));
}

/** Delete only after reading the live session and current stored ownership.
 * Args: id (string): Exact publication identity.
 * Returns: Remaining persisted posts.
 * Raises: Error for missing identity, lost session, forbidden ownership or failed storage.
 * @param {string} id
 * @returns {Array<object>}
 */
export function deletePost(id) {
  const session = getSession();
  if (!session) throw new Error('Please log in before deleting a post.');
  const posts = getPosts();
  const matches = posts.filter((post) => post.id === id);
  if (typeof id !== 'string' || !id.trim() || !matches.length) throw new Error('Post not found.');
  if (!matches.every((post) => canManagePost(post, session))) {
    throw new Error('You can only delete your own posts.');
  }
  const remaining = posts.filter((post) => post.id !== id);
  savePosts(remaining);
  return remaining;
}

/** Validate required plain-text fields without normalizing intentional whitespace.
 * Args: fields (object): Untrusted title and content input.
 * Returns: Field error map; an empty map means valid.
 * @param {object} fields
 * @returns {object}
 */
export function validatePost(fields = {}) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) fields = {};
  const errors = {};
  for (const key of ['title', 'content']) {
    if (typeof fields[key] !== 'string' || !fields[key].trim()) {
      errors[key] = `${key === 'title' ? 'Title' : 'Content'} is required.`;
    }
  }
  return errors;
}

/** Create a publication with generated identity and live session authorship.
 * Args: fields (object): Title and content only; supplied metadata is ignored.
 * Returns: Persisted post, ready for reader navigation.
 * Raises: Error for absent session, invalid fields or persistence failure.
 * @param {object} fields
 * @returns {object}
 */
export function createPost(fields) {
  const session = getSession();
  if (!session) throw new Error('Please log in before publishing a post.');
  const errors = validatePost(fields);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const post = {
    id: crypto.randomUUID(), title: fields.title.trim(), content: fields.content,
    createdAt: new Date().toISOString(), authorId: session.userId, authorName: session.displayName,
  };
  savePosts([...getPosts(), post]);
  return post;
}

/** Re-read ownership and save editable text without replacing stored metadata.
 * Args: id (string): Exact identity. fields (object): Title and content input.
 * Returns: Persisted updated post.
 * Raises: Error for lost session, missing post, forbidden ownership, invalid fields or storage failure.
 * @param {string} id
 * @param {object} fields
 * @returns {object}
 */
export function updatePost(id, fields) {
  const session = getSession();
  if (!session) throw new Error('Please log in before editing a post.');
  const posts = getPosts();
  const matches = posts.filter((post) => post.id === id);
  if (typeof id !== 'string' || !id.trim() || !matches.length) throw new Error('Post not found.');
  if (!matches.every((post) => canManagePost(post, session))) {
    throw new Error('You can only edit your own posts.');
  }
  const errors = validatePost(fields);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const updated = posts.map((post) => post.id === id
    ? { ...post, title: fields.title.trim(), content: fields.content } : post);
  savePosts(updated);
  return updated.find((post) => post.id === id);
}

