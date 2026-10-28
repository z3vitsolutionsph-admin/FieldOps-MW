import React, { useState } from 'react';
import {
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Camera,
  FileText,
  Truck,
  ShieldAlert,
  ArrowRight,
  PenTool,
  Barcode,
  Sparkles,
  Plus,
  RefreshCw,
  Search,
  CheckSquare,
} from 'lucide-react';
import { InventoryItem, Site, UserProfile } from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { BarcodeScannerModal, ScannedEquipmentData } from './BarcodeScannerModal';

interface DismantlingModuleProps {
  site: Site;
  activeUser: UserProfile;
  inventory: InventoryItem[];
  sunlightMode: boolean;
}

export const DismantlingModule: React.FC<DismantlingModuleProps> = ({
  site,
  activeUser,
  inventory,
  sunlightMode,
}) => {
  const [preChecks, setPreChecks] = useState({
    nocClearance: true,
    nocTicketNo: 'NOC-2026-MIGRATE-9941',
    trafficMigrated: true,
    lotoPowerIsolated: true,
    breakerTaggedOut: true,
  });

  const [teardownSteps, setTeardownSteps] = useState({
    oduDismantled: true,
    antennaLowered: true,
    ifCablesCoiled: false,
    iduDecommissioned: true,
    groundingLugsRemoved: false,
    ambPipeRecovered: false,
  });

  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [scanSuccessBanner, setScanSuccessBanner] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    equipmentType: 'ODU',
    model: 'G11H3DD2-3-B-AM-482M (11GHz)',
    serialNumber: '',
    assetTag: '',
    condition: 'GOOD',
    status: 'DISMANTLED_PENDING_RETURN',
    destinationWarehouse: 'Cagayan De Oro Regional Warehouse',
  });

  const [chainOfCustodySigned, setChainOfCustodySigned] = useState(false);

  // Auto-populate equipment data upon successful barcode/QR camera scan
  const handleScanCompleted = (scanned: ScannedEquipmentData) => {
    // If scanned item matched an existing registered inventory item
    if (scanned.existingItemId) {
      setEditingItemId(scanned.existingItemId);
    }

    setNewItem((prev) => ({
      ...prev,
      id: scanned.existingItemId || prev.id,
      serialNumber: scanned.serialNumber,
      assetTag: scanned.assetTag,
      equipmentType: scanned.equipmentType || prev.equipmentType || 'ODU',
      model: scanned.model || prev.model || 'RTN 950 ODU',
      condition: scanned.condition || prev.condition || 'GOOD',
      status: 'DISMANTLED_PENDING_RETURN',
    }));

    setShowScannerModal(false);
    setShowAddModal(true);
    setScanSuccessBanner(
      `Auto-Populated from Camera Scan: SN ${scanned.serialNumber} & Asset Tag ${scanned.assetTag}${
        scanned.matchedFromInventory ? ' (Matched Site Inventory)' : ''
      }`
    );
  };

  const handleStartScanForItem = (item?: InventoryItem) => {
    if (item) {
      setEditingItemId(item.id);
      setNewItem({
        id: item.id,
        equipmentType: item.equipmentType,
        model: item.model,
        serialNumber: item.serialNumber,
        assetTag: item.assetTag,
        condition: item.condition,
        status: 'DISMANTLED_PENDING_RETURN',
        destinationWarehouse: item.destinationWarehouse || 'Cagayan De Oro Regional Warehouse',
      });
    } else {
      setEditingItemId(null);
    }
    setShowScannerModal(true);
  };

  const handleAddItem = () => {
    if (!newItem.serialNumber || !newItem.assetTag) {
      alert('Please enter or scan Serial Number and Asset Tag.');
      return;
    }

    const targetId = editingItemId || newItem.id || 'inv_ret_' + Date.now();
    const item: InventoryItem = {
      id: targetId,
      orgId: activeUser.orgId,
      siteId: site.id,
      equipmentType: newItem.equipmentType || 'ODU',
      model: newItem.model || 'RTN 950 ODU',
      serialNumber: newItem.serialNumber,
      assetTag: newItem.assetTag,
      condition: newItem.condition || 'GOOD',
      status: newItem.status || 'DISMANTLED_PENDING_RETURN',
      destinationWarehouse: newItem.destinationWarehouse || 'Cagayan De Oro Regional Warehouse',
      chainOfCustodySigner: activeUser.name,
      removalDate: new Date().toISOString().split('T')[0],
      notes: newItem.notes || 'Dismantled per swap order & verified via Barcode Scanner',
    };

    storage.saveInventoryItem(item);
    setShowAddModal(false);
    setEditingItemId(null);

    setScanSuccessBanner(
      `✓ Successfully Logged for Return: ${item.equipmentType} (SN: ${item.serialNumber}) -> ${item.destinationWarehouse}`
    );

    setNewItem({
      equipmentType: 'ODU',
      model: 'G11H3DD2-3-B-AM-482M (11GHz)',
      serialNumber: '',
      assetTag: '',
      condition: 'GOOD',
      status: 'DISMANTLED_PENDING_RETURN',
      destinationWarehouse: 'Cagayan De Oro Regional Warehouse',
    });
  };

  const handleQuickDispatch = (item: InventoryItem) => {
    const updated: InventoryItem = {
      ...item,
      status: 'RETURNED_TO_WAREHOUSE',
      chainOfCustodySigner: activeUser.name,
    };
    storage.saveInventoryItem(updated);
    setScanSuccessBanner(
      `✓ Dispatched to Depot: ${item.equipmentType} (${item.assetTag}) marked as RETURNED_TO_WAREHOUSE`
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          sunlightMode
            ? 'bg-amber-50 border-amber-400 text-black'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Module 2: Microwave Link Dismantling</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Safe teardown protocol, NOC traffic migration, and barcode-scanned equipment return chain of custody.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartScanForItem()}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span>Scan QR / Barcode</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanSuccessBanner(null);
              setEditingItemId(null);
              setShowAddModal(true);
            }}
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Return</span>
          </button>
        </div>
      </div>

      {/* Pre-Teardown Authorizations */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          1. Mandatory NOC Clearances & Power Isolation
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preChecks.nocClearance}
                onChange={(e) => setPreChecks({ ...preChecks, nocClearance: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 bg-slate-900 border-slate-700"
              />
              <span className="font-bold text-slate-200">NOC De-Commissioning Clearance</span>
            </label>
            <input
              type="text"
              placeholder="NOC Ticket No."
              value={preChecks.nocTicketNo}
              onChange={(e) => setPreChecks({ ...preChecks, nocTicketNo: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-400 text-xs"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preChecks.trafficMigrated}
                onChange={(e) => setPreChecks({ ...preChecks, trafficMigrated: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 bg-slate-900 border-slate-700"
              />
              <span className="font-bold text-slate-200">Customer Traffic Migrated / Rerouted</span>
            </label>
            <p className="text-xs text-slate-400">
              Confirmed 0 bps active payload with Core Network Operations before breaking RF path.
            </p>
          </div>
        </div>
      </div>

      {/* Staged Teardown Checklist */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white">2. Staged Teardown Sequence</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {[
            { key: 'oduDismantled', label: 'ODU Unlatched & Lowered with Rigging Rope' },
            { key: 'antennaLowered', label: 'Antenna Dish & AMB Struts Rigged & Lowered' },
            { key: 'ifCablesCoiled', label: 'IF Coaxial Cables De-clamped & Neatly Coiled' },
            { key: 'iduDecommissioned', label: 'IDU Subrack Removed from 19" Shelf' },
            { key: 'groundingLugsRemoved', label: 'Busbar Grounding Lugs Removed & Restored' },
            { key: 'ambPipeRecovered', label: 'AMB Steel Pipe & Clamps Inspected for Reuse' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={(teardownSteps as any)[item.key]}
                onChange={(e) =>
                  setTeardownSteps({ ...teardownSteps, [item.key]: e.target.checked })
                }
                className="w-4 h-4 rounded text-amber-600 bg-slate-900 border-slate-700"
              />
              <span className="text-slate-200">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 3. INVENTORY RETURN LEDGER & BARCODE SCANNER SECTION */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                3. Dismantled Equipment Return Ledger & Inventory Custody
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Scan equipment QR codes or barcodes with mobile camera to automatically populate serial numbers and asset tags.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStartScanForItem()}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/60 transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Scan Barcode / QR (Camera)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScanSuccessBanner(null);
                setEditingItemId(null);
                setShowAddModal(true);
              }}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 border border-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Manual Return</span>
            </button>
          </div>
        </div>

        {/* Scan Feedback Banner */}
        {scanSuccessBanner && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between gap-2 animate-fadeIn font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{scanSuccessBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setScanSuccessBanner(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Serial No</th>
                <th className="py-2.5 px-3">Asset Tag</th>
                <th className="py-2.5 px-3">Condition</th>
                <th className="py-2.5 px-3">Warehouse</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Barcode Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {inventory.map((item) => {
                const isPendingReturn = item.status === 'DISMANTLED_PENDING_RETURN';
                const isReturned = item.status === 'RETURNED_TO_WAREHOUSE';

                return (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white">{item.equipmentType}</td>
                    <td className="py-2.5 px-3 text-slate-300">{item.model}</td>
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">{item.serialNumber}</td>
                    <td className="py-2.5 px-3 text-slate-400">{item.assetTag}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          item.condition === 'GOOD'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : item.condition === 'DAMAGED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {item.condition}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 text-xs font-sans">
                      {item.destinationWarehouse || 'Regional Depot'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          isReturned
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : isPendingReturn
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartScanForItem(item)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-900/60 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-600 flex items-center gap-1 text-xs transition-colors"
                          title="Scan / Verify barcode physically on hardware"
                        >
                          <Barcode className="w-3 h-3 text-cyan-400" />
                          <span>Scan</span>
                        </button>

                        {isPendingReturn && (
                          <button
                            type="button"
                            onClick={() => handleQuickDispatch(item)}
                            className="px-2 py-1 rounded bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 hover:text-white border border-emerald-700 flex items-center gap-1 text-xs transition-colors"
                            title="Dispatch to Depot"
                          >
                            <Truck className="w-3 h-3" />
                            <span>Dispatch</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Chain of Custody E-Sign */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Chain of Custody Transferred By:{' '}
            <strong className="text-white">{activeUser.name}</strong> ({activeUser.role})
          </div>
          <button
            type="button"
            onClick={() => {
              setChainOfCustodySigned(true);
              alert(`Chain of Custody Handover Certificate certified by ${activeUser.name}!`);
            }}
            disabled={chainOfCustodySigned}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow transition-colors ${
              chainOfCustodySigned
                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {chainOfCustodySigned ? '✓ Handover Signed' : 'Sign Chain of Custody'}
          </button>
        </div>
      </div>

      {/* Add / Return Item Modal with Barcode Scanner Shortcuts */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-3.5 text-xs text-slate-200 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  Log Dismantled Equipment Return
                </h3>
                <p className="text-xs text-slate-400">
                  {editingItemId ? 'Update existing site asset return' : 'Register dismantled hardware for warehouse return'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Scan with Camera Trigger Button */}
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/80 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-cyan-300 block text-xs">
                  Scan Barcode with Camera
                </span>
                <span className="text-xs text-slate-400">
                  Auto-fills Serial Number, Asset Tag, and Model
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowScannerModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Open Scanner</span>
              </button>
            </div>

            {/* Equipment Category */}
            <div>
              <label className="text-slate-400 block mb-1 font-mono text-xs">
                EQUIPMENT CATEGORY:
              </label>
              <select
                value={newItem.equipmentType}
                onChange={(e) => setNewItem({ ...newItem, equipmentType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-medium"
              >
                <option value="ODU">Outdoor Unit (ODU 11GHz)</option>
                <option value="Antenna">Antenna Dish (1.2m MA12U10W)</option>
                <option value="IDU">Indoor Unit (IDU OptiX RTN 9150)</option>
                <option value="AMB">AMB Pipe & Clamps</option>
                <option value="IF_Cable">IF Coaxial Cable Spool</option>
                <option value="Rectifier">Rectifier Module (-48V)</option>
              </select>
            </div>

            {/* Serial Number with Scan Shortcut */}
            <div>
              <div className="flex items-center justify-between mb-1 font-mono text-xs">
                <label className="text-slate-400">SERIAL NUMBER (SN):</label>
                <button
                  type="button"
                  onClick={() => setShowScannerModal(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono font-bold"
                >
                  <Barcode className="w-3 h-3" />
                  Scan Barcode
                </button>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Scan barcode or enter serial number..."
                  value={newItem.serialNumber || ''}
                  onChange={(e) => setNewItem({ ...newItem, serialNumber: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-cyan-300 text-xs focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowScannerModal(true)}
                  className="px-3 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-1 shadow"
                  title="Scan with Camera"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Asset Tag */}
            <div>
              <label className="text-slate-400 block mb-1 font-mono text-xs">
                ASSET TAG:
              </label>
              <input
                type="text"
                placeholder="AST-..."
                value={newItem.assetTag || ''}
                onChange={(e) => setNewItem({ ...newItem, assetTag: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-white text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Equipment Model */}
            <div>
              <label className="text-slate-400 block mb-1 font-mono text-xs">
                EQUIPMENT MODEL / DESCRIPTION:
              </label>
              <input
                type="text"
                placeholder="e.g. Huawei OptiX RTN 9150"
                value={newItem.model || ''}
                onChange={(e) => setNewItem({ ...newItem, model: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>

            {/* Condition and Destination Warehouse */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-xs">CONDITION:</label>
                <select
                  value={newItem.condition}
                  onChange={(e) => setNewItem({ ...newItem, condition: e.target.value as any })}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="GOOD">Good / Reusable</option>
                  <option value="DAMAGED">Damaged / RMA</option>
                  <option value="MISSING">Missing Parts</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono text-xs">DESTINATION WAREHOUSE:</label>
                <select
                  value={newItem.destinationWarehouse}
                  onChange={(e) => setNewItem({ ...newItem, destinationWarehouse: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="Cagayan De Oro Regional Warehouse">CDO Regional Depot</option>
                  <option value="Surigao City Transit Depot">Surigao Transit Depot</option>
                  <option value="Davao Central Logistics Hub">Davao Central Hub</option>
                </select>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItemId(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-white shadow shadow-cyan-950/60"
              >
                Save Return Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode / QR Scanner Modal Component */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={handleScanCompleted}
        inventoryItems={inventory}
        siteId={site.id}
      />
    </div>
  );
};
