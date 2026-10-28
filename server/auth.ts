import { Request, Response, NextFunction } from 'express';
import type { Auth } from 'firebase-admin/auth';
import { UserRole } from '../src/types/fieldops';
import { SEED_USERS } from '../src/data/seedData';
import { hasPermission, Permission } from '../src/services/rbacService';
import { HttpError, unauthorized, forbidden, asyncHandler } from './http';

export interface AuthUser {
  uid: string;
  name: string;
  email?: string;
  role: UserRole;
  orgId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export type TokenVerifier = (token: string) => Promise<AuthUser>;

export const VALID_ROLES = new Set<UserRole>([
  'ADMIN',
  'PROJECT_MANAGER',
  'REVIEWER',
  'SUPERVISOR',
  'TEAM_LEADER',
  'TECHNICIAN',
  'TOWER_CLIMBER',
]);

/**
 * Verifier using Firebase Admin SDK to decode and verify ID tokens.
 * Role and orgId come strictly from custom claims.
 */
export function createFirebaseVerifier(auth: Auth): TokenVerifier {
  return async (token: string): Promise<AuthUser> => {
    try {
      const decoded = await auth.verifyIdToken(token, true);
      const role = decoded.role as UserRole | undefined;
      const orgId = decoded.orgId as string | undefined;

      if (!role || !VALID_ROLES.has(role) || !orgId) {
        throw forbidden('Your account has not been assigned a role yet', undefined, 'NO_ROLE_ASSIGNED');
      }

      return {
        uid: decoded.uid,
        name: (decoded.name as string) || (decoded.email as string) || 'Firebase User',
        email: decoded.email,
        role,
        orgId,
      };
    } catch (err: any) {
      if (err instanceof HttpError) {
        throw err;
      }
      throw unauthorized('Invalid or expired authentication token', err.message, 'INVALID_TOKEN');
    }
  };
}

/**
 * Dev mode verifier accepting "Bearer dev:<seedUserId>" and resolving from SEED_USERS.
 */
export const devVerifier: TokenVerifier = async (rawToken: string): Promise<AuthUser> => {
  let token = rawToken.trim();
  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }

  if (!token.startsWith('dev:')) {
    if (token === 'dev') {
      token = 'dev:user-pm-1';
    } else {
      throw unauthorized(
        "Invalid dev token format. Expected 'Bearer dev:<seedUserId>'",
        undefined,
        'INVALID_DEV_TOKEN'
      );
    }
  }

  const seedUserId = token.slice(4).trim();
  const normalizedSeed = seedUserId.toLowerCase();

  const user = SEED_USERS.find((u) => {
    const uidLower = u.id.toLowerCase();
    if (uidLower === normalizedSeed) return true;
    // Map aliases like usr-pm-01 -> user-pm-1
    const alt1 = normalizedSeed.replace(/^usr-/, 'user-').replace(/-0(\d)$/, '-$1');
    const alt2 = normalizedSeed.replace(/^user-/, 'usr-').replace(/-(\d)$/, '-0$1');
    return uidLower === alt1 || uidLower === alt2;
  });

  if (!user) {
    throw unauthorized(`Seed user '${seedUserId}' not found in SEED_USERS`, undefined, 'USER_NOT_FOUND');
  }

  return {
    uid: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
  };
};

/**
 * Express middleware to authenticate requests via the Authorization header.
 */
export function createAuthenticate(verifier: TokenVerifier) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw unauthorized(
        'Missing or invalid Authorization header. Expected Bearer <token>',
        undefined,
        'AUTH_REQUIRED'
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw unauthorized('Authorization Bearer token is empty', undefined, 'EMPTY_TOKEN');
    }

    const user = await verifier(token);
    req.user = user;
    next();
  });
}

/**
 * Express middleware to enforce RBAC permissions using src/services/rbacService.ts
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized('Authentication required', undefined, 'AUTH_REQUIRED'));
    }

    for (const perm of permissions) {
      if (!hasPermission(req.user.role, perm)) {
        return next(
          forbidden(
            `Role '${req.user.role}' lacks required permission '${perm}'`,
            {
              requiredPermission: perm,
              userRole: req.user.role,
            },
            'INSUFFICIENT_PERMISSIONS'
          )
        );
      }
    }

    next();
  };
}

/**
 * Express middleware ensuring user has AT LEAST ONE of the specified permissions.
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized('Authentication required', undefined, 'AUTH_REQUIRED'));
    }

    const hasAny = permissions.some((perm) => hasPermission(req.user!.role, perm));
    if (!hasAny) {
      return next(
        forbidden(
          `Role '${req.user.role}' lacks any of the required permissions: ${permissions.join(', ')}`,
          {
            requiredPermissions: permissions,
            userRole: req.user.role,
          },
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
}
