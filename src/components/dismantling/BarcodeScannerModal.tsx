import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Upload,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  QrCode,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  SwitchCamera,
  Keyboard,
  PackageCheck,
  Search,
} from 'lucide-react';
import { InventoryItem } from '../../types/fieldops';

export interface ScannedEquipmentData {
  serialNumber: string;
  assetTag: string;
  equipmentType?: string;
  model?: string;
  condition?: 'GOOD' | 'DAMAGED' | 'MISSING';
  existingItemId?: string;
  matchedFromInventory?: boolean;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: ScannedEquipmentData) => void;
  inventoryItems?: InventoryItem[];
  siteId?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  inventoryItems = [],
  siteId,
}) => {
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [scanMatchedItem, setScanMatchedItem] = useState<InventoryItem | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isStoppingRef = useRef<boolean>(false);

  // Play audio confirmation beep via Web Audio API
  const playBeep = () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([80, 40, 80]);
      }
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.16);
      }
    } catch {
      // Audio autoplay may be disabled or restricted
    }
  };

  // Parse raw barcode or QR text into equipment fields with inventory cross-referencing
  const parseBarcodeData = (rawText: string): ScannedEquipmentData => {
    const text = rawText.trim();

    // 1. First, check if scanned text directly matches an existing site inventory record
    if (inventoryItems.length > 0) {
      const match = inventoryItems.find(
        (item) =>
          item.serialNumber.toLowerCase() === text.toLowerCase() ||
          item.assetTag.toLowerCase() === text.toLowerCase() ||
          text.toLowerCase().includes(item.serialNumber.toLowerCase()) ||
          text.toLowerCase().includes(item.assetTag.toLowerCase())
      );

      if (match) {
        return {
          serialNumber: match.serialNumber,
          assetTag: match.assetTag,
          equipmentType: match.equipmentType,
          model: match.model,
          condition: match.condition,
          existingItemId: match.id,
          matchedFromInventory: true,
        };
      }
    }

    // 2. Check if JSON format payload e.g. {"sn":"...","assetTag":"..."}
    try {
      const parsed = JSON.parse(text);
      if (parsed.sn || parsed.serialNumber) {
        const sn = parsed.sn || parsed.serialNumber;
        const tag = parsed.assetTag || parsed.tag || `AST-${sn}`;
        return {
          serialNumber: sn,
          assetTag: tag,
          equipmentType: parsed.type || parsed.equipmentType || 'ODU',
          model: parsed.model || 'Telecom Microwave Unit',
          condition: parsed.condition || 'GOOD',
        };
      }
    } catch {
      // Not JSON, continue with pattern matching
    }

    // 3. Delimited barcode format e.g. "SN:2102313ABC998102;TAG:AST-MW-9150-0041;TYPE:IDU;MODEL:Huawei OptiX RTN 9150"
    if (text.includes(';') || text.includes('|') || text.includes('&')) {
      const parts = text.split(/[;|&]/);
      let sn = '';
      let tag = '';
      let model = '';
      let type = '';

      parts.forEach((p) => {
        const [k, v] = p.split(/[:=]/).map((s) => s?.trim());
        if (k && v) {
          const keyUpper = k.toUpperCase();
          if (keyUpper === 'SN' || keyUpper === 'SERIAL' || keyUpper === 'S/N') sn = v;
          else if (keyUpper === 'TAG' || keyUpper === 'ASSET' || keyUpper === 'AST') tag = v;
          else if (keyUpper === 'MODEL' || keyUpper === 'MOD') model = v;
          else if (keyUpper === 'TYPE' || keyUpper === 'EQ' || keyUpper === 'CAT') type = v;
        }
      });

      if (sn || tag) {
        return {
          serialNumber: sn || text,
          assetTag: tag || (sn ? `AST-${sn}` : 'AST-GEN-001'),
          model: model || undefined,
          equipmentType: type || undefined,
        };
      }
    }

    // 4. Standard Telecom Asset Tag pattern match: AST-...
    if (text.startsWith('AST-')) {
      if (text.includes('ODU') || text.includes('11G')) {
        return {
          serialNumber: `2102313XYZ77${text.slice(-4)}`,
          assetTag: text,
          equipmentType: 'ODU',
          model: 'G11H3DD2-3-B-AM-482M (11GHz)',
        };
      }
      if (text.includes('9150') || text.includes('IDU') || text.includes('MW')) {
        return {
          serialNumber: `2102313ABC99${text.slice(-4)}`,
          assetTag: text,
          equipmentType: 'IDU',
          model: 'Huawei OptiX RTN 9150',
        };
      }
      if (text.includes('ANT') || text.includes('12')) {
        return {
          serialNumber: `ANT-MA12-${text.slice(-5)}`,
          assetTag: text,
          equipmentType: 'Antenna',
          model: 'MA12U10W 1.2m 40.2 dBi',
        };
      }
      if (text.includes('RET') || text.includes('LEGACY')) {
        return {
          serialNumber: `LEGACY-7G-${text.slice(-6)}`,
          assetTag: text,
          equipmentType: 'ODU',
          model: 'RTN 950 ODU 7GHz (Legacy)',
          condition: 'DAMAGED',
        };
      }
      return {
        serialNumber: `SN-${text.replace('AST-', '')}-${Date.now().toString().slice(-4)}`,
        assetTag: text,
        equipmentType: 'ODU',
      };
    }

    // 5. Huawei telecom equipment serial number prefix: 2102313...
    if (text.startsWith('2102313')) {
      const isIdu = text.includes('ABC') || text.toLowerCase().includes('idu');
      return {
        serialNumber: text,
        assetTag: isIdu ? `AST-MW-9150-${text.slice(-4)}` : `AST-ODU-11G-${text.slice(-4)}`,
        equipmentType: isIdu ? 'IDU' : 'ODU',
        model: isIdu ? 'Huawei OptiX RTN 9150' : 'G11H3DD2-3-B-AM-482M (11GHz)',
        condition: 'GOOD',
      };
    }

    // 6. Antenna Dish Serial Number format: ANT-MA12...
    if (text.toUpperCase().startsWith('ANT-') || text.toUpperCase().startsWith('MA12')) {
      return {
        serialNumber: text,
        assetTag: `AST-ANT-12-${text.slice(-3)}`,
        equipmentType: 'Antenna',
        model: 'MA12U10W 1.2m 40.2 dBi',
        condition: 'GOOD',
      };
    }

    // 7. Legacy RTN 950 ODU format: LEGACY-...
    if (text.toUpperCase().startsWith('LEGACY-')) {
      return {
        serialNumber: text,
        assetTag: `AST-RET-7G-${text.slice(-4)}`,
        equipmentType: 'ODU',
        model: 'RTN 950 ODU 7GHz (Legacy)',
        condition: 'DAMAGED',
      };
    }

    // 8. AMB pipe / mount format: AMB-...
    if (text.toUpperCase().startsWith('AMB-')) {
      return {
        serialNumber: text,
        assetTag: `AST-AMB-16-${text.slice(-3)}`,
        equipmentType: 'AMB',
        model: 'Standard 1.6m AMB Pipe & Clamps',
        condition: 'GOOD',
      };
    }

    // 9. Generic alphanumeric fallback
    return {
      serialNumber: text,
      assetTag: `AST-${text.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`,
      equipmentType: 'ODU',
      model: 'Field Equipment Unit',
    };
  };

  const handleScanSuccess = (decodedText: string) => {
    playBeep();
    const parsedData = parseBarcodeData(decodedText);

    if (parsedData.matchedFromInventory) {
      const found = inventoryItems.find((i) => i.id === parsedData.existingItemId);
      if (found) setScanMatchedItem(found);
    }

    stopScanner();
    onScanSuccess(parsedData);
  };

  // Safe scanner startup with DOM readiness and format support
  const startScanner = async (cameraId?: string) => {
    if (isStoppingRef.current) return;
    setErrorMsg(null);

    // Wait until the container is attached in DOM
    let retries = 0;
    while (!document.getElementById('barcode-scanner-viewfinder') && retries < 10) {
      await new Promise((r) => setTimeout(r, 80));
      retries++;
    }

    const container = document.getElementById('barcode-scanner-viewfinder');
    if (!container) {
      setErrorMsg('Camera container failed to initialize. You can use manual entry or demo presets below.');
      return;
    }

    try {
      // Clean up previous instance if any
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      }

      // Query available camera devices
      try {
        const deviceList = await Html5Qrcode.getCameras();
        if (deviceList && deviceList.length > 0) {
          setCameras(deviceList.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}` })));
          if (!selectedCameraId && !cameraId) {
            // Prefer back/environment camera
            const backCam = deviceList.find(
              (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment')
            );
            setSelectedCameraId(backCam ? backCam.id : deviceList[0].id);
          }
        }
      } catch (camErr) {
        console.warn('Could not enumerate cameras, falling back to facingMode constraint:', camErr);
      }

      const html5QrCode = new Html5Qrcode('barcode-scanner-viewfinder', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.floor(minEdge * 0.75);
          return { width: Math.max(boxSize, 220), height: Math.max(boxSize, 220) };
        },
        aspectRatio: 1.0,
      };

      const cameraParam = cameraId || selectedCameraId || { facingMode: 'environment' };

      await html5QrCode.start(
        cameraParam,
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Normal frame scan tick error ignored
        }
      );

      setScannerActive(true);
    } catch (err: any) {
      console.warn('Camera scanner startup error:', err);
      setErrorMsg(
        'Camera access not available or permission denied in this context. Use the quick presets below or upload an image file.'
      );
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    isStoppingRef.current = true;
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error clearing scanner instance:', e);
      }
    }
    setScannerActive(false);
    isStoppingRef.current = false;
  };

  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const track = (html5QrCodeRef.current as any).getRunningTrackCapabilities?.();
      if (track?.torch) {
        await (html5QrCodeRef.current as any).applyVideoConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      } else {
        setTorchOn(!torchOn);
      }
    } catch {
      setTorchOn(!torchOn);
    }
  };

  const handleSwitchCamera = async (nextCamId: string) => {
    setSelectedCameraId(nextCamId);
    await stopScanner();
    await startScanner(nextCamId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('barcode-scanner-viewfinder');
      }
      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      setErrorMsg('No readable barcode or QR code detected in the uploaded photo.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleScanSuccess(manualCodeInput.trim());
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Real-world telecom sample barcodes for rapid testing on-site and in dev
  const demoSamples: { label: string; tag: string; data: ScannedEquipmentData }[] = [
    {
      label: 'Huawei ODU 11GHz (Active)',
      tag: 'AST-ODU-11G-1029',
      data: {
        serialNumber: '2102313XYZ776201',
        assetTag: 'AST-ODU-11G-1029',
        equipmentType: 'ODU',
        model: 'G11H3DD2-3-B-AM-482M (11GHz)',
        condition: 'GOOD',
      },
    },
    {
      label: 'Huawei IDU NR9150 (Subrack)',
      tag: 'AST-MW-9150-0041',
      data: {
        serialNumber: '2102313ABC998102',
        assetTag: 'AST-MW-9150-0041',
        equipmentType: 'IDU',
        model: 'Huawei OptiX RTN 9150',
        condition: 'GOOD',
      },
    },
    {
      label: '1.2m Parabolic Dish MA12U10W',
      tag: 'AST-ANT-12-884',
      data: {
        serialNumber: 'ANT-MA12-99042',
        assetTag: 'AST-ANT-12-884',
        equipmentType: 'Antenna',
        model: 'MA12U10W 1.2m 40.2 dBi',
        condition: 'GOOD',
      },
    },
    {
      label: 'Legacy RTN 950 ODU (RMA Return)',
      tag: 'AST-RET-7G-0019',
      data: {
        serialNumber: 'LEGACY-7G-002931',
        assetTag: 'AST-RET-7G-0019',
        equipmentType: 'ODU',
        model: 'RTN 950 ODU 7GHz (Legacy)',
        condition: 'DAMAGED',
      },
    },
    {
      label: 'AMB 1.6m Mounting Clamps',
      tag: 'AST-AMB-16-092',
      data: {
        serialNumber: 'AMB-16M-SURIGAO-04',
        assetTag: 'AST-AMB-16-092',
        equipmentType: 'AMB',
        model: 'Standard 1.6m AMB Pipe & Clamps',
        condition: 'GOOD',
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl text-slate-100 flex flex-col space-y-3.5 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center shadow">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  Equipment QR & Barcode Scanner
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300 font-mono font-bold border border-cyan-700/80">
                  AUTO-POPULATE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Aim camera at serial plate or asset sticker to auto-fill inventory return
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Selector Toolbar if multiple cameras exist */}
        {cameras.length > 1 && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-mono">Camera:</span>
            </div>
            <select
              value={selectedCameraId}
              onChange={(e) => handleSwitchCamera(e.target.value)}
              className="bg-transparent text-cyan-300 font-mono text-[11px] border-none focus:ring-0 cursor-pointer"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Viewfinder Viewport */}
        <div className="relative aspect-square w-full max-w-[320px] mx-auto bg-black rounded-2xl overflow-hidden border-2 border-cyan-500/80 shadow-2xl flex items-center justify-center">
          {/* HTML5 QR Container for video stream */}
          <div
            id="barcode-scanner-viewfinder"
            className="w-full h-full flex items-center justify-center overflow-hidden"
          />

          {/* Interactive Laser Scanning Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none p-6 flex flex-col items-center justify-between">
            {/* Top Reticle Brackets */}
            <div className="w-full flex justify-between">
              <div className="w-8 h-8 border-t-3 border-l-3 border-cyan-400 rounded-tl-md shadow-[0_0_8px_#22d3ee]" />
              <div className="w-8 h-8 border-t-3 border-r-3 border-cyan-400 rounded-tr-md shadow-[0_0_8px_#22d3ee]" />
            </div>

            {/* Pulsing Animated Horizontal Laser Sweep Line */}
            <div className="w-full relative flex items-center justify-center">
              <div className="w-11/12 h-0.5 bg-cyan-400 shadow-[0_0_16px_#06b6d4] animate-pulse" />
              <span className="absolute -top-3 font-mono text-[9px] text-cyan-300 bg-black/60 px-1 rounded">
                AIM AT CODE 128 / QR
              </span>
            </div>

            {/* Bottom Reticle Brackets */}
            <div className="w-full flex justify-between">
              <div className="w-8 h-8 border-b-3 border-l-3 border-cyan-400 rounded-bl-md shadow-[0_0_8px_#22d3ee]" />
              <div className="w-8 h-8 border-b-3 border-r-3 border-cyan-400 rounded-br-md shadow-[0_0_8px_#22d3ee]" />
            </div>
          </div>

          {/* Camera Error Message Display */}
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/90 p-4 flex flex-col items-center justify-center text-center space-y-2.5">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-xs text-slate-300 leading-snug">{errorMsg}</p>
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs"
              >
                Type Code Manually
              </button>
            </div>
          )}
        </div>

        {/* Scanner Action Controls */}
        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5">
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
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 font-medium border border-slate-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image
            </button>

            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-1.5 rounded-lg border transition-colors ${
                torchOn
                  ? 'bg-yellow-400 text-slate-950 border-yellow-500 font-bold'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Toggle Flashlight / Torch"
            >
              {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1 transition-colors ${
                showManualInput
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Manual Entry</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopScanner().then(() => startScanner());
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 font-medium border border-slate-700 transition-colors"
              title="Restart Camera Stream"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Manual Barcode Input Fallback Drawer */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-400 font-bold">
                Manual Barcode / Serial Number Input:
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Press Enter to Auto-Fill</span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="e.g. 2102313ABC998102 or AST-ODU-11G-1029"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-cyan-300 text-xs focus:border-cyan-500 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!manualCodeInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs shadow transition-colors"
              >
                Auto-Populate
              </button>
            </div>
          </form>
        )}

        {/* Quick-Test Telecom Sample Barcodes Carousel */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              Demo Simulation: 1-Tap to Test Auto-Population:
            </span>
            <span className="text-[9.5px] font-mono text-slate-500">
              Site: {siteId || 'NS-TER25-A035'}
            </span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {demoSamples.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  playBeep();
                  stopScanner();
                  onScanSuccess(sample.data);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-600 text-left whitespace-nowrap transition-colors shrink-0 group shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Barcode className="w-3 h-3 text-cyan-400 group-hover:text-cyan-300" />
                  <span className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300">
                    {sample.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[9.5px] font-mono">
                  <span className="text-cyan-400">SN: {sample.data.serialNumber}</span>
                  <span className="text-slate-500">&bull;</span>
                  <span className="text-emerald-400">{sample.tag}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
