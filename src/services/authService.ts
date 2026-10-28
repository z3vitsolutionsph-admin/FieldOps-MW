import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

export type AuthMode = 'dev' | 'firebase';

export const AUTH_MODE: AuthMode =
  (import.meta.env.VITE_AUTH_MODE as AuthMode) ||
  (import.meta.env.PROD ? 'firebase' : 'dev');

/**
 * Retrieves the bearer token for API requests.
 * In dev mode: returns "dev:<activeUserId>"
 * In firebase mode: returns auth.currentUser.getIdToken(forceRefresh)
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (AUTH_MODE === 'dev') {
    let activeUserId = 'user-pm-1';
    try {
      const stored = localStorage.getItem('fieldops_active_user');
      if (stored) {
        if (stored.startsWith('{')) {
          const parsed = JSON.parse(stored);
          if (parsed?.id) activeUserId = parsed.id;
        } else {
          activeUserId = stored;
        }
      }
    } catch {
      // Default to user-pm-1
    }
    return `dev:${activeUserId}`;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  return await currentUser.getIdToken(forceRefresh);
}

export async function signIn(email: string, password: string):Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signUp(email: string, password: string, displayName: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onFirebaseUserChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export function describeAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Please wait a few moments before trying again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use at least 8 characters.';
    case 'auth/network-request-failed':
      return 'Network connection failure. Please check your connectivity.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled by an administrator.';
    default:
      return err?.message || 'An unexpected authentication error occurred.';
  }
}
