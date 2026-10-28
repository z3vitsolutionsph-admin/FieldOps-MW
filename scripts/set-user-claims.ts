/**
 * Assigns a role and organisation to a Firebase user (custom claims).
 * The API and Firestore rules read these claims; users cannot set them themselves.
 *
 *   npm run set-claims -- <email> <ROLE> <orgId>
 *   npm run set-claims -- tech@example.com TECHNICIAN org-crane-ph
 *
 * Requires Application Default Credentials with Firebase Auth admin rights
 * (`gcloud auth application-default login`, or GOOGLE_APPLICATION_CREDENTIALS).
 */
import 'dotenv/config';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { USER_ROLES } from '../server/auth';
import { loadConfig } from '../server/config';

const [email, role, orgId] = process.argv.slice(2);

if (!email || !role || !orgId || !(USER_ROLES as readonly string[]).includes(role)) {
  console.error(`Usage: npm run set-claims -- <email> <${USER_ROLES.join('|')}> <orgId>`);
  process.exit(1);
}

const config = loadConfig({ ...process.env, NODE_ENV: 'development' });
const auth = getAuth(initializeApp({ projectId: config.firebaseProjectId }));

const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { role, orgId });
// Force existing sessions to pick up the new claims on their next token refresh.
await auth.revokeRefreshTokens(user.uid);
console.log(`Set ${email} (${user.uid}) → role=${role}, orgId=${orgId}. The user must sign in again.`);
