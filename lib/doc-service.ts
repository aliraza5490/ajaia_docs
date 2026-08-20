import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import { DocumentItem, DocumentShare, DocumentAttachment, DocumentVersion, UserRole } from './types';

export class DocumentService {
  /**
   * List all documents accessible to the given user
   */
  static listDocuments(
    userId: string,
    filter: 'all' | 'owned' | 'shared' = 'all',
    searchQuery: string = ''
  ): DocumentItem[] {
    const db = getDb();
    
    let query = `
      SELECT 
        d.id, d.title, d.content, d.content_plain, d.owner_id, d.is_public, d.public_role,
        d.created_at, d.updated_at,
        u.name as owner_name, u.email as owner_email, u.avatar as owner_avatar, u.color as owner_color,
        s.role as shared_role
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = ?
      WHERE (d.owner_id = ? OR s.user_id = ? OR d.is_public = 1)
    `;

    const params: (string | number)[] = [userId, userId, userId];

    if (filter === 'owned') {
      query += ` AND d.owner_id = ?`;
      params.push(userId);
    } else if (filter === 'shared') {
      query += ` AND d.owner_id != ? AND (s.user_id = ? OR d.is_public = 1)`;
      params.push(userId, userId);
    }

    if (searchQuery.trim()) {
      query += ` AND (d.title LIKE ? OR d.content_plain LIKE ?)`;
      params.push(`%${searchQuery.trim()}%`, `%${searchQuery.trim()}%`);
    }

    query += ` ORDER BY d.updated_at DESC`;

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map(row => {
      const isOwner = row.owner_id === userId;
      let userRole: 'owner' | 'editor' | 'viewer' | 'none' = 'none';
      let canEdit = false;

      if (isOwner) {
        userRole = 'owner';
        canEdit = true;
      } else if (row.shared_role === 'editor') {
        userRole = 'editor';
        canEdit = true;
      } else if (row.shared_role === 'viewer') {
        userRole = 'viewer';
        canEdit = false;
      } else if (row.is_public === 1) {
        userRole = row.public_role as UserRole;
        canEdit = row.public_role === 'editor';
      }

      // Fetch shares for this document
      const shares = db.prepare(`
        SELECT ds.id, ds.document_id, ds.user_id, ds.role, ds.created_at,
               u.name as user_name, u.email as user_email, u.avatar as user_avatar, u.color as user_color
        FROM document_shares ds
        JOIN users u ON ds.user_id = u.id
        WHERE ds.document_id = ?
      `).all(row.id) as DocumentShare[];

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        content_plain: row.content_plain,
        owner_id: row.owner_id,
        owner_name: row.owner_name,
        owner_email: row.owner_email,
        owner_avatar: row.owner_avatar,
        owner_color: row.owner_color,
        is_public: row.is_public,
        public_role: row.public_role,
        created_at: row.created_at,
        updated_at: row.updated_at,
        is_owner: isOwner,
        user_role: userRole,
        can_edit: canEdit,
        shares
      };
    });
  }

  /**
   * Get a single document with full details and attachments
   */
  static getDocumentById(docId: string, userId: string): DocumentItem | null {
    const db = getDb();
    
    const row = db.prepare(`
      SELECT 
        d.id, d.title, d.content, d.content_plain, d.owner_id, d.is_public, d.public_role,
        d.created_at, d.updated_at,
        u.name as owner_name, u.email as owner_email, u.avatar as owner_avatar, u.color as owner_color,
        s.role as shared_role
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = ?
      WHERE d.id = ?
    `).get(userId, docId) as any;

    if (!row) return null;

    const isOwner = row.owner_id === userId;
    const isShared = !!row.shared_role;
    const isPublic = row.is_public === 1;

    if (!isOwner && !isShared && !isPublic) {
      return null; // Not accessible
    }

    let userRole: 'owner' | 'editor' | 'viewer' | 'none' = 'none';
    let canEdit = false;

    if (isOwner) {
      userRole = 'owner';
      canEdit = true;
    } else if (row.shared_role === 'editor') {
      userRole = 'editor';
      canEdit = true;
    } else if (row.shared_role === 'viewer') {
      userRole = 'viewer';
      canEdit = false;
    } else if (isPublic) {
      userRole = row.public_role as UserRole;
      canEdit = row.public_role === 'editor';
    }

    const shares = db.prepare(`
      SELECT ds.id, ds.document_id, ds.user_id, ds.role, ds.created_at,
             u.name as user_name, u.email as user_email, u.avatar as user_avatar, u.color as user_color
      FROM document_shares ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.document_id = ?
    `).all(docId) as DocumentShare[];

    const attachments = db.prepare(`
      SELECT id, document_id, filename, filesize, filetype, data_url, uploaded_by_id, created_at
      FROM document_attachments
      WHERE document_id = ?
      ORDER BY created_at DESC
    `).all(docId) as DocumentAttachment[];

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      content_plain: row.content_plain,
      owner_id: row.owner_id,
      owner_name: row.owner_name,
      owner_email: row.owner_email,
      owner_avatar: row.owner_avatar,
      owner_color: row.owner_color,
      is_public: row.is_public,
      public_role: row.public_role,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_owner: isOwner,
      user_role: userRole,
      can_edit: canEdit,
      shares,
      attachments
    };
  }

  /**
   * Create a new document
   */
  static createDocument(data: {
    title?: string;
    content?: string;
    ownerId: string;
    isPublic?: number;
    publicRole?: UserRole;
  }): DocumentItem {
    const db = getDb();
    const docId = 'doc-' + uuidv4().slice(0, 8);
    const title = (data.title || 'Untitled Document').trim();
    const content = data.content || '<p></p>';
    const plainText = content.replace(/<[^>]*>?/gm, ' ').slice(0, 500);
    const isPublic = data.isPublic ?? 0;
    const publicRole = data.publicRole || 'viewer';

    db.prepare(`
      INSERT INTO documents (id, title, content, content_plain, owner_id, is_public, public_role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(docId, title, content, plainText, data.ownerId, isPublic, publicRole);

    // Initial version
    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_title, content, saved_by_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), docId, 'Initial creation', content, data.ownerId);

    return this.getDocumentById(docId, data.ownerId)!;
  }

  /**
   * Update an existing document
   */
  static updateDocument(
    docId: string,
    userId: string,
    data: {
      title?: string;
      content?: string;
      isPublic?: number;
      publicRole?: UserRole;
      createSnapshot?: boolean;
    }
  ): DocumentItem {
    const db = getDb();
    const currentDoc = this.getDocumentById(docId, userId);

    if (!currentDoc) {
      throw new Error('Document not found or access denied');
    }

    if (!currentDoc.can_edit) {
      throw new Error('Permission denied: You have read-only access to this document');
    }

    const newTitle = data.title !== undefined ? data.title.trim() : currentDoc.title;
    const newContent = data.content !== undefined ? data.content : currentDoc.content;
    const plainText = newContent.replace(/<[^>]*>?/gm, ' ').slice(0, 500);
    const newIsPublic = data.isPublic !== undefined ? data.isPublic : currentDoc.is_public;
    const newPublicRole = data.publicRole !== undefined ? data.publicRole : currentDoc.public_role;

    db.prepare(`
      UPDATE documents 
      SET title = ?, content = ?, content_plain = ?, is_public = ?, public_role = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newTitle, newContent, plainText, newIsPublic, newPublicRole, docId);

    // If snapshot requested or content changed significantly
    if (data.createSnapshot && data.content && data.content !== currentDoc.content) {
      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_title, content, saved_by_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), docId, `Saved at ${new Date().toLocaleTimeString()}`, newContent, userId);
    }

    return this.getDocumentById(docId, userId)!;
  }

  /**
   * Delete a document (Owner only)
   */
  static deleteDocument(docId: string, userId: string): boolean {
    const db = getDb();
    const doc = this.getDocumentById(docId, userId);

    if (!doc) {
      throw new Error('Document not found');
    }

    if (!doc.is_owner) {
      throw new Error('Permission denied: Only the document owner can delete this document');
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
    return true;
  }

  /**
   * Share a document with another user
   */
  static shareDocument(
    docId: string,
    actionUserId: string,
    targetUserId: string,
    role: UserRole
  ): DocumentShare {
    const db = getDb();
    const doc = this.getDocumentById(docId, actionUserId);

    if (!doc) {
      throw new Error('Document not found');
    }

    if (!doc.is_owner) {
      throw new Error('Permission denied: Only the owner can manage sharing permissions');
    }

    if (targetUserId === doc.owner_id) {
      throw new Error('Cannot share with the document owner');
    }

    const shareId = 'share-' + uuidv4().slice(0, 8);

    db.prepare(`
      INSERT INTO document_shares (id, document_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role
    `).run(shareId, docId, targetUserId, role);

    const share = db.prepare(`
      SELECT ds.id, ds.document_id, ds.user_id, ds.role, ds.created_at,
             u.name as user_name, u.email as user_email, u.avatar as user_avatar, u.color as user_color
      FROM document_shares ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.document_id = ? AND ds.user_id = ?
    `).get(docId, targetUserId) as DocumentShare;

    return share;
  }

  /**
   * Revoke sharing access
   */
  static removeShare(docId: string, actionUserId: string, targetUserId: string): boolean {
    const db = getDb();
    const doc = this.getDocumentById(docId, actionUserId);

    if (!doc) {
      throw new Error('Document not found');
    }

    if (!doc.is_owner) {
      throw new Error('Permission denied: Only the owner can revoke sharing permissions');
    }

    db.prepare('DELETE FROM document_shares WHERE document_id = ? AND user_id = ?').run(docId, targetUserId);
    return true;
  }

  /**
   * Add attachment to document
   */
  static addAttachment(
    docId: string,
    userId: string,
    data: {
      filename: string;
      filesize: number;
      filetype: string;
      dataUrl: string;
    }
  ): DocumentAttachment {
    const db = getDb();
    const doc = this.getDocumentById(docId, userId);

    if (!doc || !doc.can_edit) {
      throw new Error('Permission denied to attach files');
    }

    const attachmentId = 'att-' + uuidv4().slice(0, 8);

    db.prepare(`
      INSERT INTO document_attachments (id, document_id, filename, filesize, filetype, data_url, uploaded_by_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(attachmentId, docId, data.filename, data.filesize, data.filetype, data.dataUrl, userId);

    return db.prepare(`
      SELECT id, document_id, filename, filesize, filetype, data_url, uploaded_by_id, created_at
      FROM document_attachments WHERE id = ?
    `).get(attachmentId) as DocumentAttachment;
  }

  /**
   * Delete an attachment
   */
  static removeAttachment(attachmentId: string, userId: string): boolean {
    const db = getDb();
    const att = db.prepare('SELECT document_id FROM document_attachments WHERE id = ?').get(attachmentId) as { document_id: string } | undefined;

    if (!att) {
      throw new Error('Attachment not found');
    }

    const doc = this.getDocumentById(att.document_id, userId);
    if (!doc || !doc.can_edit) {
      throw new Error('Permission denied');
    }

    db.prepare('DELETE FROM document_attachments WHERE id = ?').run(attachmentId);
    return true;
  }

  /**
   * List document versions
   */
  static listVersions(docId: string, userId: string): DocumentVersion[] {
    const db = getDb();
    const doc = this.getDocumentById(docId, userId);

    if (!doc) {
      throw new Error('Document not found');
    }

    return db.prepare(`
      SELECT dv.id, dv.document_id, dv.version_title, dv.content, dv.saved_by_id, dv.created_at,
             u.name as saved_by_name
      FROM document_versions dv
      LEFT JOIN users u ON dv.saved_by_id = u.id
      WHERE dv.document_id = ?
      ORDER BY dv.created_at DESC, dv.rowid DESC
      LIMIT 25
    `).all(docId) as DocumentVersion[];
  }

  /**
   * Restore a version
   */
  static restoreVersion(docId: string, versionId: string, userId: string): DocumentItem {
    const db = getDb();
    const version = db.prepare('SELECT content FROM document_versions WHERE id = ? AND document_id = ?').get(versionId, docId) as { content: string } | undefined;

    if (!version) {
      throw new Error('Version not found');
    }

    return this.updateDocument(docId, userId, {
      content: version.content,
      createSnapshot: true
    });
  }
}
