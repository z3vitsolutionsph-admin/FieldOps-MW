import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Initialize Firebase App
export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfigJson) : getApp();

// Initialize Firestore with specific database ID if provided in config
export const db: Firestore = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(firebaseApp, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Initialize Firebase Auth
export const auth: Auth = getAuth(firebaseApp);

/**
 * Validates connection to Firestore backend per Firebase Integration guidelines.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is currently offline or network unavailable.');
      return false;
    }
    // Document might not exist which is fine for connection test
    return true;
  }
}
