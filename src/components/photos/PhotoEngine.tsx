import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Eye,
  X,
  Sparkles,
  MapPin,
  Compass,
  FileCheck,
  Shield,
  Layers,
} from 'lucide-react';
import { PhotoEvidence, Site, UserProfile } from '../../types/fieldops';
import { TSSR_PHOTO_SECTIONS, PANORAMA_ANGLES } from '../../data/seedData';
import { storage } from '../../services/storageService';
import { gemini } from '../../services/geminiService';

interface PhotoEngineProps {
  site: Site;
  activeUser: UserProfile;
  photos: PhotoEvidence[];
  targetSectionCode?: string;
  onCloseCapture?: () => void;
  sunlightMode: boolean;
}

export const PhotoEngine: React.FC<PhotoEngineProps> = ({
  site,
  activeUser,
  photos,
  targetSectionCode,
  onCloseCapture,
  sunlightMode,
}) => {
  const [activeTab, setActiveTab] = useState<'TSSR_SECTIONS' | 'PANORAMA' | 'GALLERY'>(
    targetSectionCode ? 'TSSR_SECTIONS' : 'TSSR_SECTIONS'
  );
  const [selectedSection, setSelectedSection] = useState<string>(
    targetSectionCode || TSSR_PHOTO_SECTIONS[0].code
  );
  const [showCameraModal, setShowCameraModal] = useState<boolean>(!!targetSectionCode);
  const [naModalSection, setNaModalSection] = useState<{ code: string; title: string } | null>(null);
  const [naReason, setNaReason] = useState<string>('');
  const [aiInspectingId, setAiInspectingId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoEvidence | null>(null);

  // Camera video / canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Active section details
  const currentSection =
    TSSR_PHOTO_SECTIONS.find((s) => s.code === selectedSection) || {
      code: selectedSection,
      title: selectedSection.startsWith('PANORAMA')
        ? `Panorama ${selectedSection.replace('PANORAMA_', '')}° Heading`
        : selectedSection,
      required: true,
    };

  // Calculate completeness
  const requiredCount = TSSR_PHOTO_SECTIONS.filter((s) => s.required).length;
  const completedRequiredCount = TSSR_PHOTO_SECTIONS.filter((s) => {
    if (!s.required) return false;
    const p = photos.find((ph) => ph.sectionCode === s.code);
    return Boolean(p);
  }).length;
  const completenessPercent = Math.round((completedRequiredCount / requiredCount) * 100);

  // Start real camera stream or fallback
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } else {
        setCameraError('Camera API not accessible in this browser context. You can upload an image file.');
      }
    } catch (err: any) {
      console.warn('Unable to access device camera, falling back to simulated snapshot/upload:', err);
      setCameraError('Camera access denied or unavailable. You can use image upload or test capture.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (showCameraModal) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [showCameraModal]);

  // Capture photo with burned-in HUD Watermark Canvas
  const captureSnapshot = (sourceImage?: HTMLImageElement) => {
    const canvas = canvasRef.current || document.createElement('canvas');
    const width = 1280;
    const height = 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (sourceImage) {
      ctx.drawImage(sourceImage, 0, 0, width, height);
    } else if (videoRef.current && cameraActive) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    } else {
      // High-resolution simulated telecom field capture background
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw grid & telecom tower silhouette
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(100, 80, width - 200, height - 160);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`FIELD CAPTURE: ${currentSection.title.toUpperCase()}`, width / 2, height / 2 - 20);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px sans-serif';
      ctx.fillText(`Site: ${site.name} (${site.id})`, width / 2, height / 2 + 25);
    }

    // --- BURN-IN HUD WATERMARK OVERLAY ---
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC+8';
    const coordsStr = `${site.lat.toFixed(5)}°N, ${site.long.toFixed(5)}°E (${site.elevationM}m AMSL)`;
    const azimuthStr = currentSection.code.startsWith('PANORAMA_')
      ? `${currentSection.code.replace('PANORAMA_', '')}° AZIMUTH`
      : 'AZ 241.02° (SITE B ➔ SITE A)';

    // Bottom Banner
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(0, height - 90, width, 90);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(0, height - 92, width, 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`FIELDOPS MW  |  ${site.id}  |  ${currentSection.code}`, 24, height - 55);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '16px monospace';
    ctx.fillText(`${site.name}  ·  Tower: ${site.tower.type}`, 24, height - 25);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(dateStr, width - 24, height - 55);

    ctx.fillStyle = '#34d399';
    ctx.font = '16px monospace';
    ctx.fillText(`GPS: ${coordsStr}  ·  ${azimuthStr}  ·  TECH: ${activeUser.name}`, width - 24, height - 25);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    // Save into Storage
    const newPhoto: PhotoEvidence = {
      id: 'photo_' + currentSection.code + '_' + Date.now(),
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: currentSection.code,
      sectionTitle: currentSection.title,
      caption: `Captured on site by ${activeUser.name}`,
      dataUrl,
      capturedAt: now.toISOString(),
      capturedBy: activeUser.name,
      gpsLat: site.lat,
      gpsLong: site.long,
      azimuthDeg: 241.02,
      syncStatus: storage.isOnline() ? 'SYNCED' : 'QUEUED',
    };

    storage.savePhoto(newPhoto);
    setShowCameraModal(false);
    if (onCloseCapture) onCloseCapture();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        captureSnapshot(img);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleInspectWithAi = async (photo: PhotoEvidence) => {
    setAiInspectingId(photo.id);
    const result = await gemini.inspectPhoto(photo.sectionTitle, photo.dataUrl);
    const updated = { ...photo, aiVerification: result };
    storage.savePhoto(updated);
    setAiInspectingId(null);
  };

  const handleSaveNa = () => {
    if (!naModalSection || !naReason) return;
    storage.markPhotoNa(site.id, naModalSection.code, naModalSection.title, naReason);
    setNaModalSection(null);
    setNaReason('');
  };

  return (
    <div className="space-y-4">
      {/* Photo Engine Header & Completeness Gauge */}
      <div
        className={`p-4 rounded-xl border ${
          sunlightMode
            ? 'bg-amber-50 border-amber-400 text-black'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">TSSR Photo Evidence Engine</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Site: <strong className="text-slate-200">{site.name}</strong> ({site.id}) · Burned-in HUD watermarking with GPS, azimuth, and timestamp
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-sm font-mono font-bold text-cyan-400">
                {completedRequiredCount} / {requiredCount} Required
              </span>
              <p className="text-xs text-slate-400">{completenessPercent}% Complete</p>
            </div>
            <div className="w-16 bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all"
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('TSSR_SECTIONS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'TSSR_SECTIONS'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            22 TSSR Sections
          </button>
          <button
            onClick={() => setActiveTab('PANORAMA')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'PANORAMA'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            360° Panorama (12 Angles)
          </button>
          <button
            onClick={() => setActiveTab('GALLERY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'GALLERY'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            Captured Gallery ({photos.length})
          </button>
        </div>
      </div>

      {/* TAB 1: 22 TSSR MANDATORY SECTIONS */}
      {activeTab === 'TSSR_SECTIONS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TSSR_PHOTO_SECTIONS.map((section) => {
            const photo = photos.find((p) => p.sectionCode === section.code);
            const isCaptured = Boolean(photo && !photo.isNa);
            const isNa = Boolean(photo && photo.isNa);

            return (
              <div
                key={section.code}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-colors ${
                  isCaptured
                    ? 'bg-emerald-950/20 border-emerald-800/80'
                    : isNa
                    ? 'bg-slate-950/40 border-slate-800'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {section.code.split('_')[0]}
                    </span>
                    {isCaptured ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> CAPTURED
                      </span>
                    ) : isNa ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                        N/A REASON LOGGED
                      </span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                        REQUIRED
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-white mt-1.5 leading-snug">
                    {section.title}
                  </h4>
                  {isNa && (
                    <p className="text-xs text-slate-400 mt-1 italic">
                      "{photo?.naReason}"
                    </p>
                  )}
                  {photo?.aiVerification && (
                    <div className="mt-2 p-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300">
                      <span className="text-cyan-400 font-bold">
                        AI Score: {photo.aiVerification.score}/100
                      </span>
                      <p className="mt-0.5 text-slate-400">{photo.aiVerification.feedback}</p>
                    </div>
                  )}
                </div>

                {/* Card Action Controls */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {isCaptured ? (
                    <>
                      <button
                        onClick={() => setPreviewPhoto(photo!)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> View Photo
                      </button>
                      <button
                        onClick={() => handleInspectWithAi(photo!)}
                        disabled={aiInspectingId === photo!.id}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
                      >
                        <Sparkles className="w-3 h-3" />
                        {aiInspectingId === photo!.id ? 'Checking...' : 'AI QA Check'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedSection(section.code);
                          setShowCameraModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Capture
                      </button>
                      <button
                        onClick={() =>
                          setNaModalSection({ code: section.code, title: section.title })
                        }
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        Mark N/A
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: 360° PANORAMA ANGLES */}
      {activeTab === 'PANORAMA' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Mandatory 12-direction microwave line-of-sight panorama taken from tower top or antenna AMB elevation at every 30° azimuth.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {PANORAMA_ANGLES.map((angle) => {
              const code = `PANORAMA_${angle.toString().padStart(3, '0')}`;
              const photo = photos.find((p) => p.sectionCode === code);
              const isCaptured = Boolean(photo);

              return (
                <div
                  key={angle}
                  className={`p-3 rounded-xl border flex flex-col justify-between text-center transition-colors ${
                    isCaptured
                      ? 'bg-emerald-950/30 border-emerald-800'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 text-cyan-400 text-xs font-mono font-bold">
                    <Compass className="w-3.5 h-3.5" />
                    <span>{angle}°</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 font-semibold">
                    {angle === 240 || angle === 210 ? 'Hop Direction ➔' : 'Line-of-Sight'}
                  </p>

                  <div className="mt-2.5">
                    {isCaptured ? (
                      <button
                        onClick={() => setPreviewPhoto(photo!)}
                        className="text-xs text-emerald-400 font-bold hover:underline"
                      >
                        ✓ View 360°
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedSection(code);
                          setShowCameraModal(true);
                        }}
                        className="w-full py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Camera className="w-3 h-3" /> Snap
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: GALLERY VIEW */}
      {activeTab === 'GALLERY' && (
        <div className="space-y-3">
          {photos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
              <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold">No photos captured yet for {site.id}.</p>
              <p className="text-xs text-slate-500 mt-1">
                Start capturing evidence using the 22 TSSR sections tab.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col justify-between"
                >
                  {photo.isNa ? (
                    <div className="p-6 bg-slate-900 text-center">
                      <span className="text-xs font-mono text-slate-400">MARKED AS N/A</span>
                      <p className="text-xs text-slate-300 mt-1">"{photo.naReason}"</p>
                    </div>
                  ) : (
                    <img
                      src={photo.dataUrl}
                      alt={photo.sectionTitle}
                      className="w-full h-44 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewPhoto(photo)}
                    />
                  )}
                  <div className="p-3 text-xs space-y-1">
                    <p className="font-bold text-white truncate">{photo.sectionTitle}</p>
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>{new Date(photo.capturedAt).toLocaleTimeString()}</span>
                      <span className="text-cyan-400">{photo.syncStatus}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: LIVE CAMERA / OVERLAY CAPTURE */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                  HUD WATERMARK CAPTURE
                </span>
                <h3 className="font-bold text-sm text-white">{currentSection.title}</h3>
              </div>
              <button
                onClick={() => {
                  setShowCameraModal(false);
                  if (onCloseCapture) onCloseCapture();
                }}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Viewport / Canvas Container */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <Camera className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs">
                    {cameraError || 'Camera stream initializing or simulated field mode active.'}
                  </p>
                </div>
              )}

              {/* Live HUD Overlay Graphic on Screen */}
              <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
                <div className="flex justify-between items-start text-xs font-mono text-cyan-400 bg-black/60 px-2 py-1 rounded">
                  <span>SITE: {site.id} ({site.name})</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-end text-xs font-mono text-emerald-400 bg-black/60 px-2 py-1 rounded">
                  <span>GPS: {site.lat.toFixed(5)}°N, {site.long.toFixed(5)}°E</span>
                  <span>AZ: 241.02° · TECH: {activeUser.name}</span>
                </div>
              </div>
            </div>

            {/* Capture Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Photo File
                </button>
              </div>

              <button
                type="button"
                onClick={() => captureSnapshot()}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white flex items-center gap-2 shadow-lg shadow-cyan-950/60"
              >
                <Camera className="w-4 h-4" />
                Burn Watermark & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MARK N/A WITH REASON */}
      {naModalSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-4 space-y-3">
            <h3 className="font-bold text-sm text-white">
              Mark {naModalSection.title} as Not Applicable (N/A)
            </h3>
            <p className="text-xs text-slate-400">
              Provide an engineering justification for skipping this required TSSR section.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Greenfield site without existing commercial generator; temporary portable genset will be deployed."
              value={naReason}
              onChange={(e) => setNaReason(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNaModalSection(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNa}
                disabled={!naReason}
                className="px-4 py-1.5 rounded bg-cyan-600 disabled:opacity-50 text-xs font-bold text-white"
              >
                Save N/A Justification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW PHOTO FULLSCREEN */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/95">
          <div className="relative max-w-4xl w-full space-y-2">
            <div className="flex items-center justify-between text-white pb-2">
              <h4 className="font-bold text-sm">{previewPhoto.sectionTitle}</h4>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewPhoto.dataUrl}
              alt={previewPhoto.sectionTitle}
              className="w-full max-h-[80vh] object-contain rounded-lg border border-slate-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};
