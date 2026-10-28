/**
 * Tenant-scoped document storage. Every document lives under its organisation
 * (Firestore path: orgs/{orgId}/{collection}/{id}), so a caller can only ever
 * reach data in the org carried by their verified token.
 */
export type Collection =
  | 'work_orders'
  | 'inventory'
  | 'tickets'
  | 'photos'
  | 'tssr_approvals'
  | 'audit_logs'
  | 'sites'
  | 'hops';

export interface Filter {
  field: string;
  op: '==' | 'array-contains';
  value: string | number | boolean;
}

export interface ListOptions {
  filters?: Filter[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

export type Doc = Record<string, unknown> & { id: string };

export interface DocStore {
  get<T extends Doc>(orgId: string, collection: Collection, id: string): Promise<T | null>;
  list<T extends Doc>(orgId: string, collection: Collection, options?: ListOptions): Promise<T[]>;
  /** Fails with DocumentExistsError if the id is taken. */
  create<T extends Doc>(orgId: string, collection: Collection, doc: T): Promise<T>;
  /**
   * Read-modify-write in one transaction. `mutate` receives the current document
   * (or null) and returns the replacement; throwing aborts without writing.
   */
  transact<T extends Doc>(
    orgId: string,
    collection: Collection,
    id: string,
    mutate: (current: T | null) => T
  ): Promise<T>;
  delete(orgId: string, collection: Collection, id: string): Promise<boolean>;
  /** True only if the backing store answered a real round trip. */
  ping(): Promise<boolean>;
}

export class DocumentExistsError extends Error {
  constructor(collection: string, id: string) {
    super(`${collection}/${id} already exists`);
  }
}

export const MAX_LIST_LIMIT = 500;
