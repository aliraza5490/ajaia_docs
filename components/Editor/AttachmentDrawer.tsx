'use client';

import React, { useState, useRef } from 'react';
import { DocumentAttachment } from '@/lib/types';
import {
  X,
  Paperclip,
  Upload,
  File,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Plus,
  AlertCircle
} from 'lucide-react';

interface AttachmentDrawerProps {
  documentId: string;
  attachments: DocumentAttachment[];
  canEdit: boolean;
  isOpen: boolean;
  onClose: () => void;
  onAttachmentsUpdated: (attachments: DocumentAttachment[]) => void;
  onInsertImageInline?: (url: string) => void;
}

export const AttachmentDrawer: React.FC<AttachmentDrawerProps> = ({
  documentId,
  attachments,
  canEdit,
  isOpen,
  onClose,
  onAttachmentsUpdated,
  onInsertImageInline
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('Attachment file size exceeds 10MB limit');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/documents/${documentId}/attachments`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload attachment');

      onAttachmentsUpdated([data.attachment, ...attachments]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to remove this attachment?')) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/documents/${documentId}/attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete attachment');

      onAttachmentsUpdated(attachments.filter(a => a.id !== attachmentId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Paperclip className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Attachments</h3>
            <p className="text-[11px] text-slate-500">
              {attachments.length} {attachments.length === 1 ? 'file' : 'files'} attached
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Button */}
        {canEdit && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-3 border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/80 rounded-xl text-xs font-medium text-blue-700 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{loading ? 'Uploading...' : 'Upload New Attachment'}</span>
            </button>
          </div>
        )}

        {/* Attachments List */}
        <div className="space-y-2">
          {attachments.length > 0 ? (
            attachments.map(att => {
              const isImage = att.filetype.startsWith('image/');
              return (
                <div
                  key={att.id}
                  className="p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                      {isImage ? (
                        <ImageIcon className="w-4 h-4 text-purple-600" />
                      ) : (
                        <File className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate" title={att.filename}>
                        {att.filename}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatFileSize(att.filesize)} • {new Date(att.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isImage && canEdit && onInsertImageInline && (
                      <button
                        onClick={() => onInsertImageInline(att.data_url)}
                        title="Insert into document"
                        className="p-1 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <a
                      href={att.data_url}
                      download={att.filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download / Open"
                      className="p-1 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {canEdit && (
                      <button
                        onClick={() => handleDelete(att.id)}
                        title="Delete attachment"
                        className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No files attached to this document yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
