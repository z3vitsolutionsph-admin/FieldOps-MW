import crypto from 'crypto';
import { DocStore } from '../repositories/docStore';
import { AuditLogItem } from '../../src/types/fieldops';
import { AuthUser } from '../auth';

export class AuditService {
  private store: DocStore;

  constructor(store: DocStore) {
    this.store = store;
  }

  async record(
    user: AuthUser,
    action: string,
    targetId: string,
    targetType: string,
    details: string
  ): Promise<AuditLogItem> {
    const entry: AuditLogItem = {
      id: `log_${crypto.randomUUID()}`,
      orgId: user.orgId,
      userId: user.uid,
      userName: user.name,
      action,
      targetId,
      targetType,
      details,
      timestamp: new Date().toISOString(),
    };

    return await this.store.create(user.orgId, 'audit_logs', entry);
  }

  async list(orgId: string): Promise<AuditLogItem[]> {
    return await this.store.list<AuditLogItem>(orgId, 'audit_logs', {
      orderBy: { field: 'timestamp', direction: 'desc' },
      limit: 200,
    });
  }
}
