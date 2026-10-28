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
