import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { envSchema, Config } from './config';
import { MemoryDocStore } from './repositories/memoryStore';
import { seedMemoryStore } from './repositories/seed';
import { devVerifier } from './auth';
import { AiService, TextModel, GenerateOptions } from './services/aiService';
import { SEED_WORK_ORDERS } from '../src/data/seedData';
import { WorkOrder } from '../src/types/fieldops';

// Test configuration
const testConfig: Config = {
  NODE_ENV: 'test',
  PORT: 3000,
  AUTH_MODE: 'dev',
  DATA_BACKEND: 'memory',
  FIREBASE_PROJECT_ID: 'test-project',
  FIRESTORE_DATABASE_ID: 'test-db',
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-3.8-flash',
  AI_RATE_LIMIT_PER_MIN: 1000,
  API_RATE_LIMIT_PER_MIN: 1000,
};

class MockTextModel implements TextModel {
  public lastOptions: GenerateOptions | null = null;
  public mockResponse = 'Mocked Gemini response';

  async generate(options: GenerateOptions): Promise<string> {
    this.lastOptions = options;
    if (options.jsonMode) {
      return JSON.stringify({
        verified: true,
        score: 98,
        feedback: 'Mocked inspection pass',
        summary: 'Mocked summary',
        punchList: ['Punch 1'],
        parsed: { projectCode: 'PRJ-TEST' },
      });
    }
    return this.mockResponse;
  }
}

describe('FieldOps MW Backend Integration & Security Test Suite', () => {
  let store: MemoryDocStore;
  let mockModel: MockTextModel;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    store = new MemoryDocStore();
    await seedMemoryStore(store);
    mockModel = new MockTextModel();
    const aiService = new AiService(mockModel);

    app = createApp({
      config: testConfig,
      store,
      verifyToken: devVerifier,
      aiService,
    });
  });

  // TEST 1: Production config validation refusals
  it('1. Rejects invalid production configurations at startup schema validation', () => {
    // NODE_ENV=production with AUTH_MODE=dev must fail
    const prodDevAuthResult = envSchema.safeParse({
      NODE_ENV: 'production',
      AUTH_MODE: 'dev',
      DATA_BACKEND: 'firestore',
    });
    expect(prodDevAuthResult.success).toBe(false);

    // NODE_ENV=production with DATA_BACKEND=memory must fail
    const prodMemStoreResult = envSchema.safeParse({
      NODE_ENV: 'production',
      AUTH_MODE: 'firebase',
      DATA_BACKEND: 'memory',
    });
    expect(prodMemStoreResult.success).toBe(false);

    // Valid production configuration passes
    const prodValidResult = envSchema.safeParse({
      NODE_ENV: 'production',
      AUTH_MODE: 'firebase',
      DATA_BACKEND: 'firestore',
    });
    expect(prodValidResult.success).toBe(true);
  });

  // TEST 2: 401 on missing auth token and forged bearer token
  it('2. Returns 401 on missing Authorization header or forged bearer token', async () => {
    // Missing Authorization header
    const noAuthRes = await request(app).get('/api/work-orders');
    expect(noAuthRes.status).toBe(401);
    expect(noAuthRes.body.success).toBe(false);
    expect(noAuthRes.body.code).toBe('AUTH_REQUIRED');

    // Forged or unknown bearer token
    const forgedRes = await request(app)
      .get('/api/work-orders')
      .set('Authorization', 'Bearer dev:unknown-user-999');
    expect(forgedRes.status).toBe(401);
    expect(forgedRes.body.success).toBe(false);
  });

  // TEST 3: Technician role sees only assigned work orders; unassigned returns 404
  it('3. Enforces technician assignment isolation (unassigned job returns 404)', async () => {
    // Seed work orders: wo-crane-001 is assigned to user-tech-1
    // Create an unassigned work order specifically not assigned to user-tech-1
    const unassignedWo: WorkOrder = {
      id: 'wo-unassigned-for-danilo',
      version: 1,
      orgId: 'org-crane-ph',
      workOrderNumber: 'WO-SECRET-001',
      type: 'INSTALLATION',
      siteId: 'NS-TER25-A035',
      siteRole: 'B',
      hopId: 'hop-ter25-01',
      projectId: 'PRJ-TER25-PH',
      regionId: 'MIN',
      scheduledDate: '2026-10-15',
      tssrSnapshotVersion: 'v1.4',
      status: 'ASSIGNED',
      assigneeIds: ['user-climber-1'], // user-tech-1 is NOT an assignee
      currentStepIndex: 0,
      stepsData: {},
      history: [],
    };
    await store.create('org-crane-ph', 'work_orders', unassignedWo);

    // Danilo (technician) requests unassigned work order -> 404
    const res = await request(app)
      .get('/api/work-orders/wo-unassigned-for-danilo')
      .set('Authorization', 'Bearer dev:user-tech-1');

    expect(res.status).toBe(404);

    // Danilo lists work orders -> only assigned ones returned
    const listRes = await request(app)
      .get('/api/work-orders')
      .set('Authorization', 'Bearer dev:user-tech-1');

    expect(listRes.status).toBe(200);
    const wos = listRes.body.data;
    expect(Array.isArray(wos)).toBe(true);
    for (const wo of wos) {
      expect(wo.assigneeIds).toContain('user-tech-1');
    }
  });

  // TEST 4: Creating work order requires CREATE_WORK_ORDER
  it('4. Rejects work order creation without CREATE_WORK_ORDER permission', async () => {
    const payload = {
      workOrderNumber: 'WO-NEW-TEST',
      type: 'INSTALLATION',
      siteId: 'NS-TER25-A035',
    };

    // Danilo (Technician) lacks CREATE_WORK_ORDER -> 403 Forbidden
    const techRes = await request(app)
      .post('/api/work-orders')
      .set('Authorization', 'Bearer dev:user-tech-1')
      .send(payload);
    expect(techRes.status).toBe(403);

    // Project Manager has CREATE_WORK_ORDER -> 201 Created
    const pmRes = await request(app)
      .post('/api/work-orders')
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send(payload);
    expect(pmRes.status).toBe(201);
    expect(pmRes.body.data.workOrderNumber).toBe('WO-NEW-TEST');
  });

  // TEST 5: PATCH rejects updates containing status, orgId, or history
  it('5. Rejects PATCH requests containing status, orgId, or history fields with 400', async () => {
    const woId = SEED_WORK_ORDERS[0].id;

    // Attempting to mutate status via PATCH
    const statusRes = await request(app)
      .patch(`/api/work-orders/${woId}`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ status: 'APPROVED' });
    expect(statusRes.status).toBe(400);

    // Attempting to mutate orgId via PATCH
    const orgRes = await request(app)
      .patch(`/api/work-orders/${woId}`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ orgId: 'org-malicious' });
    expect(orgRes.status).toBe(400);

    // Attempting to overwrite history via PATCH
    const historyRes = await request(app)
      .patch(`/api/work-orders/${woId}`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ history: [] });
    expect(historyRes.status).toBe(400);
  });

  // TEST 6: Reassigning assigneeIds restricted to Project Manager / Admin
  it('6. Restricts reassigning assigneeIds to Project Manager / Admin', async () => {
    const woId = SEED_WORK_ORDERS[0].id;

    // Technician attempting to reassign -> 403
    const techRes = await request(app)
      .patch(`/api/work-orders/${woId}`)
      .set('Authorization', 'Bearer dev:user-tech-1')
      .send({ assigneeIds: ['user-climber-1'] });
    expect(techRes.status).toBe(403);

    // Project Manager attempting to reassign -> 200 OK
    const pmRes = await request(app)
      .patch(`/api/work-orders/${woId}`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ assigneeIds: ['user-climber-1', 'user-tech-1'] });
    expect(pmRes.status).toBe(200);
    expect(pmRes.body.data.assigneeIds).toEqual(['user-climber-1', 'user-tech-1']);
  });

  // TEST 7: Concurrency conflict: stale expectedVersion returns 409
  it('7. Detects concurrency conflicts and returns 409 when expectedVersion is stale', async () => {
    const woId = SEED_WORK_ORDERS[0].id;

    const conflictRes = await request(app)
      .patch(`/api/work-orders/${woId}`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({
        expectedVersion: 9999, // stale version
        reviewerRemarks: 'Reviewed',
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.code).toBe('CONFLICT');
  });

  // TEST 8: State machine: role in body returns 400; technician cannot transition to APPROVED
  it('8. Rejects role parameter in transition body (400) and prevents unauthorized transitions (403)', async () => {
    const woId = SEED_WORK_ORDERS[0].id;

    // Rejects body containing 'role'
    const roleInBodyRes = await request(app)
      .post(`/api/work-orders/${woId}/transition`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({
        role: 'ADMIN',
        newStatus: 'PENDING_REVIEW',
      });
    expect(roleInBodyRes.status).toBe(400);

    // Create a work order in PENDING_REVIEW state
    const pendingWo: WorkOrder = {
      id: 'wo-pending-review-test',
      version: 1,
      orgId: 'org-crane-ph',
      workOrderNumber: 'WO-PENDING-01',
      type: 'INSTALLATION',
      siteId: 'NS-TER25-A035',
      siteRole: 'B',
      hopId: 'hop-ter25-01',
      projectId: 'PRJ-TER25-PH',
      regionId: 'MIN',
      scheduledDate: '2026-10-15',
      tssrSnapshotVersion: 'v1.4',
      status: 'PENDING_REVIEW',
      assigneeIds: ['user-tech-1'],
      currentStepIndex: 5,
      stepsData: {},
      history: [],
    };
    await store.create('org-crane-ph', 'work_orders', pendingWo);

    // Technician cannot transition from PENDING_REVIEW to APPROVED (requires APPROVE_WORK_ORDER) -> 403
    const techApproveRes = await request(app)
      .post(`/api/work-orders/${pendingWo.id}/transition`)
      .set('Authorization', 'Bearer dev:user-tech-1')
      .send({
        newStatus: 'APPROVED',
      });
    expect(techApproveRes.status).toBe(403);
  });

  // TEST 9: Happy path state progression; mutation locks on APPROVED/CLOSED records
  it('9. Enforces state machine progression and locks mutations on APPROVED/CLOSED records', async () => {
    // Create new fresh DRAFT work order
    const createRes = await request(app)
      .post('/api/work-orders')
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({
        workOrderNumber: 'WO-PROGRESSION-TEST',
        type: 'INSTALLATION',
        siteId: 'NS-TER25-A035',
      });
    const wo = createRes.body.data;
    expect(wo.status).toBe('DRAFT');

    // DRAFT -> ASSIGNED (PM)
    const assignRes = await request(app)
      .post(`/api/work-orders/${wo.id}/transition`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ newStatus: 'ASSIGNED' });
    expect(assignRes.status).toBe(200);

    // ASSIGNED -> IN_PROGRESS (PM)
    const startRes = await request(app)
      .post(`/api/work-orders/${wo.id}/transition`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ newStatus: 'IN_PROGRESS' });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.startedAt).toBeDefined();

    // IN_PROGRESS -> PENDING_REVIEW (PM)
    const reviewRes = await request(app)
      .post(`/api/work-orders/${wo.id}/transition`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ newStatus: 'PENDING_REVIEW' });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.completedAt).toBeDefined();

    // PENDING_REVIEW -> APPROVED (Reviewer or Admin)
    const approveRes = await request(app)
      .post(`/api/work-orders/${wo.id}/transition`)
      .set('Authorization', 'Bearer dev:user-admin-1')
      .send({ newStatus: 'APPROVED' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.approvedAt).toBeDefined();

    // Mutation lock: PATCH on APPROVED record returns 422
    const patchLockedRes = await request(app)
      .patch(`/api/work-orders/${wo.id}`)
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ currentStepIndex: 5 });
    expect(patchLockedRes.status).toBe(422);
  });

  // TEST 10: Batch sync returns granular per-mutation APPLIED / REJECTED results
  it('10. Sync gateway returns granular per-mutation APPLIED / REJECTED results', async () => {
    const wo = SEED_WORK_ORDERS[0];

    const mutations = [
      {
        id: 'mut-valid-patch',
        collectionName: 'work_orders',
        entityId: wo.id,
        operation: 'UPDATE',
        payload: { currentStepIndex: 3 },
      },
      {
        id: 'mut-invalid-collection',
        collectionName: 'non_existent_collection',
        entityId: 'some-id',
        operation: 'CREATE',
        payload: {},
      },
    ];

    const res = await request(app)
      .post('/api/sync/batch')
      .set('Authorization', 'Bearer dev:user-pm-1')
      .send({ mutations });

    expect(res.status).toBe(200);
    const results = res.body.data.results;
    expect(results).toHaveLength(2);

    const validRes = results.find((r: any) => r.id === 'mut-valid-patch');
    expect(validRes.status).toBe('APPLIED');

    const invalidRes = results.find((r: any) => r.id === 'mut-invalid-collection');
    expect(invalidRes.status).toBe('REJECTED');
  });

  // TEST 11: Batch sync audit entries stamp caller's verified identity
  it('11. Batch sync audit entries stamp the caller verified identity', async () => {
    const wo = SEED_WORK_ORDERS[0];
    const mutationId = 'mut-audit-stamp-test';

    await request(app)
      .post('/api/sync/batch')
      .set('Authorization', 'Bearer dev:user-tech-1')
      .send({
        mutations: [
          {
            id: mutationId,
            collectionName: 'work_orders',
            entityId: wo.id,
            operation: 'UPDATE',
            payload: { currentStepIndex: 2 },
          },
        ],
      });

    // Check audit logs
    const auditRes = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', 'Bearer dev:user-pm-1');

    expect(auditRes.status).toBe(200);
    const logs = auditRes.body.data;
    const syncLog = logs.find((l: any) => l.action === 'CLOUD_BATCH_SYNC');
    expect(syncLog).toBeDefined();
    expect(syncLog.userId).toBe('user-tech-1');
    expect(syncLog.userName).toBe('Danilo Reyes');
  });

  // TEST 12: Photo upload payload size checks reject items exceeding limit
  it('12. Inspect-photo rejects payloads exceeding size limit with 400', async () => {
    // Generate an imageBase64 string > 6,000,000 characters
    const hugeImageBase64 = 'A'.repeat(6000005);

    const res = await request(app)
      .post('/api/ai/inspect-photo')
      .set('Authorization', 'Bearer dev:user-tech-1')
      .send({
        photoTitle: 'Huge Test Photo',
        imageBase64: hugeImageBase64,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // TEST 13: Cross-tenant isolation: requesting entity belonging to another org returns 404
  it('13. Enforces strict multi-tenant isolation across organizations (404)', async () => {
    // Seed an entity under a foreign organization
    const foreignSite = {
      id: 'site-foreign-001',
      orgId: 'org-foreign-tenant',
      name: 'Foreign Secret Site',
      role: 'A',
    };
    await store.create('org-foreign-tenant', 'sites', foreignSite);

    // User belonging to org-crane-ph tries to get it -> 404
    const res = await request(app)
      .get('/api/sites/site-foreign-001')
      .set('Authorization', 'Bearer dev:user-pm-1'); // org-crane-ph

    expect(res.status).toBe(404);
  });

  // TEST 14: AI proxy limits input to 2000 chars (400), isolates delimiters, and returns 503 if unconfigured
  it('14. AI proxy limits input, isolates delimiters, and handles unconfigured model (503)', async () => {
    // 1. Query exceeding 2000 characters returns 400
    const longQuery = 'A'.repeat(2001);
    const longRes = await request(app)
      .post('/api/ai/ask')
      .set('Authorization', 'Bearer dev:user-tech-1')
      .send({ query: longQuery });
    expect(longRes.status).toBe(400);

    // 2. Normal query sent to model wraps untrusted input in <user_input>
    const validQuery = 'What is the torque for M12 U-bolt?';
    const askRes = await request(app)
      .post('/api/ai/ask')
      .set('Authorization', 'Bearer dev:user-tech-1')
      .send({ query: validQuery });
    expect(askRes.status).toBe(200);
    expect(mockModel.lastOptions?.prompt).toContain(`<user_input>${validQuery}</user_input>`);

    // 3. Unconfigured AI model returns 503
    const appWithoutAi = createApp({
      config: testConfig,
      store,
      verifyToken: devVerifier,
      aiService: new AiService(null), // null model
    });

    const unconfiguredRes = await request(appWithoutAi)
      .post('/api/ai/ask')
      .set('Authorization', 'Bearer dev:user-tech-1')
      .send({ query: 'Hello?' });

    expect(unconfiguredRes.status).toBe(503);
    expect(unconfiguredRes.body.code).toBe('AI_UNAVAILABLE');
  });
});
