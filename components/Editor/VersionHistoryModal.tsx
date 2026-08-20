'use client';

import React, { useState, useEffect } from 'react';
import { DocumentVersion } from '@/lib/types';
import {
  X,
  History,
  RotateCcw,
  Clock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface VersionHistoryModalProps {
  documentId: string;
  isOpen: boolean;
  canEdit: boolean;
  onClose: () => void;
  onVersionRestored: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  documentId,
  isOpen,
  canEdit,
  onClose,
  onVersionRestored
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      fetch(`/api/documents/${documentId}/versions`)
        .then(res => res.json())
        .then(data => {
          if (data.versions) {
            setVersions(data.versions);
            if (data.versions.length > 0) {
              setSelectedVersion(data.versions[0]);
            }
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleRestore = async () => {
    if (!selectedVersion) return;
    if (!confirm('Are you sure you want to restore this document version? Current unsaved edits will be replaced.')) {
      return;
    }

    setRestoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: selectedVersion.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore version');

      onVersionRestored();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Version History</h3>
              <p className="text-xs text-slate-500">
                View past snapshots and restore previous revisions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version List Sidebar */}
          <div className="w-72 border-r border-slate-200 bg-slate-50/50 overflow-y-auto p-3 space-y-1.5 shrink-0">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
              Snapshots ({versions.length})
            </div>

            {loading ? (
              <div className="text-xs text-slate-400 text-center py-6">Loading versions...</div>
            ) : versions.length > 0 ? (
              versions.map((ver, idx) => {
                const isSelected = selectedVersion?.id === ver.id;
                return (
                  <button
                    key={ver.id}
                    onClick={() => setSelectedVersion(ver)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-200 shadow-xs text-blue-950'
                        : 'bg-white border-slate-200/70 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="truncate">{ver.version_title || `Snapshot #${versions.length - idx}`}</span>
                      {idx === 0 && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-medium">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(ver.created_at).toLocaleString()}</span>
                    </div>
                    {ver.saved_by_name && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                        <UserIcon className="w-3 h-3" />
                        <span>Saved by {ver.saved_by_name}</span>
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 text-center py-6">
                No versions recorded yet.
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedVersion ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">
                      {selectedVersion.version_title || 'Version Preview'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Recorded on {new Date(selectedVersion.created_at).toLocaleString()}
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      onClick={handleRestore}
                      disabled={restoring}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{restoring ? 'Restoring...' : 'Restore This Version'}</span>
                    </button>
                  )}
                </div>

                <div
                  className="ProseMirror text-sm"
                  dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                Select a version from the left sidebar to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
