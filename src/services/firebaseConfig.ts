import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

// The browser only uses Firebase for sign-in. All data reads and writes go through
// the API (/api/*), which authorises each call; Firestore rules deny direct writes.
// (The web API key in the config is a public project identifier, not a secret.)
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfigJson) : getApp();

export const auth: Auth = getAuth(firebaseApp);
