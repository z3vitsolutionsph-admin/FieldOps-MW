import React, { useState, useEffect } from 'react';
import {
  FileText,
  Layers,
  Database,
  Cpu,
  Clock,
  Shield,
  CheckCircle2,
  Plus,
  Copy,
  Check,
  X,
  Code,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { appBlueprintService, AppBlueprint, ChangelogEntry } from '../../services/appBlueprintService';

interface AppBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppBlueprintModal: React.FC<AppBlueprintModalProps> = ({ isOpen, onClose }) => {
  const [blueprint, setBlueprint] = useState<AppBlueprint>(appBlueprintService.getBlueprint());
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ARCHITECTURE' | 'MODULES' | 'CHANGELOG'>('OVERVIEW');
  const [copied, setCopied] = useState(false);
  const [showAddLogModal, setShowAddLogModal] = useState(false);

  // New changelog form state
  const [newTitle, setNewTitle] = useState('');
  const [newVersion, setNewVersion] = useState('2.5.1');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<ChangelogEntry['category']>('FEATURE');
  const [newAuthor, setNewAuthor] = useState('Senior Full-Stack Developer');

  useEffect(() => {
    const unsubscribe = appBlueprintService.subscribe(() => {
      setBlueprint(appBlueprintService.getBlueprint());
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    appBlueprintService.logUpdate({
      version: newVersion,
      title: newTitle.trim(),
      description: newDescription.trim(),
      category: newCategory,
      author: newAuthor.trim() || 'Senior Full-Stack Developer'
    });

    setNewTitle('');
    setNewDescription('');
    setShowAddLogModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                  Application Blueprint & Auto-Changelog
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                  {blueprint.version}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Autonomous system documentation, architecture blueprint, and real-time update tracker.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              title="Copy JSON Blueprint"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied JSON' : 'Export JSON'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-6">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'OVERVIEW'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Overview & Features</span>
          </button>
          <button
            onClick={() => setActiveTab('ARCHITECTURE')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'ARCHITECTURE'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Architecture & Schema</span>
          </button>
          <button
            onClick={() => setActiveTab('MODULES')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'MODULES'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Core Modules</span>
          </button>
          <button
            onClick={() => setActiveTab('CHANGELOG')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'CHANGELOG'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Changelog ({blueprint.changelog.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wide mb-2">
                  System Purpose & Scope
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {blueprint.description}
                </p>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
                  <div>
                    <span className="text-xs text-slate-500 block uppercase font-mono">Code Name</span>
                    <span className="text-xs font-mono font-bold text-slate-200">{blueprint.codeName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block uppercase font-mono">Current Version</span>
                    <span className="text-xs font-mono font-bold text-cyan-400">{blueprint.version}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block uppercase font-mono">Last Updated</span>
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {new Date(blueprint.lastUpdated).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block uppercase font-mono">Role</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">Senior Full-Stack Architect</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Recent Feature Highlights</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {blueprint.recentFeatures.map((feat, idx) => (
                    <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-cyan-300">{feat.title}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {feat.implementedAt}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{feat.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ARCHITECTURE' && (
            <div className="space-y-6">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wide mb-3">
                  Technical Stack & Architecture
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
                    <span className="text-xs text-slate-400 block font-mono">Frontend Framework</span>
                    <span className="text-sm font-semibold text-slate-100">{blueprint.architecture.frontend}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
                    <span className="text-xs text-slate-400 block font-mono">State Management</span>
                    <span className="text-sm font-semibold text-slate-100">{blueprint.architecture.stateManagement}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
                    <span className="text-xs text-slate-400 block font-mono">Local Storage & Persistence</span>
                    <span className="text-sm font-semibold text-slate-100">{blueprint.architecture.storage}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
                    <span className="text-xs text-slate-400 block font-mono">Offline Sync & Queue</span>
                    <span className="text-sm font-semibold text-slate-100">{blueprint.architecture.offlineSync}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
                    <span className="text-xs text-slate-400 block font-mono">Styling & UI</span>
                    <span className="text-sm font-semibold text-slate-100">{blueprint.architecture.styling}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
                    <span className="text-xs text-slate-400 block font-mono">Build Tool & Engine</span>
                    <span className="text-sm font-semibold text-slate-100">{blueprint.architecture.buildTool}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wide mb-3">
                  Database & Storage Schema
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <span className="text-xs font-bold text-slate-200 block mb-2 font-mono">IndexedDB Tables</span>
                    <ul className="space-y-1">
                      {blueprint.databaseSchema.indexedDBTables.map((tbl, idx) => (
                        <li key={idx} className="text-xs font-mono text-cyan-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                          <span>{tbl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <span className="text-xs font-bold text-slate-200 block mb-2 font-mono">Firestore Collections</span>
                    <ul className="space-y-1">
                      {blueprint.databaseSchema.firestoreCollections.map((col, idx) => (
                        <li key={idx} className="text-xs font-mono text-emerald-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{col}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <span className="text-xs font-bold text-slate-200 block mb-2 font-mono">Offline Queue Actions</span>
                    <ul className="space-y-1">
                      {blueprint.databaseSchema.offlineQueueActions.map((act, idx) => (
                        <li key={idx} className="text-xs font-mono text-amber-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'MODULES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {blueprint.modules.map((mod) => (
                <div key={mod.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-cyan-300">{mod.name}</h4>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                        mod.status === 'ENHANCED' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {mod.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">{mod.description}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-800/80">
                    <span className="text-xs uppercase font-mono text-slate-500 block mb-1.5">Key Components</span>
                    <div className="flex flex-wrap gap-1.5">
                      {mod.keyComponents.map((comp, idx) => (
                        <span key={idx} className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'CHANGELOG' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">
                  Complete chronological version update history & change tracking.
                </span>
                <button
                  onClick={() => setShowAddLogModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-colors shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log New Update</span>
                </button>
              </div>

              <div className="space-y-3">
                {blueprint.changelog.map((entry) => (
                  <div key={entry.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                          entry.category === 'FEATURE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                          entry.category === 'ARCHITECTURE' ? 'bg-purple-950 text-purple-400 border border-purple-800' :
                          'bg-cyan-950 text-cyan-400 border border-cyan-800'
                        }`}>
                          {entry.category}
                        </span>
                        <span className="text-sm font-bold text-slate-100">{entry.title}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400">v{entry.version}</span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">{entry.description}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-2 border-t border-slate-900">
                      <span>Author: {entry.author}</span>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Autonomous Blueprint Engine • FieldOps MW Enterprise</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Close Blueprint
          </button>
        </div>
      </div>

      {/* Add Changelog Modal */}
      {showAddLogModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/90 p-4">
          <form onSubmit={handleAddLog} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">
              Log New Application Update
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Update Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Added Satellite Uplink Telemetry"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Version</label>
                <input
                  type="text"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ChangelogEntry['category'])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="FEATURE">FEATURE</option>
                  <option value="BUGFIX">BUGFIX</option>
                  <option value="OPTIMIZATION">OPTIMIZATION</option>
                  <option value="SECURITY">SECURITY</option>
                  <option value="ARCHITECTURE">ARCHITECTURE</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detailed summary of changes..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Author</label>
              <input
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddLogModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow"
              >
                Save & Update Blueprint
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
