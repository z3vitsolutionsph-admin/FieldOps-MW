import { DocumentExistsError, MAX_LIST_LIMIT, type Collection, type Doc, type DocStore, type ListOptions } from './docStore';

const clone = <T>(v: T): T => structuredClone(v);

/** Process-local store for development and tests. Not shared across instances; lost on restart. */
export class MemoryDocStore implements DocStore {
  private data = new Map<string, Map<string, Doc>>();

  private bucket(orgId: string, collection: Collection) {
    const key = `${orgId}/${collection}`;
    let b = this.data.get(key);
    if (!b) {
      b = new Map();
      this.data.set(key, b);
    }
    return b;
  }

  async get<T extends Doc>(orgId: string, collection: Collection, id: string) {
    const doc = this.bucket(orgId, collection).get(id);
    return doc ? (clone(doc) as T) : null;
  }

  async list<T extends Doc>(orgId: string, collection: Collection, options: ListOptions = {}) {
    let docs = [...this.bucket(orgId, collection).values()];
    for (const f of options.filters ?? []) {
      docs = docs.filter((d) => {
        const v = d[f.field];
        return f.op === '==' ? v === f.value : Array.isArray(v) && v.includes(f.value);
      });
    }
    if (options.orderBy) {
      const { field, direction } = options.orderBy;
      const sign = direction === 'asc' ? 1 : -1;
      docs.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * sign);
    }
    return docs.slice(0, Math.min(options.limit ?? MAX_LIST_LIMIT, MAX_LIST_LIMIT)).map((d) => clone(d) as T);
  }

  async create<T extends Doc>(orgId: string, collection: Collection, doc: T) {
    const b = this.bucket(orgId, collection);
    if (b.has(doc.id)) throw new DocumentExistsError(collection, doc.id);
    b.set(doc.id, clone(doc));
    return clone(doc);
  }

  async transact<T extends Doc>(orgId: string, collection: Collection, id: string, mutate: (c: T | null) => T) {
    const b = this.bucket(orgId, collection);
    const current = b.get(id);
    // Single-threaded event loop: no interleaving between this read and write.
    const next = mutate(current ? (clone(current) as T) : null);
    b.set(id, clone({ ...next, id }));
    return clone(next);
  }

  async delete(orgId: string, collection: Collection, id: string) {
    return this.bucket(orgId, collection).delete(id);
  }

  async ping() {
    return true;
  }
}
