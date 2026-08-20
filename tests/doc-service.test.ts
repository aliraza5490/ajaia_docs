import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentService } from '../lib/doc-service';
import { getAllUsers } from '../lib/auth';
import { getDb } from '../lib/db';

describe('Ajaia Docs - DocumentService & Permissions', () => {
  beforeEach(() => {
    // Ensure DB is initialized
    getDb();
  });

  it('should seed default team members', () => {
    const users = getAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(3);
    const alex = users.find(u => u.email === 'alex@ajaia.io');
    const sarah = users.find(u => u.email === 'sarah@ajaia.io');
    const marcus = users.find(u => u.email === 'marcus@ajaia.io');

    expect(alex).toBeDefined();
    expect(sarah).toBeDefined();
    expect(marcus).toBeDefined();
  });

  it('should allow a user to create, read, and update a document', () => {
    const newDoc = DocumentService.createDocument({
      title: 'Automated Test Document',
      content: '<h1>Hello Vitest</h1><p>Testing doc creation</p>',
      ownerId: 'user-alex'
    });

    expect(newDoc).toBeDefined();
    expect(newDoc.title).toBe('Automated Test Document');
    expect(newDoc.owner_id).toBe('user-alex');
    expect(newDoc.is_owner).toBe(true);
    expect(newDoc.can_edit).toBe(true);

    // Update document title and content
    const updatedDoc = DocumentService.updateDocument(newDoc.id, 'user-alex', {
      title: 'Updated Test Document',
      content: '<h1>Updated Content</h1>'
    });

    expect(updatedDoc.title).toBe('Updated Test Document');
    expect(updatedDoc.content).toContain('Updated Content');
  });

  it('should enforce access control between document owner, editor, and viewer', () => {
    // 1. Alex creates a document
    const doc = DocumentService.createDocument({
      title: 'Confidential Strategy Doc',
      content: '<p>Top secret plans</p>',
      ownerId: 'user-alex'
    });

    // 2. Marcus (unshared) cannot view doc
    const marcusAccess = DocumentService.getDocumentById(doc.id, 'user-marcus');
    expect(marcusAccess).toBeNull();

    // 3. Alex shares with Sarah as 'editor'
    DocumentService.shareDocument(doc.id, 'user-alex', 'user-sarah', 'editor');
    const sarahDoc = DocumentService.getDocumentById(doc.id, 'user-sarah');
    expect(sarahDoc).not.toBeNull();
    expect(sarahDoc?.user_role).toBe('editor');
    expect(sarahDoc?.can_edit).toBe(true);

    // Sarah edits the document successfully
    const sarahEdited = DocumentService.updateDocument(doc.id, 'user-sarah', {
      content: '<p>Sarah contributed feedback</p>'
    });
    expect(sarahEdited.content).toContain('Sarah contributed feedback');

    // 4. Alex shares with Marcus as 'viewer'
    DocumentService.shareDocument(doc.id, 'user-alex', 'user-marcus', 'viewer');
    const marcusDoc = DocumentService.getDocumentById(doc.id, 'user-marcus');
    expect(marcusDoc).not.toBeNull();
    expect(marcusDoc?.user_role).toBe('viewer');
    expect(marcusDoc?.can_edit).toBe(false);

    // Marcus trying to update should throw permission error
    expect(() => {
      DocumentService.updateDocument(doc.id, 'user-marcus', {
        content: '<p>Marcus unauthorized edit</p>'
      });
    }).toThrow(/Permission denied/);

    // 5. Only owner can delete
    expect(() => {
      DocumentService.deleteDocument(doc.id, 'user-sarah');
    }).toThrow(/Permission denied/);

    expect(DocumentService.deleteDocument(doc.id, 'user-alex')).toBe(true);
  });

  it('should track and restore document version history', () => {
    const doc = DocumentService.createDocument({
      title: 'Versioning Test Doc',
      content: '<p>Version 1 content</p>',
      ownerId: 'user-alex'
    });

    // Create a snapshot update
    DocumentService.updateDocument(doc.id, 'user-alex', {
      content: '<p>Version 2 content with new sections</p>',
      createSnapshot: true
    });

    const versions = DocumentService.listVersions(doc.id, 'user-alex');
    expect(versions.length).toBeGreaterThanOrEqual(2);

    const initialVersion = versions[versions.length - 1];
    expect(initialVersion.content).toContain('Version 1 content');

    // Restore to initial version
    const restored = DocumentService.restoreVersion(doc.id, initialVersion.id, 'user-alex');
    expect(restored.content).toContain('Version 1 content');
  });

  it('should handle document attachments', () => {
    const doc = DocumentService.createDocument({
      title: 'Attachment Test Doc',
      content: '<p>Document with file</p>',
      ownerId: 'user-alex'
    });

    const attachment = DocumentService.addAttachment(doc.id, 'user-alex', {
      filename: 'diagram.png',
      filesize: 1024,
      filetype: 'image/png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    });

    expect(attachment.id).toBeDefined();
    expect(attachment.filename).toBe('diagram.png');

    const fetchedDoc = DocumentService.getDocumentById(doc.id, 'user-alex');
    expect(fetchedDoc?.attachments?.length).toBe(1);

    expect(DocumentService.removeAttachment(attachment.id, 'user-alex')).toBe(true);
  });
});
