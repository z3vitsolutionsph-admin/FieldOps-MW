# FieldOps MW Platform Architecture & Feature Reference

## 1. System Technology Stack

| Layer | Technologies | Rationale |
|---|---|---|
| **Frontend Framework** | React 19 (SPA via Vite) | Fast rendering, concurrent UI transitions, and component modularity. |
| **Language & Typings** | TypeScript 5.8 | End-to-end type safety across domain entities, link geometries, and RBAC rules. |
| **Styling & HUD** | Tailwind CSS + Lucide Icons | Responsive mobile-first design, high-contrast sunlight mode, and gloved-touch UI. |
| **Client Edge Storage** | Dexie.js 4.x (IndexedDB) | Zero-latency offline read/writes with transaction safety and blob support for high-res photo evidence. |
| **Application Gateway** | Express on Node.js 22 (`server.ts`) | Port 3000 unified dev/production server, API proxies, and Firestore Admin sync. |
| **Cloud Persistence** | Google Cloud Firestore | Real-time multi-device replication, document storage, and security rules v2. |
| **AI Intelligence Tier** | `@google/genai` (Gemini 3.8 Flash) | Multimodal TSSR document parsing, RF calculation assistance, and offline diagnostics fallback. |

---

## 2. Core Feature Specifications

### 2.1 Shift Handover Logging (Job Module)
Designed for seamless communication between departing and incoming field crews working on telecom towers and shelter facilities.

- **Data Model (`ShiftHandoverLog`)**:
  - `id`: Unique identifier (UUID).
  - `workOrderId`: Target work order reference.
  - `outgoingTechName` & `outgoingTechId`: Departing technician identifier.
  - `incomingTechName`: Designated incoming technician (optional).
  - `shiftType`: `'DAY' | 'NIGHT' | 'SWING'`.
  - `timestamp`: ISO 8601 creation time.
  - `statusAtHandover`: Current status of work order (`'IN_PROGRESS' | 'PENDING_REVIEW' | 'PAUSED' | 'BLOCKED'`).
  - `summary`: Narrative overview of progress achieved.
  - `remainingTasks`: Array of structured task items:
    - `id`, `title`, `category` (`'RIGGING' | 'CABLING' | 'ALIGNMENT' | 'GROUNDING' | 'COMMISSIONING'`).
    - `priority`: `'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'`.
    - `completed`: Boolean state.
  - `towerSafetyNotes`: Grounding status, weather/wind velocity observations, climber hazard disclosures.
  - `digitalSignature`: Sign-off confirmation.
- **UI Integration**:
  - Direct access button in `InstallationWizard` and header action toolbar.
  - Handover count and urgent task indicators rendered on Work Order list cards in `Dashboard` and `App`.
  - Chronological shift transition ledger allowing incoming technicians to review past notes.

### 2.2 Microwave Hop GIS Map & RF Fresnel Clearance Engine
Provides transmission engineers with a complete spatial and electromagnetic representation of microwave links.

- **GIS Mapping Engine**:
  - Built with Leaflet and high-performance SVG vector rendering.
  - Custom themed markers for Site A (Green) and Site B (Cyan) with altitude, coordinates, and tower types.
  - True line-of-sight geodesic path rendering with animated RF transmission pulses.
  - First Fresnel zone ($F_1$) corridor envelope displayed on the map.
- **RF Fresnel Zone Geometry & Clearance Profile**:
  - Computes first Fresnel zone radius at distance $d_1, d_2$ for path length $D$ at frequency $f$:
    $$F_1(\text{meters}) = 17.32 \sqrt{\frac{d_1 \cdot d_2}{f \cdot D}}$$
  - Accounts for spherical Earth curvature with effective Earth radius factor $K = 4/3$:
    $$h_{\text{earth}} = \frac{d_1 \cdot d_2}{12.75 \cdot K}$$
  - Renders line-of-sight beam, $100\%$ Fresnel boundary, and $60\%$ clearance criterion ($0.6 \times F_1$).
  - Evaluates terrain topography and obstruction heights, calculating clearance margin:
    $$\text{Margin} = \text{Clearance Height} - (0.6 \times F_1)$$
- **Interactive Synchronized Distance Probe**:
  - Dragging the distance probe cursor on either the map or profile updates the distance, antenna heights, and clearance calculations in real time.

### 2.3 TSSR Clean Slate & Gemini AI Ingestion Pipeline
Enables Project Managers to test automated extraction capabilities on fresh Technical Site Survey Reports.

- **Clean Slate Architecture**:
  - On startup or manual purge, `storageService` clears existing sites, hops, and work orders.
  - Active user is initialized as **Carlos Villanueva (Project Manager)**.
  - System components render "Awaiting TSSR Ingestion" banners with direct upload triggers.
- **Supported Dossier Ingestion**:
  - Drag-and-drop or file upload supporting `.pdf`, `.txt`, `.docx`, `.json`, `.csv`, `.png`, and `.jpg` (up to 50MB).
  - Quick-load telecom presets for instant zero-file testing:
    - *Siargao Island Backbone* (11.2 GHz XPIC, 7.42 km).
    - *Mindanao Mt. Apo Ridge Repeater* (7.5 GHz 2+0, 18.9 km).
    - *Visayas Coastal Over-Water Link* (13.0 GHz Space Diversity, 12.3 km).
- **Gemini AI Extraction Workflow**:
  1. **Structure Ingestion**: Reads file text or base64 multimodal image bytes.
  2. **Geolocation Resolution**: Extracts Site A and Site B latitudes, longitudes, ground elevations, and regional codes.
  3. **Antenna & Tower Parameters**: Identifies tower height, structure type (e.g. 3-legged SST), leg assignment (e.g. Leg C), and approved antenna centerline (ACL) heights.
  4. **RF Link Parameters**: Extracts frequency band, polarization, antenna diameter, transmitter power, and target receive signal level (RSL).
  5. **Job Synthesis**: Synthesizes field-ready Installation and Rigging Work Orders complete with safety steps and verification checkpoints.
- **Confirm & Bind Pipeline**:
  - One-click confirmation commits extracted entities into Dexie IndexedDB and application state.
  - Immediately updates the GIS Map, RF Fresnel diagram, Job list, and FieldOps AI context.

### 2.4 Resource Allocation & Skill-Based Crew Matching Widget
Provides Project Managers with live field crew deployment metrics, certified climber coverage, and an intelligent matching engine for pending work orders.

- **Crew Roster & Availability Telemetry**:
  - Live tracking of field personnel across Technicians, Tower Climbers, Team Leaders, and Supervisors.
  - Deployment status tracking (`ON_DUTY` vs. `AVAILABLE` standby), active work order assignments, and experience levels.
  - Verification of high-altitude climber licenses (`CLIMB-PH-XXXX`) and safety rescue certifications.
- **Skill-Based Matching Algorithm**:
  - Evaluates each crew member's certifications and role against the specific requirements of the work order:
    - *Rigging & Tower Works*: Matches `Working at Heights Level 2`, `Certified Tower Climber & Rescue`, and active climber license.
    - *Microwave Antenna Alignment*: Matches `Microwave Installation Specialist` and `Microwave Link Alignment Specialist`.
    - *Shelter & Power Commissioning*: Matches `ZTE / Huawei Rectifier Commissioning` and `-48V DC Battery Bank Certification`.
    - *Safety Oversight*: Matches `Site Safety Supervisor` and `High-Risk Tower Operations Assessor`.
  - Computes a normalized compatibility score ($0\%$–$100\%$) incorporating role alignment, mandatory certifications, climber license, and current workload capacity.
- **Interactive 1-Click Crew Assignment**:
  - Direct 1-click crew assignment/removal updating `storageService` and Dexie IndexedDB.
  - "Auto-Match Top Crew" smart button automatically identifies and dispatches the optimal pair of certified crew members.
  - Role-based and availability filtering plus full-text candidate search.

---

## 3. RBAC Privilege Matrix

| Role | Job Viewing | Handover Logging | Pre-Climb Sign | TSSR Approvals | TSSR Upload / Reset | Cloud Sync |
|---|---|---|---|---|---|---|
| **Tower Climber** | Assigned Only | Yes | Yes | Read Only | No | Yes |
| **Field Technician** | Assigned Only | Yes | Yes | Read Only | No | Yes |
| **Supervisor** | All Jobs | Yes | Yes (Override) | Review Only | No | Yes |
| **Project Manager** | All Jobs | Yes | Yes | Full Sign-Off | Full Access | Yes |
| **Administrator** | All Jobs | Yes | Yes (Override) | Full Sign-Off | Full Access | Full Access |

---

## 4. Verification & Health Probes

- **Type Check**: `npm run lint` (`tsc --noEmit`) - Clean (0 errors).
- **Build Verification**: `npm run build` - Clean production build.
- **REST Endpoints**:
  - `GET /api/health` -> System health & runtime metrics.
  - `GET /api/health/db` -> Cloud Firestore connectivity probe.
  - `POST /api/ai/parse-tssr` -> Multimodal TSSR extraction endpoint.
  - `POST /api/ai/ask` -> Grounded field operations assistant.
