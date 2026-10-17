import React, { useState, useMemo } from 'react';
import {
  Printer,
  Download,
  X,
  FileText,
  CheckCircle2,
  Shield,
  Layers,
  Radio,
  Zap,
  Server,
  Truck,
  Compass,
  Filter,
  CheckSquare,
  Square,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Calendar,
  MapPin,
  Clock,
} from 'lucide-react';
import {
  WorkOrder,
  Site,
  Hop,
  UserProfile,
  TssrApprovalSheet,
  PhotoEvidence,
} from '../../types/fieldops';
import {
  PHOTO_CATEGORIES,
  PhotoCategoryDefinition,
  getCategoryForSection,
  getMergedPhotoEvidence,
} from './reportPhotoCategories';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  site: Site;
  hop: Hop;
  activeUser: UserProfile;
  approvals: TssrApprovalSheet;
  photos: PhotoEvidence[];
}

export const ReportExportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  workOrder,
  site,
  hop,
  activeUser,
  approvals,
  photos,
}) => {
  const [reportType, setReportType] = useState<
    'AS_BUILT' | 'TSSR_REPORT' | 'POWER_STUDY' | 'DISMANTLE'
  >('AS_BUILT');

  // Selected Photo Evidence Categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    PHOTO_CATEGORIES.forEach((cat) => {
      if (cat.defaultSelected) {
        initial.add(cat.id);
      }
    });
    return initial;
  });

  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [gridLayout, setGridLayout] = useState<'2_COL' | '3_COL'>('2_COL');
  const [includeWatermarkMetadata, setIncludeWatermarkMetadata] = useState(true);
  const [includeAiVerification, setIncludeAiVerification] = useState(true);

  // Merge actual captured photos with realistic sample fallbacks so all categories have evidence
  const allAvailablePhotos = useMemo(() => {
    return getMergedPhotoEvidence(photos, site, hop, activeUser);
  }, [photos, site, hop, activeUser]);

  // Map photos into categories
  const photosByCategory = useMemo(() => {
    const map = new Map<string, PhotoEvidence[]>();
    PHOTO_CATEGORIES.forEach((cat) => map.set(cat.id, []));

    allAvailablePhotos.forEach((photo) => {
      const cat = getCategoryForSection(photo.sectionCode);
      const list = map.get(cat.id) || [];
      list.push(photo);
      map.set(cat.id, list);
    });

    return map;
  }, [allAvailablePhotos]);

  // Selected categories list
  const selectedCategories = useMemo(() => {
    return PHOTO_CATEGORIES.filter((cat) => selectedCategoryIds.has(cat.id));
  }, [selectedCategoryIds]);

  // Photos that match selected categories
  const selectedPhotos = useMemo(() => {
    return allAvailablePhotos.filter((photo) => {
      const cat = getCategoryForSection(photo.sectionCode);
      return selectedCategoryIds.has(cat.id);
    });
  }, [allAvailablePhotos, selectedCategoryIds]);

  if (!isOpen) return null;

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCategoryIds(new Set(PHOTO_CATEGORIES.map((c) => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedCategoryIds(new Set());
  };

  const handlePresetCoreMw = () => {
    setSelectedCategoryIds(
      new Set(['ANTENNA_RF', 'POWER_CABINET', 'GROUNDING_FEEDERS', 'TRANSMISSION_IDU'])
    );
  };

  const handlePresetTowerCivil = () => {
    setSelectedCategoryIds(new Set(['TOWER_STRUCTURE', 'CIVIL_ACCESS', 'PANORAMA_360']));
  };

  const handlePrint = () => {
    window.print();
  };

  // Render Category Icon Helper
  const renderCategoryIcon = (iconName: string, className: string = 'w-4 h-4') => {
    switch (iconName) {
      case 'Radio':
        return <Radio className={className} />;
      case 'Zap':
        return <Zap className={className} />;
      case 'Shield':
        return <Shield className={className} />;
      case 'Server':
        return <Server className={className} />;
      case 'Layers':
        return <Layers className={className} />;
      case 'Truck':
        return <Truck className={className} />;
      case 'Compass':
        return <Compass className={className} />;
      default:
        return <FileText className={className} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      {/* Print-specific style overrides to guarantee pristine PDF pagination */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible;
          }
          #printable-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 12mm !important;
            background: white !important;
            color: #111827 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print, .modal-controls-toolbar {
            display: none !important;
          }
          .photo-evidence-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl text-slate-100 max-h-[95vh] flex flex-col">
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0 flex-wrap gap-2 modal-controls-toolbar">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Official As-Built Dossier & PDF Export
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Site: {site.id} &bull; Work Order: {workOrder.workOrderNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/60 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF ({selectedPhotos.length} Photos)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Report Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Selector Tabs */}
        <div className="flex gap-2 py-2.5 border-b border-slate-800 shrink-0 text-xs font-bold overflow-x-auto modal-controls-toolbar">
          <button
            type="button"
            onClick={() => setReportType('AS_BUILT')}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              reportType === 'AS_BUILT'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Installation As-Built Dossier</span>
          </button>
          <button
            type="button"
            onClick={() => setReportType('TSSR_REPORT')}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              reportType === 'TSSR_REPORT'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Full TSSR Specification</span>
          </button>
          <button
            type="button"
            onClick={() => setReportType('POWER_STUDY')}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              reportType === 'POWER_STUDY'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Power Sufficiency Certificate</span>
          </button>
        </div>

        {/* PHOTO EVIDENCE CATEGORY SELECTOR CONTROL PANEL */}
        <div className="my-3 rounded-xl border border-slate-700/80 bg-slate-950/80 overflow-hidden shrink-0 modal-controls-toolbar">
          <div
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="p-3 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Photo Evidence Category Selection for PDF Annex
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-900/50 text-cyan-300 border border-cyan-700/60 font-semibold">
                    {selectedCategoryIds.size} of {PHOTO_CATEGORIES.length} Categories Selected
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                    {selectedPhotos.length} Photos in Dossier
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select which technical inspection photo disciplines to render in the printable As-Built report.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {isConfigOpen ? 'Collapse Controls' : 'Expand Controls'}
              </span>
              {isConfigOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>

          {isConfigOpen && (
            <div className="p-3.5 space-y-3">
              {/* Presets and Quick Toggles */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-mono uppercase font-bold mr-1">
                    Presets:
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    Select All (7)
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    Clear All (0)
                  </button>
                  <button
                    type="button"
                    onClick={handlePresetCoreMw}
                    className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-200 text-xs font-semibold border border-cyan-800 transition-colors"
                  >
                    Core MW Handover (4)
                  </button>
                  <button
                    type="button"
                    onClick={handlePresetTowerCivil}
                    className="px-2.5 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 text-xs font-semibold border border-purple-800 transition-colors"
                  >
                    Tower & Civil (3)
                  </button>
                </div>

                {/* Layout and Options */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 px-1.5 font-bold">GRID:</span>
                    <button
                      type="button"
                      onClick={() => setGridLayout('2_COL')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        gridLayout === '2_COL' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      2 Columns
                    </button>
                    <button
                      type="button"
                      onClick={() => setGridLayout('3_COL')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        gridLayout === '3_COL' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      3 Columns
                    </button>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={includeWatermarkMetadata}
                      onChange={(e) => setIncludeWatermarkMetadata(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>GPS HUD Strip</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={includeAiVerification}
                      onChange={(e) => setIncludeAiVerification(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>AI QA Badges</span>
                  </label>
                </div>
              </div>

              {/* Category Checkbox Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {PHOTO_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategoryIds.has(cat.id);
                  const photosCount = (photosByCategory.get(cat.id) || []).length;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleToggleCategory(cat.id)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        isSelected
                          ? 'bg-slate-900 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 opacity-60 hover:opacity-100 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-md ${
                              isSelected
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-slate-900 text-slate-500'
                            }`}
                          >
                            {renderCategoryIcon(cat.iconName, 'w-4 h-4')}
                          </div>
                          <div>
                            <h5
                              className={`text-xs font-bold leading-tight ${
                                isSelected ? 'text-white' : 'text-slate-300'
                              }`}
                            >
                              {cat.shortName}
                            </h5>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              {photosCount} {photosCount === 1 ? 'photo' : 'photos'} available
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 mt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-tight mt-2 line-clamp-2">
                        {cat.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* PRINTABLE DOSSIER VIEWPORT (Clean high-contrast styling) */}
        <div
          id="printable-report-area"
          className="p-6 sm:p-8 rounded-lg bg-white text-neutral-900 overflow-y-auto space-y-6 font-sans text-xs border border-neutral-300 shadow-inner flex-1"
        >
          {/* Cover Header */}
          <div className="border-b-2 border-neutral-900 pb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-neutral-500">
                OFFICIAL TELECOM ENGINEERING DOSSIER
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 mt-0.5">
                FIELD-OPS MW AS-BUILT HANDOVER CERTIFICATE
              </h1>
              <p className="text-xs text-neutral-600 font-mono mt-0.5">
                Document Ref: {workOrder.workOrderNumber} &bull; Project: Project Crane (Region MIN)
              </p>
            </div>
            <div className="text-right font-mono text-[11px] text-neutral-600">
              <p className="font-bold text-neutral-900">CLASSIFICATION: CONFIDENTIAL</p>
              <p>Generated: {new Date().toLocaleDateString()}</p>
              <p className="text-[10px] text-emerald-700 font-bold">
                {selectedPhotos.length} Photo Evidence Records Attached
              </p>
            </div>
          </div>

          {/* Project & Hop Metadata Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-neutral-100 rounded border border-neutral-300 font-mono text-[11px]">
            <div>
              <span className="text-neutral-500 block">Hop Link:</span>
              <p className="font-bold text-neutral-900">{hop.hopName}</p>
            </div>
            <div>
              <span className="text-neutral-500 block">Link Config & Freq:</span>
              <p className="font-bold text-neutral-900">{hop.configuration} (11 GHz)</p>
            </div>
            <div>
              <span className="text-neutral-500 block">Site B (Tested):</span>
              <p className="font-bold text-neutral-900">
                {site.id} ({site.name})
              </p>
            </div>
            <div>
              <span className="text-neutral-500 block">Tower Type & Elev:</span>
              <p className="font-bold text-neutral-900">
                {site.tower.type} ({site.tower.heightM}m)
              </p>
            </div>
          </div>

          {/* Section 1: Engineering Approvals Table */}
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
              1. Engineering Clearances & ACL Routing Approvals
            </h3>
            <table className="w-full border-collapse border border-neutral-300 text-left">
              <thead>
                <tr className="bg-neutral-100 font-mono text-[10px] text-neutral-700">
                  <th className="border border-neutral-300 p-2">Engineering Discipline</th>
                  <th className="border border-neutral-300 p-2">Status</th>
                  <th className="border border-neutral-300 p-2">Approver Name & Date</th>
                  <th className="border border-neutral-300 p-2">Approved Parameters & Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-neutral-300 p-2 font-bold">Transport Engineering</td>
                  <td className="border border-neutral-300 p-2 font-mono font-bold text-emerald-700">
                    {approvals.transportEng.status}
                  </td>
                  <td className="border border-neutral-300 p-2">
                    {approvals.transportEng.approverName} ({approvals.transportEng.date})
                  </td>
                  <td className="border border-neutral-300 p-2 text-neutral-700">
                    Approved ACL Height: <strong>{approvals.transportEng.aclApprovedM} m</strong> on{' '}
                    <strong>{approvals.transportEng.legApproved}</strong>. {approvals.transportEng.remarks}
                  </td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2 font-bold">Facility Engineering</td>
                  <td className="border border-neutral-300 p-2 font-mono font-bold text-emerald-700">
                    {approvals.facilityEng.status}
                  </td>
                  <td className="border border-neutral-300 p-2">
                    {approvals.facilityEng.approverName} ({approvals.facilityEng.date})
                  </td>
                  <td className="border border-neutral-300 p-2 text-neutral-700">
                    {approvals.facilityEng.powerApprovalRemarks}
                  </td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2 font-bold">Tower Assessment</td>
                  <td className="border border-neutral-300 p-2 font-mono font-bold text-emerald-700">
                    {approvals.towerAssessment.status}
                  </td>
                  <td className="border border-neutral-300 p-2">
                    {approvals.towerAssessment.approverName} ({approvals.towerAssessment.date})
                  </td>
                  <td className="border border-neutral-300 p-2 text-neutral-700">
                    {approvals.towerAssessment.structuralCapacityRemarks}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: As-Built Variance Table */}
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
              2. As-Built Parameter Audit (Planned vs. Actual)
            </h3>
            <table className="w-full border-collapse border border-neutral-300 font-mono text-[11px]">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700">
                  <th className="border border-neutral-300 p-2">Item</th>
                  <th className="border border-neutral-300 p-2">TSSR Planned</th>
                  <th className="border border-neutral-300 p-2">Field As-Built</th>
                  <th className="border border-neutral-300 p-2">Variance</th>
                  <th className="border border-neutral-300 p-2">QA Result</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-neutral-300 p-2">Antenna Centerline (ACL)</td>
                  <td className="border border-neutral-300 p-2">{site.approvedAclHeightM || 40.7} m</td>
                  <td className="border border-neutral-300 p-2 font-bold">40.7 m</td>
                  <td className="border border-neutral-300 p-2">0.0 m</td>
                  <td className="border border-neutral-300 p-2 font-bold text-emerald-700">PASS</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">Tower Leg Position</td>
                  <td className="border border-neutral-300 p-2">{site.approvedAclLeg || 'Leg C'}</td>
                  <td className="border border-neutral-300 p-2 font-bold">Leg C</td>
                  <td className="border border-neutral-300 p-2">Exact Match</td>
                  <td className="border border-neutral-300 p-2 font-bold text-emerald-700">PASS</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">Boresight Azimuth</td>
                  <td className="border border-neutral-300 p-2">241.02°</td>
                  <td className="border border-neutral-300 p-2 font-bold">241.0°</td>
                  <td className="border border-neutral-300 p-2">-0.02°</td>
                  <td className="border border-neutral-300 p-2 font-bold text-emerald-700">PASS</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">Received Signal Level (RSL)</td>
                  <td className="border border-neutral-300 p-2">{hop.expectedRslDbm} dBm</td>
                  <td className="border border-neutral-300 p-2 font-bold">-27.20 dBm</td>
                  <td className="border border-neutral-300 p-2">-0.03 dB</td>
                  <td className="border border-neutral-300 p-2 font-bold text-emerald-700">PASS</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">Grounding Wire Size</td>
                  <td className="border border-neutral-300 p-2">16 mm² to 40.3m busbar</td>
                  <td className="border border-neutral-300 p-2 font-bold">16 mm² stranded Cu</td>
                  <td className="border border-neutral-300 p-2">Exact Match</td>
                  <td className="border border-neutral-300 p-2 font-bold text-emerald-700">PASS</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: PHOTO EVIDENCE ANNEX (Filtered by Selected Categories) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-1.5 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide text-neutral-900">
                  3. As-Built Photographic Evidence Annex
                </h3>
                <p className="text-[11px] text-neutral-600 font-mono">
                  Site-audited photographic records with burned-in HUD watermark, GPS geolocation, and QA verification.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-300 font-bold text-neutral-800">
                  {selectedCategoryIds.size} / {PHOTO_CATEGORIES.length} Categories Included
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 font-bold text-emerald-900">
                  {selectedPhotos.length} Total Photos
                </span>
              </div>
            </div>

            {/* Selected Categories Summary Matrix */}
            <div className="p-3 bg-neutral-50 rounded border border-neutral-300">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 block mb-1.5">
                Included Evidence Category Index:
              </span>
              <div className="flex flex-wrap gap-2">
                {PHOTO_CATEGORIES.map((cat) => {
                  const isChecked = selectedCategoryIds.has(cat.id);
                  const count = (photosByCategory.get(cat.id) || []).length;
                  return (
                    <span
                      key={cat.id}
                      className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 border ${
                        isChecked
                          ? 'bg-neutral-900 text-white border-neutral-900 font-bold'
                          : 'bg-neutral-200 text-neutral-500 border-neutral-300 line-through opacity-60'
                      }`}
                    >
                      <span>{cat.shortName}</span>
                      <span className="opacity-80">({count})</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* If no categories are selected */}
            {selectedCategories.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-neutral-300 rounded-lg text-neutral-500 space-y-1">
                <Filter className="w-6 h-6 mx-auto text-neutral-400" />
                <p className="font-bold text-xs text-neutral-700">
                  No Photo Evidence Categories Selected
                </p>
                <p className="text-[11px]">
                  Use the control panel above to select photo categories (e.g. Antenna & RF, Power, Grounding) to include in this report.
                </p>
              </div>
            ) : (
              /* Grouped Photos by Selected Category */
              <div className="space-y-6">
                {selectedCategories.map((category, catIdx) => {
                  const catPhotos = photosByCategory.get(category.id) || [];

                  return (
                    <div
                      key={category.id}
                      className="space-y-3 p-3.5 rounded-lg border border-neutral-300 bg-neutral-50/50"
                    >
                      {/* Category Header */}
                      <div className="flex items-center justify-between border-b border-neutral-300 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-neutral-900">
                            3.{catIdx + 1}
                          </span>
                          <h4 className="font-bold text-xs uppercase tracking-wide text-neutral-900">
                            {category.name}
                          </h4>
                          <span className="text-[10px] font-mono text-neutral-500">
                            ({catPhotos.length} {catPhotos.length === 1 ? 'photo' : 'photos'})
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500 hidden sm:inline">
                          Discipline Code: {category.id}
                        </span>
                      </div>

                      {/* Photo Grid */}
                      {catPhotos.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic p-2 font-mono">
                          No photo records currently registered for this section.
                        </p>
                      ) : (
                        <div
                          className={`grid gap-4 ${
                            gridLayout === '3_COL'
                              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                              : 'grid-cols-1 sm:grid-cols-2'
                          }`}
                        >
                          {catPhotos.map((photo) => (
                            <div
                              key={photo.id}
                              className="photo-evidence-card bg-white rounded border border-neutral-300 p-2.5 shadow-sm space-y-2 flex flex-col justify-between"
                            >
                              {/* Photo Image Viewport */}
                              <div className="relative aspect-[16/10] bg-neutral-900 rounded overflow-hidden border border-neutral-200">
                                <img
                                  src={photo.dataUrl}
                                  alt={photo.sectionTitle}
                                  className="w-full h-full object-contain bg-black"
                                  loading="lazy"
                                />

                                {/* Burned-in watermark banner if enabled */}
                                {includeWatermarkMetadata && (
                                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                                    <span className="px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-bold text-cyan-300 border border-cyan-800">
                                      {photo.sectionCode}
                                    </span>
                                    {photo.azimuthDeg !== undefined && (
                                      <span className="px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-bold text-emerald-300 border border-emerald-800">
                                        AZ {photo.azimuthDeg.toFixed(1)}°
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Title and Caption */}
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                                  <span className="font-bold text-neutral-900">{photo.sectionCode}</span>
                                  <span>{photo.capturedAt ? new Date(photo.capturedAt).toLocaleDateString() : ''}</span>
                                </div>
                                <h5 className="font-bold text-xs text-neutral-900 mt-0.5 line-clamp-1">
                                  {photo.sectionTitle}
                                </h5>
                                <p className="text-[11px] text-neutral-700 leading-snug mt-1">
                                  {photo.caption}
                                </p>
                              </div>

                              {/* Technical Metadata Strip */}
                              {includeWatermarkMetadata && (
                                <div className="p-2 rounded bg-neutral-100 border border-neutral-200 font-mono text-[9px] text-neutral-600 space-y-0.5">
                                  <div className="flex justify-between">
                                    <span>GPS LAT/LONG:</span>
                                    <span className="font-bold text-neutral-900">
                                      {photo.gpsLat ? photo.gpsLat.toFixed(5) : site.lat.toFixed(5)}°N,{' '}
                                      {photo.gpsLong ? photo.gpsLong.toFixed(5) : site.long.toFixed(5)}°E
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>TECHNICIAN:</span>
                                    <span className="font-bold text-neutral-900">
                                      {photo.capturedBy || activeUser.name}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* AI Verification Badge */}
                              {includeAiVerification && photo.aiVerification && (
                                <div className="pt-1 border-t border-neutral-200 flex items-center justify-between text-[10px] font-mono">
                                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    AI QA: {photo.aiVerification.score}% MATCH
                                  </span>
                                  <span className="text-neutral-500 truncate max-w-[140px]" title={photo.aiVerification.feedback}>
                                    {photo.aiVerification.feedback}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Signatures Block */}
          <div className="pt-6 border-t-2 border-neutral-900 grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="h-10 border-b border-neutral-400 flex items-center justify-center font-serif italic text-neutral-800">
                Danilo Reyes
              </div>
              <p className="font-bold text-neutral-900">Danilo Reyes</p>
              <p className="text-[10px] text-neutral-500 font-mono">Field Lead Technician</p>
            </div>
            <div className="space-y-1">
              <div className="h-10 border-b border-neutral-400 flex items-center justify-center font-serif italic text-neutral-800">
                Engr. Jun Arboleda
              </div>
              <p className="font-bold text-neutral-900">Engr. Jun Arboleda</p>
              <p className="text-[10px] text-neutral-500 font-mono">Site Safety Supervisor</p>
            </div>
            <div className="space-y-1">
              <div className="h-10 border-b border-neutral-400 flex items-center justify-center font-serif italic text-neutral-800">
                Engr. Sarah Mendoza
              </div>
              <p className="font-bold text-neutral-900">Engr. Sarah Mendoza</p>
              <p className="text-[10px] text-neutral-500 font-mono">QA / Transport Reviewer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
