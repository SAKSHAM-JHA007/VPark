// Server-controlled authorization policy.
//
// ADMIN is never granted because of anything a client sends (email, role, flag).
// An account is an administrator only while its *verified* Firebase UID is listed
// in the VPARK_ADMIN_FIREBASE_UIDS server environment variable. The check runs on
// every request, so removing a UID from the allowlist revokes admin access on the
// next request even if the stored account still carries an ADMIN role.

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function parseFirebaseUidAllowlist(raw) {
  const set = new Set();
  if (typeof raw !== 'string') return set;
  for (const part of raw.split(',')) {
    const uid = part.trim();
    if (UID_PATTERN.test(uid)) set.add(uid);
  }
  return set;
}

export function getAdminUidAllowlist(env = process.env) {
  return parseFirebaseUidAllowlist(env.VPARK_ADMIN_FIREBASE_UIDS);
}

export function isAllowlistedAdminUid(uid, allowlist) {
  return typeof uid === 'string' && uid.length > 0 && allowlist.has(uid);
}

/** True only for accounts whose linked, verified Firebase UID is allowlisted. */
export function hasEffectiveAdminAccess(user, allowlist) {
  return Boolean(user) && isAllowlistedAdminUid(user.firebaseUid, allowlist);
}

/**
 * Returns a shallow copy of the stored user whose `roles`/`activeRole` reflect
 * what the account is actually allowed to do right now. Stored ADMIN grants that
 * are not backed by the allowlist are dropped.
 */
export function toEffectiveUser(user, allowlist) {
  if (!user) return null;
  const isAdmin = hasEffectiveAdminAccess(user, allowlist);
  const storedRoles = Array.isArray(user.roles) ? user.roles : [];
  const roles = storedRoles.filter((r) => r !== 'ADMIN' || isAdmin);
  let activeRole = user.activeRole;
  if (!roles.includes(activeRole)) {
    activeRole = roles.includes('DRIVER') ? 'DRIVER' : roles[0] || 'DRIVER';
  }
  return { ...user, roles, activeRole };
}

/** Strip server-only fields before a user object is sent to a browser. */
export function toPublicUser(user) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, firebaseUid, ...rest } = user;
  return rest;
}
