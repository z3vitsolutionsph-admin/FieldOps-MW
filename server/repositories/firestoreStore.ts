import type { Firestore, Query } from 'firebase-admin/firestore';
import { DocumentExistsError, MAX_LIST_LIMIT, type Collection, type Doc, type DocStore, type ListOptions } from './docStore';

/** Firestore rejects `undefined`; JSON round-tripping drops those keys. */
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class FirestoreDocStore implements DocStore {
  constructor(private readonly db: Firestore) {}

  private col(orgId: string, collection: Collection) {
    return this.db.collection('orgs').doc(orgId).collection(collection);
  }

  async get<T extends Doc>(orgId: string, collection: Collection, id: string) {
    const snap = await this.col(orgId, collection).doc(id).get();
    return snap.exists ? ({ ...snap.data(), id: snap.id } as T) : null;
  }

  async list<T extends Doc>(orgId: string, collection: Collection, options: ListOptions = {}) {
    let q: Query = this.col(orgId, collection);
    for (const f of options.filters ?? []) q = q.where(f.field, f.op, f.value);
    if (options.orderBy) q = q.orderBy(options.orderBy.field, options.orderBy.direction);
    q = q.limit(Math.min(options.limit ?? MAX_LIST_LIMIT, MAX_LIST_LIMIT));
    const snap = await q.get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
  }

  async create<T extends Doc>(orgId: string, collection: Collection, doc: T) {
    try {
      await this.col(orgId, collection).doc(doc.id).create(clean(doc));
    } catch (err: any) {
      // gRPC ALREADY_EXISTS
      if (err?.code === 6) throw new DocumentExistsError(collection, doc.id);
      throw err;
    }
    return doc;
  }

  async transact<T extends Doc>(orgId: string, collection: Collection, id: string, mutate: (c: T | null) => T) {
    const ref = this.col(orgId, collection).doc(id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const next = mutate(snap.exists ? ({ ...snap.data(), id } as T) : null);
      tx.set(ref, clean({ ...next, id }));
      return next;
    });
  }

  async delete(orgId: string, collection: Collection, id: string) {
    const ref = this.col(orgId, collection).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.delete();
    return true;
  }

  async ping() {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.db.collection('_health').doc('ping').get(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Firestore ping timed out')), 3000);
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
