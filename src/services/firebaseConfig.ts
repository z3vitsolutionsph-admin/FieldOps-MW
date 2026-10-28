import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Initialize Firebase App
export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfigJson) : getApp();

// Initialize Firebase Auth strictly (Firestore is accessed solely via backend APIs)
export const auth: Auth = getAuth(firebaseApp);
