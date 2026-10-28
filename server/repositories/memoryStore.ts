import { DocStore, DocumentExistsError, ListOptions, SupportedCollection } from './docStore';

export class MemoryDocStore implements DocStore {
  private data = new Map<string, any>();

  private makeKey(orgId: string, collection: string, id: string): string {
    return `${orgId}/${collection}/${id}`;
  }

  async get<T = any>(orgId: string, collection: SupportedCollection | string, id: string): Promise<T | null> {
    const key = this.makeKey(orgId, collection, id);
    const item = this.data.get(key);
    if (!item) {
      return null;
    }
    return structuredClone(item) as T;
  }

  async list<T = any>(
    orgId: string,
    collection: SupportedCollection | string,
    options?: ListOptions
  ): Promise<T[]> {
    const prefix = `${orgId}/${collection}/`;
    let items: any[] = [];

    for (const [key, val] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        items.push(structuredClone(val));
      }
    }

    if (options?.filters) {
      for (const filter of options.filters) {
        items = items.filter((item) => {
          const val = item[filter.field];
          if (filter.op === '==') {
            return val === filter.value;
          }
          if (filter.op === 'array-contains') {
            return Array.isArray(val) && val.includes(filter.value);
          }
          return true;
        });
      }
    }

    if (options?.orderBy) {
      const { field, direction = 'asc' } = options.orderBy;
      items.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        return direction === 'asc' ? 1 : -1;
      });
    }

    const limit = Math.min(Math.max(options?.limit ?? 500, 1), 500);
    return items.slice(0, limit) as T[];
  }

  async create<T extends { id: string } = any>(
    orgId: string,
    collection: SupportedCollection | string,
    doc: T
  ): Promise<T> {
    const key = this.makeKey(orgId, collection, doc.id);
    if (this.data.has(key)) {
      throw new DocumentExistsError(collection, doc.id);
    }
    const cloned = structuredClone(doc);
    this.data.set(key, cloned);
    return structuredClone(cloned);
  }

  async transact<T = any>(
    orgId: string,
    collection: SupportedCollection | string,
    id: string,
    mutate: (current: T | null) => Promise<T> | T
  ): Promise<T> {
    const key = this.makeKey(orgId, collection, id);
    const existing = this.data.get(key);
    const current = existing ? (structuredClone(existing) as T) : null;

    // Mutate runs; if it throws, execution aborts and map is untouched
    const next = await mutate(current);
    const cloned = structuredClone(next);
    this.data.set(key, cloned);
    return structuredClone(cloned);
  }

  async delete(orgId: string, collection: SupportedCollection | string, id: string): Promise<void> {
    const key = this.makeKey(orgId, collection, id);
    this.data.delete(key);
  }

  async ping(): Promise<boolean> {
    return true;
  }
}
