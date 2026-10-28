import { HttpError } from '../http';

export type SupportedCollection =
  | 'work_orders'
  | 'inventory'
  | 'tickets'
  | 'photos'
  | 'tssr_approvals'
  | 'audit_logs'
  | 'sites'
  | 'hops';

export interface FilterCondition {
  field: string;
  op: '==' | 'array-contains';
  value: any;
}

export interface ListOptions {
  filters?: FilterCondition[];
  orderBy?: {
    field: string;
    direction?: 'asc' | 'desc';
  };
  limit?: number;
}

export class DocumentExistsError extends HttpError {
  constructor(collection: string, id: string) {
    super(409, `Document with ID '${id}' already exists in collection '${collection}'`, 'DOCUMENT_EXISTS', {
      collection,
      id,
    });
    this.name = 'DocumentExistsError';
  }
}

export interface DocStore {
  get<T = any>(orgId: string, collection: SupportedCollection | string, id: string): Promise<T | null>;
  list<T = any>(
    orgId: string,
    collection: SupportedCollection | string,
    options?: ListOptions
  ): Promise<T[]>;
  create<T extends { id: string } = any>(
    orgId: string,
    collection: SupportedCollection | string,
    doc: T
  ): Promise<T>;
  transact<T = any>(
    orgId: string,
    collection: SupportedCollection | string,
    id: string,
    mutate: (current: T | null) => Promise<T> | T
  ): Promise<T>;
  delete(orgId: string, collection: SupportedCollection | string, id: string): Promise<void>;
  ping(): Promise<boolean>;
}
