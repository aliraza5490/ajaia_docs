'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import { DocumentItem, User } from '@/lib/types';
import { EditorToolbar } from './EditorToolbar';
import { ShareModal } from './ShareModal';
import { AttachmentDrawer } from './AttachmentDrawer';
import { VersionHistoryModal } from './VersionHistoryModal';
import { ImportModal } from '../ImportModal';
import { Navbar } from '../Navbar';

import {
  ArrowLeft,
  Share2,
  Paperclip,
  History,
  Download,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  Eye,
  Edit3,
  Globe,
  Lock,
  MoreVertical,
  Trash2,
  Copy,
  Printer,
  Sparkles,
  FileUp,
  Clock,
  Wifi,
  WifiOff,
  Users
} from 'lucide-react';
import LinkNext from 'next/link';
import { useRouter } from 'next/navigation';

import * as decoding from 'lib0/decoding';
import { MESSAGE_DOCUMENT_RECORD_UPDATE } from '@/lib/ws-notify';

interface DocumentEditorProps {
  initialDocument: DocumentItem;
  currentUser: User;
}

interface OnlineUser {
  clientId: number;
  name: string;
  color: string;
  avatar?: string;
  role?: string;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  initialDocument,
  currentUser
}) => {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentItem>(initialDocument);
  const [title, setTitle] = useState(initialDocument.title);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date>(new Date(initialDocument.updated_at));
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [onlineCollaborators, setOnlineCollaborators] = useState<OnlineUser[]>([]);

  // Modals & Panels state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Auto-save debounce timer ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canEdit = doc.can_edit ?? true;

  const [ydoc] = useState<Y.Doc>(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  // Initialize Yjs WebSocket Provider with proper lifecycle cleanup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const docChannelName = `doc-${initialDocument.id}`;
    const wsHost = window.location.hostname || 'localhost';
    const wsUrl = `ws://${wsHost}:1234`;

    const wsProvider = new WebsocketProvider(
      wsUrl,
      docChannelName,
      ydoc,
      {
        connect: true,
        params: {
          userId: currentUser.id,
          name: currentUser.name,
          color: currentUser.color || '#2563eb',
          avatar: currentUser.avatar || 'U',
          role: currentUser.role_title || 'editor'
        }
      }
    );

    // Register custom message handler on wsProvider for real-time document record / access updates
    if (wsProvider.messageHandlers) {
      wsProvider.messageHandlers[MESSAGE_DOCUMENT_RECORD_UPDATE] = (
        encoder,
        decoder,
        providerInstance,
        emitSynced,
        messageType
      ) => {
        try {
          const payloadStr = decoding.readVarString(decoder);
          const payload = JSON.parse(payloadStr);
          (providerInstance as any).emit('document-access-updated', [payload]);
        } catch (err) {
          console.error('Failed to parse document access update message:', err);
        }
      };
    }

    // Native BroadcastChannel for zero-latency local multi-tab/multi-window sync
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(`ajaia-${docChannelName}`);

      // Broadcast local doc updates to other tabs
      ydoc.on('update', (update, origin) => {
        if (origin !== 'broadcast') {
          bc?.postMessage({ type: 'sync', update: Array.from(update) });
        }
      });

      // Receive updates from other tabs
      bc.onmessage = (event) => {
        if (event.data?.type === 'sync' && event.data.update) {
          Y.applyUpdate(ydoc, new Uint8Array(event.data.update), 'broadcast');
        } else if (event.data?.type === 'document-access-updated') {
          (wsProvider as any).emit('document-access-updated', [event.data.payload]);
        }
      };
    }

    setProvider(wsProvider);

    return () => {
      if (bc) {
        bc.close();
      }
      try {
        if (wsProvider.awareness) {
          wsProvider.awareness.destroy();
        }
        wsProvider.disconnect();
        wsProvider.destroy();
      } catch (err) {
        console.error('Error cleaning up WebsocketProvider:', err);
      }
    };
  }, [initialDocument.id, currentUser.id, ydoc]);

  // Clean up ydoc on unmount
  useEffect(() => {
    return () => {
      try {
        ydoc.destroy();
      } catch {}
    };
  }, [ydoc]);

  // Update awareness when user profile changes
  useEffect(() => {
    if (!provider?.awareness) return;

    provider.awareness.setLocalStateField('user', {
      name: currentUser.name,
      color: currentUser.color || '#2563eb',
      avatar: currentUser.avatar || 'U',
      role: currentUser.role_title
    });
  }, [provider, currentUser]);

  // Monitor WebSocket & Awareness status
  useEffect(() => {
    if (!provider) return;

    const onStatus = (event: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setIsWsConnected(event.status === 'connected');
    };

    const onAwarenessChange = () => {
      const states = provider.awareness.getStates();
      const users: OnlineUser[] = [];
      states.forEach((state: any, clientId: number) => {
        if (state.user) {
          users.push({
            clientId,
            name: state.user.name || 'Anonymous',
            color: state.user.color || '#2563eb',
            avatar: state.user.avatar || 'U',
            role: state.user.role
          });
        }
      });
      setOnlineCollaborators(users);
    };

    provider.on('status', onStatus);
    provider.awareness.on('change', onAwarenessChange);
    onAwarenessChange();

    return () => {
      provider.off('status', onStatus);
      provider.awareness.off('change', onAwarenessChange);
    };
  }, [provider]);

  // Listen for real-time document access / record updates from WebSocket
  useEffect(() => {
    if (!provider) return;

    const handleAccessUpdated = async (payload: any) => {
      console.log('[Collab] Received document access update notification via WebSocket:', payload);
      try {
        const res = await fetch(`/api/documents/${doc.id}`);
        const data = await res.json();
        if (!res.ok || !data.document) {
          if (
            res.status === 401 ||
            res.status === 403 ||
            res.status === 404 ||
            data.error?.includes('access denied') ||
            data.error?.includes('Permission denied') ||
            data.error?.includes('not found')
          ) {
            router.push('/');
          }
          return;
        }

        setDoc(data.document);
        if (data.document.title && data.document.title !== title) {
          setTitle(data.document.title);
        }
      } catch (err) {
        console.error('Failed to fetch updated document after access change:', err);
      }
    };

    (provider as any).on('document-access-updated', handleAccessUpdated);

    return () => {
      (provider as any).off('document-access-updated', handleAccessUpdated);
    };
  }, [provider, doc.id, title, router]);

  // Initialize TipTap Editor with Yjs Collaboration
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false, // Yjs handles undo/redo collaboration history
          link: false,
          heading: {
            levels: [1, 2, 3]
          }
        }),
        Placeholder.configure({
          placeholder: 'Write your thoughts, draft specs, or collaborate in real time...'
        }),
        TaskList,
        TaskItem.configure({
          nested: true
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-blue-600 underline hover:text-blue-800'
          }
        }),
        Image.configure({
          inline: true,
          allowBase64: true
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph']
        }),
        Highlight.configure({
          multicolor: true
        }),
        ...(ydoc
          ? [
              Collaboration.configure({
                document: ydoc
              }),
              ...(provider
                ? [
                    CollaborationCursor.configure({
                      provider: provider,
                      user: {
                        name: currentUser.name,
                        color: currentUser.color || '#2563eb'
                      }
                    })
                  ]
                : [])
            ]
          : [])
      ],
      content: doc.content,
      editable: canEdit,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        if (!canEdit) return;
        setSaveStatus('unsaved');

        // Debounced save to SQLite for permanent persistence
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          saveDocumentContent(editor.getHTML());
        }, 1000);
      }
    },
    [ydoc, provider]
  );

  // Keep editor editable state in sync with permissions
  useEffect(() => {
    if (editor) {
      editor.setEditable(canEdit);
    }
  }, [editor, canEdit]);

  // Save content to SQLite backend
  const saveDocumentContent = async (htmlContent: string, createSnapshot: boolean = false) => {
    if (!canEdit) return;
    setSaveStatus('saving');

    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: htmlContent,
          createSnapshot
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (
          res.status === 401 ||
          res.status === 403 ||
          res.status === 404 ||
          data.error?.includes('access denied') ||
          data.error?.includes('Permission denied') ||
          data.error?.includes('not found')
        ) {
          router.push('/');
          return;
        }
        throw new Error(data.error || 'Failed to save document');
      }

      setDoc(prev => ({
        ...prev,
        content: htmlContent,
        updated_at: data.document?.updated_at || new Date().toISOString()
      }));
      setSaveStatus('saved');
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('unsaved');
    }
  };

  // Save title changes
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!canEdit) return;
    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/documents/${doc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        });
        const data = await res.json();
        if (!res.ok) {
          if (
            res.status === 401 ||
            res.status === 403 ||
            res.status === 404 ||
            data.error?.includes('access denied') ||
            data.error?.includes('Permission denied') ||
            data.error?.includes('not found')
          ) {
            router.push('/');
            return;
          }
          throw new Error(data.error || 'Failed to update title');
        }
        if (data.document) {
          setDoc(prev => ({ ...prev, title: newTitle }));
          setSaveStatus('saved');
          setLastSavedAt(new Date());
        }
      } catch (err) {
        console.error('Title save failed:', err);
        setSaveStatus('unsaved');
      }
    }, 800);
  };

  // Word & Character count calculation
  const getDocumentStats = () => {
    if (!editor) return { words: 0, characters: 0, readTime: 1 };
    const text = editor.getText();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = text.length;
    const readTime = Math.max(1, Math.ceil(words / 200));
    return { words, characters, readTime };
  };

  const stats = getDocumentStats();

  const handleInsertImageInline = (url: string) => {
    if (editor && canEdit) {
      editor.chain().focus().setImage({ src: url }).run();
      setIsAttachmentsOpen(false);
    }
  };

  const handleInsertHtml = (html: string) => {
    if (editor && canEdit) {
      editor.chain().focus().insertContent(html).run();
    }
  };

  const handleExport = (format: 'md' | 'html' | 'txt') => {
    window.open(`/api/documents/${doc.id}/export?format=${format}`, '_blank');
    setIsExportOpen(false);
  };

  const handleDeleteDocument = async () => {
    if (!doc.is_owner) {
      alert('Only the document owner can delete this document.');
      return;
    }

    if (confirm(`Are you sure you want to permanently delete "${doc.title}"?`)) {
      try {
        const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
        if (res.ok) {
          router.push('/');
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to delete');
        }
      } catch (err) {
        alert('Failed to delete document');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onUserSwitch={() => {
          window.location.reload();
        }}
      />

      {/* Document Sub-Header & Controls */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Left: Back & Title Input */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => {
              if (provider) {
                try {
                  if (provider.awareness) {
                    provider.awareness.destroy();
                  }
                  provider.disconnect();
                  provider.destroy();
                } catch {}
              }
              if (ydoc) {
                try {
                  ydoc.destroy();
                } catch {}
              }
              router.push('/');
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            title="Back to All Documents"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0 flex-1 max-w-xl">
            <input
              type="text"
              value={title}
              disabled={!canEdit}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Untitled Document"
              className={`w-full text-base font-semibold text-slate-900 bg-transparent px-2 py-1 rounded-lg transition-all focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 truncate ${
                !canEdit ? 'cursor-not-allowed opacity-90' : 'hover:bg-slate-50'
              }`}
            />
          </div>

          {/* Role Badge */}
          <div className="shrink-0 hidden sm:flex items-center gap-1.5">
            {doc.is_owner ? (
              <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-500" /> Owner
              </span>
            ) : canEdit ? (
              <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Edit3 className="w-3 h-3 text-emerald-500" /> Editor
              </span>
            ) : (
              <span className="text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3 text-amber-500" /> Read Only
              </span>
            )}
          </div>
        </div>

        {/* Right: Real-time Presence, Auto-Save indicator & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Real-time Collaborators Presence Stack */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1">
              {isWsConnected ? (
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Real-time Sync Active" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-300" title="Offline / Local mode" />
              )}
              <span className="text-[10px] font-semibold text-slate-500 hidden sm:inline">
                {onlineCollaborators.length} {onlineCollaborators.length === 1 ? 'online' : 'online'}
              </span>
            </div>

            {/* Avatar Stack */}
            <div className="flex -space-x-1.5 overflow-hidden ml-1">
              {onlineCollaborators.map(c => (
                <div
                  key={c.clientId}
                  className="w-5 h-5 rounded-full ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center shadow-2xs transition-transform hover:scale-110"
                  style={{ backgroundColor: c.color }}
                  title={`${c.name} (${c.role || 'Collaborator'})`}
                >
                  {c.avatar || c.name.charAt(0)}
                </div>
              ))}
            </div>
          </div>

          {/* Save status */}
          <div className="text-[11px] text-slate-500 hidden md:flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200/60">
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'unsaved' ? (
              <>
                <CloudOff className="w-3 h-3 text-amber-500" />
                <span>Unsaved</span>
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3 text-emerald-600" />
                <span>Saved</span>
              </>
            )}
          </div>

          {/* History Button */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-colors text-xs font-medium flex items-center gap-1"
            title="Version History"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span className="hidden lg:inline">History</span>
          </button>

          {/* Attachments Button */}
          <button
            onClick={() => setIsAttachmentsOpen(true)}
            className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-colors text-xs font-medium flex items-center gap-1.5 relative"
            title="Document Attachments"
          >
            <Paperclip className="w-4 h-4 text-slate-500" />
            <span className="hidden lg:inline">Files</span>
            {doc.attachments && doc.attachments.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                {doc.attachments.length}
              </span>
            )}
          </button>

          {/* Export Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-colors text-xs font-medium flex items-center gap-1"
              title="Export Document"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span className="hidden lg:inline">Export</span>
            </button>

            {isExportOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsExportOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 text-xs">
                  <div className="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider">
                    Export Format
                  </div>
                  <button
                    onClick={() => handleExport('md')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Markdown (.md)</span>
                    <span className="text-[10px] text-slate-400">MD</span>
                  </button>
                  <button
                    onClick={() => handleExport('html')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>HTML Document (.html)</span>
                    <span className="text-[10px] text-slate-400">HTML</span>
                  </button>
                  <button
                    onClick={() => handleExport('txt')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Plain Text (.txt)</span>
                    <span className="text-[10px] text-slate-400">TXT</span>
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => {
                      setIsExportOpen(false);
                      window.print();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-400" /> Print / PDF
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Share Button */}
          {doc.is_owner && (
            <button
              onClick={() => setIsShareOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs shadow-blue-500/20"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
              {doc.shares && doc.shares.length > 0 && (
                <span className="bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {doc.shares.length}
                </span>
              )}
            </button>
          )}

          {/* Delete Option if Owner */}
          {doc.is_owner && (
            <button
              onClick={handleDeleteDocument}
              title="Delete Document"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Read-Only Notice Banner if Viewer */}
      {!canEdit && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>View-only mode:</strong> You have read-only access to this document. Contact <strong>{doc.owner_name}</strong> to request editor access.
            </span>
          </div>
        </div>
      )}

      {/* Rich Text Toolbar */}
      <EditorToolbar editor={editor} disabled={!canEdit} />

      {/* Main Document Workspace */}
      <main className="flex-1 flex justify-center py-6 px-4 md:px-8">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-14 transition-all">
          <EditorContent editor={editor} />
        </div>
      </main>

      {/* Document Footer / Stats Bar */}
      <footer className="bg-white border-t border-slate-200 px-6 py-2 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-4">
          <span>{stats.words} words</span>
          <span>{stats.characters} characters</span>
          <span>~{stats.readTime} min read</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Last edited {lastSavedAt.toLocaleTimeString()}</span>
        </div>
      </footer>

      {/* Modals */}
      <ShareModal
        document={doc}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onDocumentUpdated={updated => setDoc(updated)}
      />

      <AttachmentDrawer
        documentId={doc.id}
        attachments={doc.attachments || []}
        canEdit={canEdit}
        isOpen={isAttachmentsOpen}
        onClose={() => setIsAttachmentsOpen(false)}
        onAttachmentsUpdated={atts => setDoc(prev => ({ ...prev, attachments: atts }))}
        onInsertImageInline={handleInsertImageInline}
      />

      <VersionHistoryModal
        documentId={doc.id}
        isOpen={isHistoryOpen}
        canEdit={canEdit}
        onClose={() => setIsHistoryOpen(false)}
        onVersionRestored={() => window.location.reload()}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        currentDocumentId={doc.id}
        onInsertContent={handleInsertHtml}
      />
    </div>
  );
};
