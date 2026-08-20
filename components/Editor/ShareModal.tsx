'use client';

import React, { useState, useEffect } from 'react';
import { DocumentItem, User, UserRole } from '@/lib/types';
import {
  X,
  UserPlus,
  Globe,
  Lock,
  Copy,
  Check,
  Shield,
  Trash2,
  AlertCircle
} from 'lucide-react';

interface ShareModalProps {
  document: DocumentItem;
  isOpen: boolean;
  onClose: () => void;
  onDocumentUpdated: (doc: DocumentItem) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  onDocumentUpdated
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('editor');
  const [isPublic, setIsPublic] = useState(doc.is_public === 1);
  const [publicRole, setPublicRole] = useState<UserRole>(doc.public_role || 'viewer');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/users')
        .then(res => res.json())
        .then(data => {
          if (data.users) {
            // Filter out the owner and already shared users
            const existingShareUserIds = doc.shares?.map(s => s.user_id) || [];
            const availableUsers = data.users.filter(
              (u: User) => u.id !== doc.owner_id && !existingShareUserIds.includes(u.id)
            );
            setUsers(availableUsers);
            if (availableUsers.length > 0) {
              setSelectedUserId(availableUsers[0].id);
            } else {
              setSelectedUserId('');
            }
          }
        });
      setIsPublic(doc.is_public === 1);
      setPublicRole(doc.public_role || 'viewer');
      setError(null);
    }
  }, [isOpen, doc]);

  if (!isOpen) return null;

  const handleAddShare = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${doc.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUserId,
          role: selectedRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to share document');
      }

      // Refresh document details
      const docRes = await fetch(`/api/documents/${doc.id}`);
      const docData = await docRes.json();
      if (docData.document) {
        onDocumentUpdated(docData.document);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShareRole = async (targetUserId: string, newRole: UserRole) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          role: newRole
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update permission');

      const docRes = await fetch(`/api/documents/${doc.id}`);
      const docData = await docRes.json();
      if (docData.document) {
        onDocumentUpdated(docData.document);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (targetUserId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/share?userId=${targetUserId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke access');

      const docRes = await fetch(`/api/documents/${doc.id}`);
      const docData = await docRes.json();
      if (docData.document) {
        onDocumentUpdated(docData.document);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsPublic(checked);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: checked ? 1 : 0,
          publicRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update public settings');
      if (data.document) {
        onDocumentUpdated(data.document);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublicRoleChange = async (role: UserRole) => {
    setPublicRole(role);
    if (!isPublic) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: 1,
          publicRole: role
        })
      });
      const data = await res.json();
      if (data.document) {
        onDocumentUpdated(data.document);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/doc/${doc.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Share Document</h3>
            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{doc.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add People */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Invite Teammates
            </label>
            {users.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role_title || u.email})
                    </option>
                  ))}
                </select>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value as UserRole)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shrink-0"
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddShare}
                  disabled={loading || !selectedUserId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Invite
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                All team members currently have access to this document.
              </p>
            )}
          </div>

          {/* People with access */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
              People with Access
            </label>
            <div className="space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
              {/* Document Owner */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: doc.owner_color || '#3b82f6' }}
                  >
                    {doc.owner_avatar || 'OW'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      {doc.owner_name}
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                        Owner
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">{doc.owner_email}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-medium px-2 py-1 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-slate-400" /> Full Access
                </div>
              </div>

              {/* Shared Collaborators */}
              {doc.shares && doc.shares.length > 0 ? (
                doc.shares.map(share => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-xs"
                        style={{ backgroundColor: share.user_color || '#64748b' }}
                      >
                        {share.user_avatar || 'U'}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {share.user_name}
                        </div>
                        <div className="text-[11px] text-slate-500">{share.user_email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={share.role}
                        onChange={e =>
                          handleUpdateShareRole(share.user_id, e.target.value as UserRole)
                        }
                        disabled={loading}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="editor">Can edit</option>
                        <option value="viewer">Can view</option>
                      </select>
                      <button
                        onClick={() => handleRemoveShare(share.user_id)}
                        disabled={loading}
                        title="Remove Access"
                        className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-3 text-xs text-slate-400">
                  No individual team members added yet.
                </div>
              )}
            </div>
          </div>

          {/* General Access / Link Sharing */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
              General Access
            </label>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl text-white ${isPublic ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                  {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {isPublic ? 'Anyone with the link' : 'Restricted'}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isPublic
                      ? 'Anyone on the internet with this link can access'
                      : 'Only people added above can open this document'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={handleTogglePublic}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>

                {isPublic && (
                  <select
                    value={publicRole}
                    onChange={e => handlePublicRoleChange(e.target.value as UserRole)}
                    className="text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-medium shadow-2xs hover:bg-slate-100 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied Link!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" /> Copy Link
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
