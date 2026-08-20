'use client';

import React, { useState, useEffect } from 'react';
import { DocumentItem, User } from '@/lib/types';
import {
  FileText,
  Plus,
  Search,
  Users,
  UserCheck,
  Globe,
  MoreVertical,
  Trash2,
  Share2,
  Copy,
  Download,
  Clock,
  Sparkles,
  FileUp,
  FolderOpen,
  ArrowUpRight,
  BookOpen,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImportModal } from './ImportModal';
import { ShareModal } from './Editor/ShareModal';

interface DocumentListProps {
  initialDocuments: DocumentItem[];
  currentUser: User;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  initialDocuments,
  currentUser
}) => {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeShareDoc, setActiveShareDoc] = useState<DocumentItem | null>(null);
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?filter=${filter}&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [filter, searchQuery]);

  // Real-time WebSocket listener for workspace and document access updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWs = () => {
      try {
        const wsHost = window.location.hostname || 'localhost';
        ws = new WebSocket(`ws://${wsHost}:1234/workspace-events?userId=${currentUser.id}`);

        ws.onmessage = () => {
          fetchDocuments();
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          try { ws?.close(); } catch {}
        };
      } catch {}
    };

    connectWs();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [currentUser.id]);

  const handleCreateDocument = async (template?: { title: string; content: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template?.title || 'Untitled Document',
          content: template?.content || '<p></p>'
        })
      });

      const data = await res.json();
      if (data.document) {
        router.push(`/doc/${data.document.id}`);
      }
    } catch (err) {
      console.error('Failed to create document:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch (err) {
      alert('Failed to delete document');
    }
  };

  const handleDuplicateDocument = async (doc: DocumentItem) => {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${doc.title} (Copy)`,
          content: doc.content
        })
      });
      const data = await res.json();
      if (data.document) {
        fetchDocuments();
      }
    } catch (err) {
      alert('Failed to duplicate document');
    }
  };

  const templates = [
    {
      id: 'blank',
      title: 'Blank Document',
      desc: 'Start with a clean slate',
      icon: Plus,
      color: 'from-blue-600 to-indigo-600',
      action: () => handleCreateDocument()
    },
    {
      id: 'prd',
      title: 'Product Requirements (PRD)',
      desc: 'Goals, user stories, and specs',
      icon: BookOpen,
      color: 'from-purple-600 to-pink-600',
      action: () =>
        handleCreateDocument({
          title: '📋 Product Requirements: Feature Launch',
          content: `
            <h1>📋 Product Requirements Document</h1>
            <h2>1. Problem Statement & Goals</h2>
            <p>Describe the core user problem and high-level objectives for this release.</p>
            <h2>2. Target Audience & User Stories</h2>
            <ul data-type="taskList">
              <li data-type="taskItem" data-checked="false">As a user, I want to create rich documents effortlessly.</li>
              <li data-type="taskItem" data-checked="false">As a collaborator, I want instant granular access control.</li>
            </ul>
            <h2>3. Key Metrics & Success Criteria</h2>
            <p>Outline measurable KPIs (adoption, retention, satisfaction).</p>
          `
        })
    },
    {
      id: 'meeting',
      title: 'Weekly Team Sync',
      desc: 'Agenda, decisions, and action items',
      icon: Users,
      color: 'from-emerald-600 to-teal-600',
      action: () =>
        handleCreateDocument({
          title: '🗓️ Weekly Team Sync Notes',
          content: `
            <h1>🗓️ Weekly Team Sync Notes</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <h2>🎯 Agenda</h2>
            <ul>
              <li>Key milestone status & blocker review</li>
              <li>Product architecture sync</li>
              <li>Design system alignment</li>
            </ul>
            <h2>✅ Action Items</h2>
            <ul data-type="taskList">
              <li data-type="taskItem" data-checked="false">Review PRD by end of week</li>
              <li data-type="taskItem" data-checked="false">Deploy preview environment</li>
            </ul>
          `
        })
    },
    {
      id: 'import',
      title: 'Import File (.docx / .md)',
      desc: 'Turn existing files into docs',
      icon: FileUp,
      color: 'from-amber-500 to-orange-500',
      action: () => setIsImportOpen(true)
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Hero / Quick Templates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Start a new document
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose a starting point or import your existing drafts
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={t.action}
                className="group relative text-left p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between h-32 cursor-pointer shadow-2xs"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${t.color} text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {t.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workspace Documents & Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl w-fit">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Documents
            </button>
            <button
              onClick={() => setFilter('owned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === 'owned'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Owned by me
            </button>
            <button
              onClick={() => setFilter('shared')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === 'shared'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shared with me
            </button>
          </div>

          {/* Search Bar & Import Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
              />
            </div>

            <button
              onClick={() => setIsImportOpen(true)}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-2xs hover:bg-slate-50 transition-colors shrink-0"
              title="Import file"
            >
              <FileUp className="w-3.5 h-3.5 text-slate-500" />
              <span>Import</span>
            </button>
          </div>
        </div>

        {/* Document Cards Grid */}
        {documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => {
              const isOwner = doc.is_owner;
              return (
                <div
                  key={doc.id}
                  className="group bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all p-5 flex flex-col justify-between relative shadow-2xs"
                >
                  <div>
                    {/* Top Row: Icon, Role Badge, Menu */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Link
                        href={`/doc/${doc.id}`}
                        className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"
                      >
                        <FileText className="w-5 h-5" />
                      </Link>

                      <div className="flex items-center gap-1.5">
                        {isOwner ? (
                          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                            Owner
                          </span>
                        ) : doc.can_edit ? (
                          <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                            Editor
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                            Viewer
                          </span>
                        )}

                        {/* Menu Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id)
                            }
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuDocId === doc.id && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setActiveMenuDocId(null)}
                              />
                              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-40 text-xs animate-in fade-in slide-in-from-top-1">
                                <Link
                                  href={`/doc/${doc.id}`}
                                  className="block px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
                                >
                                  Open Document
                                </Link>
                                {isOwner && (
                                  <button
                                    onClick={() => {
                                      setActiveMenuDocId(null);
                                      setActiveShareDoc(doc);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2"
                                  >
                                    <Share2 className="w-3.5 h-3.5 text-slate-400" /> Share
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setActiveMenuDocId(null);
                                    handleDuplicateDocument(doc);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-400" /> Duplicate
                                </button>
                                <a
                                  href={`/api/documents/${doc.id}/export?format=md`}
                                  download
                                  className="block px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
                                >
                                  Export Markdown
                                </a>
                                {isOwner && (
                                  <>
                                    <div className="border-t border-slate-100 my-1" />
                                    <button
                                      onClick={() => {
                                        setActiveMenuDocId(null);
                                        handleDeleteDocument(doc.id, doc.title);
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 font-medium flex items-center gap-2"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <Link href={`/doc/${doc.id}`} className="block">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {doc.content_plain || 'Empty document draft...'}
                      </p>
                    </Link>
                  </div>

                  {/* Bottom Row: Owner, Collaborators & Timestamp */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shadow-2xs shrink-0"
                        style={{ backgroundColor: doc.owner_color || '#3b82f6' }}
                        title={`Owner: ${doc.owner_name} (${doc.owner_email})`}
                      >
                        {doc.owner_avatar || 'O'}
                      </div>
                      <span className="text-[11px] text-slate-500 truncate max-w-[100px]">
                        {isOwner ? 'You' : doc.owner_name}
                      </span>
                    </div>

                    {/* Shares avatars */}
                    <div className="flex items-center gap-2">
                      {doc.shares && doc.shares.length > 0 && (
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {doc.shares.slice(0, 3).map(s => (
                            <div
                              key={s.id}
                              className="inline-block w-4 h-4 rounded-full ring-2 ring-white text-[8px] font-bold text-white flex items-center justify-center"
                              style={{ backgroundColor: s.user_color || '#64748b' }}
                              title={`Shared with: ${s.user_name} (${s.role})`}
                            >
                              {s.user_avatar}
                            </div>
                          ))}
                          {doc.shares.length > 3 && (
                            <div className="inline-block w-4 h-4 rounded-full bg-slate-200 ring-2 ring-white text-[8px] font-bold text-slate-600 flex items-center justify-center">
                              +{doc.shares.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      <span className="text-[10px] text-slate-400">
                        {new Date(doc.updated_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No documents found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery
                ? `No documents matching "${searchQuery}". Try a different search term.`
                : filter === 'shared'
                ? "No documents have been shared with you yet. Switch profiles to share one!"
                : "You haven't created any documents in this view yet."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => handleCreateDocument()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Create Document
              </button>
              <button
                onClick={() => setIsImportOpen(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <FileUp className="w-3.5 h-3.5" /> Import File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={docId => router.push(`/doc/${docId}`)}
      />

      {activeShareDoc && (
        <ShareModal
          document={activeShareDoc}
          isOpen={!!activeShareDoc}
          onClose={() => setActiveShareDoc(null)}
          onDocumentUpdated={updated => {
            setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
            setActiveShareDoc(updated);
          }}
        />
      )}
    </div>
  );
};
