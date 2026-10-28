/** Persist plain-text records under the product's browser-local keys. */

/** Check a nonempty string without changing its stored content. */
function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Check an ISO-style timestamp for a usable date. */
function hasDate(value) {
  return hasText(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

/** Validate a post while preserving plain-text content and extra fields. */
function isPost(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && ['id', 'title', 'authorId', 'authorName'].every((key) => hasText(value[key]))
    && typeof value.content === 'string' && hasDate(value.createdAt));
}

/** Validate an account record, including the exact stored role values. */
function isUser(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && ['id', 'displayName', 'username', 'password'].every((key) => hasText(value[key]))
    && ['admin', 'user'].includes(value.role) && hasDate(value.createdAt));
}

/** Read valid records without raising on blocked storage or malformed JSON. */
function readArray(key, validate) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value.filter(validate) : [];
  } catch {
    return [];
  }
}

/** Read the complete collection before mutation; never substitute for unreadable data.
 * Args: key: Browser collection key. validate: Record validator. label: Error context.
 * Returns: All stored records, or an empty array only when the key is absent.
 * Raises: Error for unavailable storage, malformed JSON or any invalid record.
 */
function readMutationArray(key, validate, label) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const records = JSON.parse(raw);
    if (!Array.isArray(records) || !records.every(validate)) throw new Error('Invalid collection');
    return records;
  } catch {
    throw new Error(`Could not read ${label}. Browser storage is unavailable or contains invalid data.`);
  }
}

/** Read complete posts for mutation.
 * Returns: Stored posts, or an empty array for an absent key.
 * Raises: Error rather than discard unreadable or invalid records.
 */
export function getPostsForMutation() {
  return readMutationArray('writespace_posts', isPost, 'posts');
}

/** Read complete accounts for mutation.
 * Returns: Stored accounts, or an empty array for an absent key.
 * Raises: Error rather than discard unreadable or invalid records.
 */
export function getUsersForMutation() {
  return readMutationArray('writespace_users', isUser, 'users');
}

/** Save valid arrays atomically or raise a clear error rather than claim success. */
function saveArray(key, records, validate, label) {
  if (!Array.isArray(records) || !records.every(validate)) {
    throw new Error(`Cannot save ${label}: invalid record shape.`);
  }
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch {
    throw new Error(`Could not save ${label}. Browser storage is unavailable or full.`);
  }
}

/** Return valid stored posts; never raises. @returns {Array<object>} Plain-text posts. */
export function getPosts() {
  return readArray('writespace_posts', isPost);
}

/** Save posts without altering text. @param {Array<object>} records Complete post records. @throws {Error} Invalid data or write failure. */
export function savePosts(records) {
  saveArray('writespace_posts', records, isPost, 'posts');
}

/** Return valid stored accounts, excluding the hard-coded admin; never raises. @returns {Array<object>} Accounts. */
export function getUsers() {
  return readArray('writespace_users', isUser);
}

/** Save accounts. @param {Array<object>} records Complete account records. @throws {Error} Invalid data or write failure. */
export function saveUsers(records) {
  saveArray('writespace_users', records, isUser, 'users');
}
