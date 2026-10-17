# Implementation Plan: FieldOps MW Enterprise Platform

## 1. Executive Summary & Product Vision

### 1.1 Overview & Core Value Proposition
**FieldOps MW** is an enterprise-grade, mobile-first, offline-resilient Progressive Web Application (PWA) engineered specifically for telecommunications microwave transmission engineers, tower riggers, supervisors, and network operations center (NOC) reviewers. 

The application streamlines the complete lifecycle of microwave link deployments:
1. **Pre-Climb Safety Governance**: Mandatory PPE and environmental hazard clearance with digital signatures before ascending tower structures.
2. **Interactive Multi-Step Installation & Dismantling Wizards**: Step-by-step guidance covering Site A and Site B alignment, azimuth/elevation calculations, cabling, grounding, and weatherproofing.
3. **Real-Time Mobile Device Sensor Alignment Tool**: Hardware-integrated compass azimuth and inclinometer tilt tracking for rapid line-of-sight antenna positioning.
4. **Offline-First Zero-Packet-Drop Persistence**: Two-way replication bridge combining device-local Dexie.js IndexedDB with an Express gateway on Node.js 22 and Google Cloud Firestore master storage.
5. **Telecom Technical Site Survey Report (TSSR) & Automated QA**: Photographic evidence capture with HUD geo-watermarking, AI-assisted quality inspection, and 3-gate engineering sign-offs.

### 1.2 Target Personas & RBAC Authorization
- **Tower Climber**: Authorized for high-altitude rigging, physical antenna bracket mounting, waveguide torque verification, and pre-climb checklists. Blocked from engineering TSSR approvals.
- **Field Technician**: Ground shelter equipment installation, IDU/ODU rack mounting, -48V DC power rectifiers, battery discharge testing, and BER measurements.
- **Supervisor**: On-site safety oversight, high-risk climb approvals, and severe weather clearance overrides.
- **Reviewer / Project Manager**: Technical QA verification, link budget margin audits (-27.2 dBm target RSL), and formal TSSR gate sign-offs.
- **Administrator**: Global system configuration, RBAC privilege overrides, and cloud replication management.

---

## 2. UX Architecture & Spatial Design

### 2.1 Ergonomic Mobile-First & Touch Guidelines
Field operations frequently occur under harsh environmental conditions: direct sunlight at 45-meter tower heights, wind gusts, and single-handed gloved touch operation.

- **Thumb-Zone Distribution**:
  - **Natural Reach Zone (Bottom 40%)**: Primary navigation tabs (Jobs, Install, Dismantle, Troubleshoot, TSSR, Dashboard), next/previous wizard step controls, and photo capture triggers.
  - **Stretch Zone (Middle 30%)**: Scrollable step checklists, azimuth/elevation dial feedback, and battery discharge telemetry curves.
  - **Hard Reach Zone (Top 30%)**: Site identifiers, GPS coordinates, weather safety warnings, and network mode switches.
- **Touch Target Thresholds**: All interactive buttons, checklist rows, and tabs enforce a minimum hitbox of $44 \times 44\text{px}$ (primary actions $48 \times 48\text{px}$).
- **High-Contrast Sunlight Mode**: One-touch toggle between high-contrast daylight palette (deep amber borders, black text on ultra-high contrast ivory backing) and dark tactical slate mode for shelter interiors.
- **Zero-Pill Visual Discipline**: Metadata (frequencies, signal levels, timestamps, tags) rendered as clean typography with subtle dot separators (`·`) rather than ornamental badges.

---

## 3. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FIELD TECHNICIAN MOBILE DEVICE (PWA)                 │
│                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │ Mobile Device Sensors   │  │   Offline UI & Reactive State       │  │
│  │ • HTML5 Geolocation API │  │   • Installation & TSSR Wizards     │  │
│  │ • DeviceOrientation API │  │   • Camera Watermark HUD            │  │
│  │ • Compass Azimuth & Tilt│  │   • Pre-Climb Safety Check Modal    │  │
│  └────────────┬────────────┘  └──────────────────┬──────────────────┘  │
│               │                                  │                     │
│               ▼                                  ▼                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │         Dexie.js IndexedDB 4.x Local Edge Storage Layer          │  │
│  │  • workOrders  • photos  • inventory  • tickets  • syncQueue     │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
                   HTTPS / JSON Batch │ (Online Auto-Replication)
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 EXPRESS GATEWAY TIER (server.ts)                       │
│                   Node.js 22 Runtime on Port 3000                      │
│                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │ RESTful API Gateway     │  │ In-Memory Telemetry Cache           │  │
│  │ • /api/work-orders      │  │ • 24h Battery Discharge Curves      │  │
│  │ • /api/sites & /hops    │  │ • System Metrics & Latency          │  │
│  │ • /api/inventory/verify │  │ • Audit Trail (Append-Only Log)     │  │
│  │ • /api/sync/batch       │  │ • State Machine Validator           │  │
│  └────────────┬────────────┘  └─────────────────────────────────────┘  │
│               │                                                        │
│               ├─────────────────────────────────┐                      │
│               ▼                                 ▼                      │
│  ┌─────────────────────────┐      ┌─────────────────────────────────┐  │
│  │ Server-Side Key Vault   │      │ Firestore Admin Client          │  │
│  │ Proxy: /api/ai/ask      │      │ • Batch Transaction Commit      │  │
│  │ • Gemini 3.8 Flash      │      │ • Error Diagnostic Logging      │  │
│  └─────────────────────────┘      └─────────────┬───────────────────┘  │
└─────────────────────────────────────────────────┼──────────────────────┘
                                                  │
                                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│               GOOGLE CLOUD PLATFORM INFRASTRUCTURE                     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Cloud Firestore: ai-studio-fieldopsmw-0c4fa765-c593-4af5-...     │  │
│  │ Collections:                                                     │  │
│  │ • /work_orders/{id}      • /photos/{id}     • /tickets/{id}      │  │
│  │ • /tssr_approvals/{id}   • /inventory/{id}  • /audit_logs/{id}   │  │
│  │ Security Rules v2 Deployed & Active                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase-by-Phase Execution Roadmap

### Phase 1: Real-Time Mobile Device Sensor Alignment Tool
- **Objective**: Implement a dedicated interactive antenna alignment HUD utilizing device orientation and compass APIs.
- **Key Deliverables**:
  - `DeviceOrientationEvent` sensor listener capturing absolute alpha (azimuth compass heading $0^\circ$–$360^\circ$) and beta (elevation tilt $-90^\circ$–$+90^\circ$).
  - Target delta calculation against link design parameters (Target: $231.8^\circ$ Azimuth, $+0.12^\circ$ Elevation).
  - Visual circular dial with green alignment tolerance zone ($\pm 1.0^\circ$) and audio/haptic click feedback when aligned.
  - Fallback manual slider simulation mode for devices without magnetometer sensors.

### Phase 2: Enterprise Telemetry & Sync Scaling
- **Objective**: Harden the offline-to-cloud batch synchronization gateway.
- **Key Deliverables**:
  - Chunked background sync streaming for large watermark photo evidence.
  - Vector-clock timestamp conflict resolution ensuring field technician edits take precedence over stale server states.
  - Exponential backoff retry logic ($1\text{s}, 2\text{s}, 4\text{s}, 8\text{s}$) with automated payload size throttling.
  - Real-time sync progress bar in the bottom navigation bar and offline audit viewer.

### Phase 3: Automated TSSR Engineering Report Generation
- **Objective**: Deliver printable, compliant engineering hand-over documentation.
- **Key Deliverables**:
  - Client-side export module generating PDF-ready multi-page TSSR sheets with high-resolution HUD photos.
  - Verification signature block with cryptographic timestamp hash for Transport Engineering, Civil Works, and Telecom QA.
  - CSV/JSON asset return manifests for decommissioned microwave hardware inventory.

### Phase 4: Production Observability & Hardening
- **Objective**: Validate container deployment readiness and security posture.
- **Key Deliverables**:
  - Integration with Cloud Run health checks (`/api/health`, `/api/health/db`).
  - Strict audit logging for all status transitions and clearance overrides.
  - Final end-to-end regression validation across all roles.

---

## 5. Verification & Acceptance Criteria

### 5.1 Verification Checklist
1. **Compilation & Type Safety**:
   - `npm run lint` (`tsc --noEmit`) passes with 0 errors.
   - `npm run build` generates production bundle in `< 5s`.
2. **Server & Database Probes**:
   - `curl -s http://localhost:3000/api/health` returns HTTP 200 with `HEALTHY` status.
   - `curl -s http://localhost:3000/api/health/db` confirms Cloud Firestore connectivity.
3. **Sensor Alignment Module**:
   - Device orientation permissions requested gracefully.
   - Target heading ($231.8^\circ$) renders lock-on visual indicator within $\pm 1^\circ$.
4. **Offline Resilience**:
   - Toggling offline mode retains all photo captures and step data in Dexie.js.
   - Restoring connectivity auto-syncs mutations to Cloud Firestore without data loss.
