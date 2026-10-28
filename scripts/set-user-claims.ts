import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

const ALLOWED_ROLES = [
  'ADMIN',
  'PROJECT_MANAGER',
  'REVIEWER',
  'SUPERVISOR',
  'TEAM_LEADER',
  'TECHNICIAN',
  'TOWER_CLIMBER',
] as const;

type AllowedRole = (typeof ALLOWED_ROLES)[number];

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: npm run set-claims -- <email> <ROLE> <orgId>');
    console.error(`Allowed roles: ${ALLOWED_ROLES.join(', ')}`);
    console.error('Example: npm run set-claims -- carlos.v@fieldops.ph PROJECT_MANAGER org-crane-ph');
    process.exit(1);
  }

  const [email, roleInput, orgId] = args;
  const role = roleInput.toUpperCase() as AllowedRole;

  if (!ALLOWED_ROLES.includes(role)) {
    console.error(`❌ Invalid role: "${roleInput}". Must be one of: ${ALLOWED_ROLES.join(', ')}`);
    process.exit(1);
  }

  let projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    try {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        projectId = raw.projectId;
      }
    } catch {
      // Ignored
    }
  }

  if (!projectId) {
    console.error('❌ Could not determine Firebase Project ID from environment or firebase-applet-config.json');
    process.exit(1);
  }

  let app: App;
  if (getApps().length === 0) {
    app = initializeApp({ projectId });
  } else {
    app = getApps()[0]!;
  }

  const auth = getAuth(app);

  try {
    console.log(`🔍 Looking up Firebase user for email: ${email}...`);
    const user = await auth.getUserByEmail(email);

    console.log(`👤 Found user: ${user.uid} (${user.displayName || 'No display name'})`);
    console.log(`⚙️  Setting custom claims: { role: "${role}", orgId: "${orgId}" }...`);

    await auth.setCustomUserClaims(user.uid, {
      role,
      orgId,
    });

    console.log(`🔄 Revoking existing refresh tokens to force claim refresh on next token request...`);
    await auth.revokeRefreshTokens(user.uid);

    console.log('====================================================');
    console.log('✅ Custom Claims Successfully Assigned:');
    console.log(`   UID:          ${user.uid}`);
    console.log(`   Email:        ${user.email}`);
    console.log(`   Role:         ${role}`);
    console.log(`   Organization: ${orgId}`);
    console.log('====================================================');
    console.log('User will pick up new claims on their next sign-in or token refresh.');
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      console.error(`❌ User with email "${email}" not found in Firebase Authentication.`);
      console.error('The user must create an account first before claims can be assigned.');
    } else {
      console.error('❌ Error setting user claims:', err.message || err);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
