import type { Firestore } from 'firebase-admin/firestore';
import { DocStore, DocumentExistsError, ListOptions, SupportedCollection } from './docStore';

function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = stripUndefined(value);
    }
  }
  return clean as T;
}

export class FirestoreDocStore implements DocStore {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  private docRef(orgId: string, collection: string, id: string) {
    return this.db.collection('orgs').doc(orgId).collection(collection).doc(id);
  }

  private collRef(orgId: string, collection: string) {
    return this.db.collection('orgs').doc(orgId).collection(collection);
  }

  async get<T = any>(orgId: string, collection: SupportedCollection | string, id: string): Promise<T | null> {
    const snap = await this.docRef(orgId, collection, id).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data() as T;
  }

  async list<T = any>(
    orgId: string,
    collection: SupportedCollection | string,
    options?: ListOptions
  ): Promise<T[]> {
    let query: FirebaseFirestore.Query = this.collRef(orgId, collection);

    if (options?.filters) {
      for (const f of options.filters) {
        query = query.where(f.field, f.op, f.value);
      }
    }

    if (options?.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }

    const limit = Math.min(Math.max(options?.limit ?? 500, 1), 500);
    query = query.limit(limit);

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as T);
  }

  async create<T extends { id: string } = any>(
    orgId: string,
    collection: SupportedCollection | string,
    doc: T
  ): Promise<T> {
    const ref = this.docRef(orgId, collection, doc.id);
    return await this.db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (snap.exists) {
        throw new DocumentExistsError(collection, doc.id);
      }
      const cleaned = stripUndefined(doc);
      t.set(ref, cleaned as any);
      return cleaned;
    });
  }

  async transact<T = any>(
    orgId: string,
    collection: SupportedCollection | string,
    id: string,
    mutate: (current: T | null) => Promise<T> | T
  ): Promise<T> {
    const ref = this.docRef(orgId, collection, id);
    return await this.db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const current = snap.exists ? (snap.data() as T) : null;
      const next = await mutate(current);
      const cleaned = stripUndefined(next);
      t.set(ref, cleaned as any);
      return cleaned;
    });
  }

  async delete(orgId: string, collection: SupportedCollection | string, id: string): Promise<void> {
    await this.docRef(orgId, collection, id).delete();
  }

  async ping(): Promise<boolean> {
    try {
      const pingDocRef = this.db.collection('_health').doc('ping');
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          clearTimeout(timer);
          reject(new Error('Firestore ping timeout (3s)'));
        }, 3000);
      });

      await Promise.race([pingDocRef.get(), timeoutPromise]);
      return true;
    } catch (err: any) {
      console.warn('[Firestore ping probe failed]:', err?.message || err);
      return false;
    }
  }
}
