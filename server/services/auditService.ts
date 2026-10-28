import { randomUUID } from 'node:crypto';
import type { AuditLogItem } from '../../src/types/fieldops';
import type { AuthUser } from '../auth';
import type { DocStore } from '../repositories/docStore';

/** Append-only audit trail. Actor fields always come from the verified caller. */
export class AuditService {
  constructor(private readonly store: DocStore) {}

  async record(user: AuthUser, action: string, targetType: string, targetId: string, details: string) {
    const entry: AuditLogItem = {
      id: `log_${randomUUID()}`,
      orgId: user.orgId,
      userId: user.uid,
      userName: user.name,
      action,
      targetType,
      targetId,
      details: details.slice(0, 2000),
      timestamp: new Date().toISOString(),
    };
    await this.store.create(user.orgId, 'audit_logs', entry as AuditLogItem & Record<string, unknown>);
    return entry;
  }

  list(user: AuthUser, limit = 200) {
    return this.store.list<AuditLogItem & Record<string, unknown>>(user.orgId, 'audit_logs', {
      orderBy: { field: 'timestamp', direction: 'desc' },
      limit,
    });
  }
}
