import {
  SEED_HOP,
  SEED_INVENTORY,
  SEED_SITE_A,
  SEED_SITE_B,
  SEED_TICKETS,
  SEED_WORK_ORDERS,
} from '../../src/data/seedData';
import type { Collection, Doc, DocStore } from './docStore';

/** Loads the demo dataset. Used for the in-memory backend only — never against Firestore implicitly. */
export async function seedDemoData(store: DocStore) {
  const put = async (collection: Collection, docs: Array<{ id: string; orgId: string }>) => {
    for (const d of docs) await store.transact(d.orgId, collection, d.id, () => d as unknown as Doc);
  };
  await put('work_orders', SEED_WORK_ORDERS.map((w) => ({ ...w, version: w.version ?? 1 })));
  await put('inventory', SEED_INVENTORY);
  await put('tickets', SEED_TICKETS);
  await put('sites', [SEED_SITE_A, SEED_SITE_B]);
  await put('hops', [SEED_HOP]);
}
