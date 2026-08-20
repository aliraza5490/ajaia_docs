'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (documentId: string) => void;
  currentDocumentId?: string;
  onInsertContent?: (html: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  currentDocumentId,
  onInsertContent
}) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; html: string; plainText: string } | null>(
    null
  );

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!['txt', 'md', 'markdown', 'docx'].includes(ext || '')) {
      setError(`Unsupported file format ".${ext}". Please choose a .docx, .md, or .txt file.`);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setLoading(true);

    // Fetch parse preview
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'parse_only');

      const res = await fetch('/api/documents/import', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse file');

      setPreview(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleCreateDocument = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mode', 'create');

      const res = await fetch('/api/documents/import', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import document');

      onClose();
      if (onImportSuccess) {
        onImportSuccess(data.document.id);
      } else {
        router.push(`/doc/${data.document.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInsertIntoCurrent = () => {
    if (preview && onInsertContent) {
      onInsertContent(preview.html);
      onClose();
    }
  };

  const loadSampleFile = async (type: 'md' | 'txt') => {
    setLoading(true);
    setError(null);
    try {
      let sampleText = '';
      let filename = '';

      if (type === 'md') {
        filename = 'Sample_Product_Specification.md';
        sampleText = `# 📱 Mobile App Offline Sync Specification

## Overview
This feature allows users to continue editing documents while disconnected from the internet and automatically syncs changes once network connectivity is restored.

### Core Requirements
- **Local Cache**: Store document state in client-side IndexedDB.
- **Conflict Resolution**: Last-write-wins with automated visual diffs.
- **Background Sync**: Use Service Worker background sync when available.

> *Target Milestone: Q4 Release*
`;
      } else {
        filename = 'Sprint_Retrospective_Notes.txt';
        sampleText = `Sprint 42 Retrospective Notes\n\nWhat went well:\n- TipTap editor migration went smoothly\n- Zero downtime deployment\n\nWhat could be improved:\n- Faster test suite execution\n- More end-to-end integration coverage`;
      }

      const blob = new Blob([sampleText], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      handleFiles([file] as unknown as FileList);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Import File to Document</h3>
              <p className="text-xs text-slate-500">
                Convert your local documents into rich, editable drafts
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

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!preview ? (
            <>
              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.md,.markdown,.txt"
                  className="hidden"
                  onChange={e => handleFiles(e.target.files)}
                />

                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">
                  Click to browse or drag and drop file
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats:{' '}
                  <span className="font-medium text-slate-700">.docx</span>,{' '}
                  <span className="font-medium text-slate-700">.md</span>,{' '}
                  <span className="font-medium text-slate-700">.txt</span> (Max 15MB)
                </p>
              </div>

              {/* Sample Files Quick Demo */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Quick Demo Files
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => loadSampleFile('md')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/40 transition-colors text-left flex items-start gap-2.5 text-xs group"
                  >
                    <FileCode className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-800 group-hover:text-blue-700">
                        Product Spec (.md)
                      </div>
                      <div className="text-[10px] text-slate-400">Headings, lists, quote</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadSampleFile('txt')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/40 transition-colors text-left flex items-start gap-2.5 text-xs group"
                  >
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-800 group-hover:text-blue-700">
                        Sprint Retro (.txt)
                      </div>
                      <div className="text-[10px] text-slate-400">Formatted plaintext</div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Preview State */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium">File parsed successfully:</span>
                  <span className="font-semibold">{selectedFile?.name}</span>
                </div>
                <button
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                  className="text-xs text-emerald-700 underline hover:text-emerald-900"
                >
                  Choose another
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Extracted Document Title
                </label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800">
                  {preview.title}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Content Preview
                </label>
                <div
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 max-h-48 overflow-y-auto ProseMirror"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            Cancel
          </button>

          {preview && currentDocumentId && onInsertContent && (
            <button
              onClick={handleInsertIntoCurrent}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-medium transition-colors"
            >
              Insert at Cursor
            </button>
          )}

          {preview && (
            <button
              onClick={handleCreateDocument}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>Create as New Document</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
