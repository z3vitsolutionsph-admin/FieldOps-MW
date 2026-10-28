import type { NextFunction, Request, Response } from 'express';
import type { Auth } from 'firebase-admin/auth';
import { z } from 'zod';
import type { UserRole } from '../src/types/fieldops';
import { hasPermission, type Permission } from '../src/services/rbacService';
import { SEED_USERS } from '../src/data/seedData';
import { forbidden, unauthorized } from './http';

export const USER_ROLES = [
  'PROJECT_MANAGER',
  'TEAM_LEADER',
  'ADMIN',
  'REVIEWER',
  'SUPERVISOR',
  'TECHNICIAN',
  'TOWER_CLIMBER',
] as const satisfies readonly UserRole[];

/** The caller's identity. Role and org come from verified token claims, never from the request body. */
export interface AuthUser {
  uid: string;
  name: string;
  email?: string;
  role: UserRole;
  orgId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export type TokenVerifier = (token: string) => Promise<AuthUser>;

const ClaimsSchema = z.object({
  role: z.enum(USER_ROLES),
  orgId: z.string().min(1),
});

/** Verifies Firebase ID tokens. Role/org must be set as custom claims (see scripts/set-user-claims.ts). */
export function firebaseVerifier(auth: Auth): TokenVerifier {
  return async (token) => {
    let decoded;
    try {
      decoded = await auth.verifyIdToken(token, true);
    } catch {
      throw unauthorized('Invalid or expired session. Please sign in again.');
    }
    const claims = ClaimsSchema.safeParse(decoded);
    if (!claims.success) {
      throw forbidden('Your account has not been assigned a role yet. Contact your administrator.');
    }
    return {
      uid: decoded.uid,
      name: (decoded.name as string | undefined) || decoded.email || decoded.uid,
      email: decoded.email,
      role: claims.data.role,
      orgId: claims.data.orgId,
    };
  };
}

/** Local-demo verifier: `Bearer dev:<seedUserId>`. config.ts refuses to enable this in production. */
export function devVerifier(): TokenVerifier {
  return async (token) => {
    if (!token.startsWith('dev:')) throw unauthorized('Expected a dev token (dev:<userId>)');
    const user = SEED_USERS.find((u) => u.id === token.slice(4));
    if (!user) throw unauthorized('Unknown dev user');
    return { uid: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId };
  };
}

export function authenticate(verify: TokenVerifier) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return next(unauthorized());
    verify(match[1].trim())
      .then((user) => {
        req.user = user;
        next();
      })
      .catch(next);
  };
}

export function requireUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(unauthorized());
    if (!permissions.every((p) => hasPermission(user.role, p))) return next(forbidden());
    next();
  };
}
