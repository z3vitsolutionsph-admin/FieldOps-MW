import { DocStore } from './docStore';
import {
  SEED_WORK_ORDERS,
  SEED_INVENTORY,
  SEED_TICKETS,
  SEED_SITE_A,
  SEED_SITE_B,
  SEED_HOP,
} from '../../src/data/seedData';
import { WorkOrder } from '../../src/types/fieldops';

/**
 * Seeds data into the MEMORY store only.
 * Firestore is NEVER seeded automatically.
 * All records are seeded strictly under their own orgId ('org-crane-ph').
 */
export async function seedMemoryStore(store: DocStore): Promise<void> {
  // 1. Seed Work Orders with version: 1
  for (const wo of SEED_WORK_ORDERS) {
    const orgId = wo.orgId || 'org-crane-ph';
    const seededWo: WorkOrder = {
      ...wo,
      orgId,
      version: 1,
    };
    try {
      await store.create(orgId, 'work_orders', seededWo);
    } catch {
      // Ignore if already loaded
    }
  }

  // 2. Seed Inventory
  for (const item of SEED_INVENTORY) {
    const orgId = item.orgId || 'org-crane-ph';
    try {
      await store.create(orgId, 'inventory', { ...item, orgId });
    } catch {
      // Ignore if already loaded
    }
  }

  // 3. Seed Tickets
  for (const ticket of SEED_TICKETS) {
    const orgId = ticket.orgId || 'org-crane-ph';
    try {
      await store.create(orgId, 'tickets', { ...ticket, orgId });
    } catch {
      // Ignore if already loaded
    }
  }

  // 4. Seed Sites A & B
  for (const site of [SEED_SITE_A, SEED_SITE_B]) {
    const orgId = site.orgId || 'org-crane-ph';
    try {
      await store.create(orgId, 'sites', { ...site, orgId });
    } catch {
      // Ignore if already loaded
    }
  }

  // 5. Seed Hop
  const hopOrgId = SEED_HOP.orgId || 'org-crane-ph';
  try {
    await store.create(hopOrgId, 'hops', { ...SEED_HOP, orgId: hopOrgId });
  } catch {
    // Ignore if already loaded
  }

  console.log('[Seed] In-memory store successfully initialized with enterprise seed data.');
}
