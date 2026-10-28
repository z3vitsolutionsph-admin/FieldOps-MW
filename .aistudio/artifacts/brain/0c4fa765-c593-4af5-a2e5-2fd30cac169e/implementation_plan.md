# Implementation Plan: FieldOps MW Enterprise Platform

## 1. Executive Summary & Product Vision

### 1.1 Overview & Core Value Proposition
**FieldOps MW** is an enterprise-grade, mobile-first, offline-resilient Progressive Web Application (PWA) engineered specifically for telecommunications microwave transmission engineers, tower riggers, supervisors, and network operations center (NOC) reviewers.

The application streamlines the complete lifecycle of microwave link deployments:
1. **Pre-Climb Safety Governance**: Mandatory PPE and environmental hazard clearance with digital signatures before ascending tower structures.
2. **Interactive Multi-Step Installation & Dismantling Wizards**: Step-by-step guidance covering Site A and Site B alignment, azimuth/elevation calculations, cabling, grounding, and weatherproofing.
3. **Shift Handover Log System (Job Module)**: Structured transition logging between departing and incoming technician shifts, capturing remaining tasks, site status, weather conditions, and digital signatures.
4. **Enhanced Microwave Hop GIS Map & RF Fresnel Clearance Engine**: Modern enterprise layout integrating Leaflet GIS mapping, interactive distance probes, and dynamic first Fresnel zone ($F_1$) clearance profile calculations.
5. **Real-Time Mobile Device Sensor Alignment Tool**: Hardware-integrated compass azimuth and inclinometer tilt tracking for rapid line-of-sight antenna positioning.
6. **Offline-First Zero-Packet-Drop Persistence**: Two-way replication bridge combining device-local Dexie.js IndexedDB with an Express gateway on Node.js 22 and Google Cloud Firestore master storage.
7. **Telecom Technical Site Survey Report (TSSR) AI Ingestion Engine**: Automated multi-format parsing (.pdf, .txt, .docx, .json, .csv, imagery) via Gemini AI, extracting coordinates, tower specs, antenna ACLs, and synthesizing deployment work orders.

### 1.2 Target Personas & RBAC Authorization
- **Tower Climber**: Authorized for high-altitude rigging, physical antenna bracket mounting, waveguide torque verification, shift handover logging, and pre-climb checklists.
- **Field Technician**: Ground shelter equipment installation, IDU/ODU rack mounting, -48V DC power rectifiers, battery discharge testing, and BER measurements.
- **Supervisor**: On-site safety oversight, high-risk climb approvals, shift handover reviews, and severe weather clearance overrides.
- **Project Manager**: Technical QA verification, link budget margin audits (-27.2 dBm target RSL), TSSR dossier upload/re-ingestion, and work order assignment.
- **Administrator**: Global system configuration, RBAC privilege overrides, and cloud replication management.

---

## 2. System Architecture & Component Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FIELD TECHNICIAN MOBILE DEVICE (PWA)                 │
│                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │ Mobile Device Sensors   │  │   Offline UI & Reactive State       │  │
│  │ • HTML5 Geolocation API │  │   • Installation & TSSR Wizards     │  │
│  │ • DeviceOrientation API │  │   • Shift Handover Modal & Timeline │  │
│  │ • Compass Azimuth & Tilt│  │   • GIS Leaflet & RF Fresnel Viewer │  │
│  │ • Camera Watermark HUD  │  │   • Pre-Climb Safety Check Modal    │  │
│  └────────────┬────────────┘  └──────────────────┬──────────────────┘  │
│               │                                  │                     │
│               ▼                                  ▼                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │         Dexie.js IndexedDB 4.x Local Edge Storage Layer          │  │
│  │  • workOrders  • shiftHandovers  • photos  • inventory  • sync   │  │
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
│  │ • /api/ai/parse-tssr    │  │ • Audit Trail (Append-Only Log)     │  │
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

## 3. Implemented Modules & Status

### 3.1 Shift Handover Log Feature (COMPLETED)
- **Status**: Implemented, tested, and verified.
- **Capabilities**:
  - Modal dialog triggered directly from the Job/Work Order interface and top navigation header.
  - Form capturing:
    - Outgoing Technician Name, Shift Type (Day, Night, Swing), Handover Timestamp.
    - Work Order Status at time of handover (In Progress, Blocked, Testing, etc.).
    - Narrative summary of progress completed during the shift.
    - Structured Remaining Tasks checklist with priority tags (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and category markers (`RIGGING`, `CABLING`, `ALIGNMENT`, `GROUNDING`, `COMMISSIONING`).
    - Tower Safety & Weather conditions report (wind speed, precipitation, climb hazard status).
    - Digital signature & confirmation.
  - History view showing sequential shift transitions with author timestamps and status progression.
  - Real-time indicator badges on Work Order cards displaying pending handover items.

### 3.2 Microwave Hop GIS Map & RF Fresnel Clearance Engine (COMPLETED)
- **Status**: Implemented, tested, and verified.
- **Capabilities**:
  - **Enterprise Layout**: Interactive controls for map mode switching (`LEAFLET`, `FRESNEL`, `SPLIT`).
  - **Leaflet GIS Map**:
    - High-visibility custom SVG markers for Site A (Green) and Site B (Cyan) with tower icons.
    - True geodesic link line connecting sites with animated RF pulse effect.
    - First Fresnel zone clearance corridor envelope overlay ($60\%$ clearance boundary).
    - Elevation profile markers and coordinate tooltips.
  - **RF Fresnel Zone Diagram**:
    - Dynamic Fresnel radius calculation:
      $$F_1 = 17.32 \sqrt{\frac{d_1 \cdot d_2}{f \cdot D}}$$
    - Curvature of the Earth adjustment based on $K = 4/3$ standard atmospheric refraction.
    - Visual obstacle indicators with clearance margin readouts.
    - Antenna centerline (ACL) heights plotted to scale on tower structures.
  - **Synchronized Distance Probe**:
    - Moving cursor on either the map or the Fresnel diagram updates the probe distance and clearance telemetry across both views simultaneously.

### 3.3 TSSR Clean Slate & Gemini AI Ingestion Pipeline (COMPLETED)
- **Status**: Implemented, tested, and verified.
- **Capabilities**:
  - **Clean Slate Initial State**: All previous TSSR data removed on clean startup, defaulting to Carlos Villanueva (Project Manager).
  - **Awaiting Ingestion Banners**:
    - Dashboard, Jobs view, Sidebar, and AI Assistant render graceful clean-slate indicators inviting the PM to upload a new dossier.
  - **Enterprise Multi-Format Dropzone**:
    - Supports `.pdf`, `.txt`, `.docx`, `.json`, `.csv`, `.png`, and `.jpg` files up to 50MB.
    - Drag-and-drop and native file explorer browsing.
  - **One-Click Telecom Link Presets**:
    - *Siargao Island Backbone Link* (11.2 GHz XPIC, 7.42 km, Catangnan ↔ Dapa).
    - *Mindanao Mt. Apo Ridge Repeater* (7.5 GHz 2+0, 18.9 km, Mt. Apo ↔ Kidapawan).
    - *Visayas Coastal Over-Water Link* (13.0 GHz Space Diversity, 12.3 km, Mactan ↔ Olango).
  - **Step-by-Step AI Telemetry Console**:
    - Live terminal logging documenting:
      1. Document structure ingestion & OCR text extraction.
      2. Geographic coordinates & WGS84 projection validation.
      3. Tower structure type, Leg designation, and ACL centerline extraction.
      4. Microwave RF link parameters (frequency, polarization, antenna diameter, RSL target).
      5. Work Order schedule and rigging step synthesis.
### 3.4 Resource Allocation & Skill-Based Crew Matching Widget (COMPLETED)
- **Status**: Implemented, tested, and verified.
- **Capabilities**:
  - **Project Manager Mission Control**: Embedded directly into the PM Dashboard overview and accessible via a dedicated "Resource Allocation" tab.
  - **Live Field Crew Telemetry**:
    - Tracks active deployment, standby availability, and current job workload across all field technicians, licensed tower climbers, team leaders, and supervisors.
    - Top KPI status cards: Total Field Crew, Crew Deployment (On-Duty vs. Standby), Licensed Climbers, and Unassigned Work Orders requiring crew.
  - **Intelligent Skill-Based Matching Engine**:
    - Computes compatibility scores ($0\%$–$100\%$) for each crew member against the specific requirements of the selected work order:
      - Rigging & Tower Work: Requires `Working at Heights Level 2`, `Certified Tower Climber & Rescue`, and active Climber License.
      - Antenna Alignment & Tuning: Requires `Microwave Installation Specialist` or `Microwave Link Alignment Specialist`.
      - Power & Commissioning: Requires `ZTE / Huawei Rectifier Commissioning` or `-48V DC Battery Bank Certification`.
      - Safety Oversight: Requires `High-Risk Tower Operations Assessor` or `Site Safety Supervisor`.
    - Real-time compatibility bars with visual breakdown of matched mandatory certifications, missing requirements, and high-altitude license status.
  - **Interactive 1-Click Assignment & Automated Dispatch**:
    - Manual 1-click crew assignment/removal with immediate Dexie IndexedDB sync and audit logging.
    - Automated "Auto-Match Top Crew" algorithm that selects the optimal pairing (e.g. Lead Certified Climber + Commissioning Specialist).
  - **Search & Multi-Role Filtering**: Real-time filtering by role (`TOWER_CLIMBER`, `TECHNICIAN`, `TEAM_LEADER`, `SUPERVISOR`), availability (`AVAILABLE`, `ON_DUTY`), or freeform name/specialization search.

---

## 4. Verification & Testing Matrix

| Component | Test Case | Target State | Verified |
|---|---|---|---|
| **Shift Handover** | Log transition from departing technician | Handover logged with remaining tasks, priority, and signature | Yes |
| **Shift Handover** | Display handover counter on Work Order | Badge renders with handover count and pending task alert | Yes |
| **GIS Map** | Render Leaflet map with Sites A & B | Markers, link path, and Fresnel corridor render cleanly | Yes |
| **RF Fresnel** | Calculate 60% clearance curve | Earth curvature and obstacle margins accurately depicted | Yes |
| **TSSR Clean Slate** | Clear previous TSSR data | System returns to unseeded state, active user set to PM | Yes |
| **TSSR AI Parse** | Upload or select telecom preset | Gemini AI extracts coordinates, ACL, and generates jobs | Yes |
| **TSSR Bind** | Bind extracted project to FieldOps | Sites, hops, and work orders dynamically populated | Yes |
| **Resource Allocation** | Visualizes field crew workload & status | Live deployment, standby status, and licenses displayed | Yes |
| **Skill Matching** | Score crew against work order requirements | Computes 0–100% score based on role, certs, and license | Yes |
| **Crew Assignment** | 1-click assign or auto-match crew | Updates work order assigneeIds, saves to storage, logs audit | Yes |
| **Type Check** | `npm run lint` (`tsc --noEmit`) | 0 TypeScript errors | Yes |
| **Build Check** | `npm run build` | Production bundle compiled successfully | Yes |

