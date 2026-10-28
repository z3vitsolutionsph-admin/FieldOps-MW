import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from './firebaseConfig';
import type { UserProfile } from '../types/fieldops';

/**
 * 'firebase': real accounts; role and org come from server-verified custom claims.
 * 'dev': local demo; the selected seed user is sent as `dev:<id>`, which the server
 * only accepts when it runs with AUTH_MODE=dev (never in production).
 */
export const AUTH_MODE: 'firebase' | 'dev' =
  (import.meta.env.VITE_AUTH_MODE as 'firebase' | 'dev' | undefined) ?? (import.meta.env.DEV ? 'dev' : 'firebase');

const ACTIVE_USER_KEY = 'fieldops_active_user';

function devUserId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile).id : null;
  } catch {
    return null;
  }
}

/** Bearer token for API calls, or null when signed out. */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (AUTH_MODE === 'dev') {
    const id = devUserId();
    return id ? `dev:${id}` : null;
  }
  return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null;
}

export function onFirebaseUserChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUp(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name.trim() });
}

export async function signOut() {
  if (AUTH_MODE === 'firebase') await firebaseSignOut(auth);
  localStorage.removeItem(ACTIVE_USER_KEY);
}

/** Maps Firebase error codes to messages a field user can act on. */
export function describeAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.';
    case 'auth/weak-password':
      return 'Use a password of at least 8 characters.';
    case 'auth/network-request-failed':
      return 'No connection. Sign-in needs network access the first time.';
    default:
      return (err as Error)?.message || 'Sign-in failed.';
  }
}
