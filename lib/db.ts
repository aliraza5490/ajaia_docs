import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'ajaia_docs.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      avatar TEXT,
      role_title TEXT,
      color TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_plain TEXT,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_public INTEGER DEFAULT 0,
      public_role TEXT DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS document_shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('viewer', 'editor')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(document_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS document_attachments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      filesize INTEGER NOT NULL,
      filetype TEXT NOT NULL,
      data_url TEXT NOT NULL,
      uploaded_by_id TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      version_title TEXT,
      content TEXT NOT NULL,
      saved_by_id TEXT NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default users if table is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, avatar, role_title, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('user-alex', 'Alex Chen', 'alex@ajaia.io', 'AC', 'Product Lead', '#3b82f6');
    insertUser.run('user-sarah', 'Sarah Taylor', 'sarah@ajaia.io', 'ST', 'Lead Designer', '#ec4899');
    insertUser.run('user-marcus', 'Marcus Vance', 'marcus@ajaia.io', 'MV', 'Staff Engineer', '#10b981');
  }

  // Seed initial sample documents if empty
  const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
  if (docCount.count === 0) {
    const insertDoc = db.prepare(`
      INSERT INTO documents (id, title, content, content_plain, owner_id, is_public, public_role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), datetime('now', '-10 minutes'))
    `);

    const doc1Id = 'doc-welcome';
    const doc1Content = `
      <h1>🚀 Welcome to Ajaia Docs</h1>
      <p>Ajaia Docs is a fast, responsive, and delightful document workspace designed for modern collaborative workflows.</p>
      <h2>✨ Key Capabilities</h2>
      <ul>
        <li><strong>Rich-Text Editing</strong>: Full support for headings, bold, italic, underline, highlight, task lists, code blocks, and blockquotes.</li>
        <li><strong>Seamless File Import</strong>: Upload <code>.docx</code>, <code>.md</code>, and <code>.txt</code> files directly into editable documents.</li>
        <li><strong>Document Attachments</strong>: Store images and files right alongside your drafts.</li>
        <li><strong>Collaboration & Sharing</strong>: Granular permissions (<em>Viewer</em> vs <em>Editor</em>), shareable links, and multi-user switching.</li>
        <li><strong>Version History & Instant Auto-Save</strong>: Never lose a single keystroke.</li>
      </ul>
      <blockquote>"Simplicity is the prerequisite for reliability." – Edsger W. Dijkstra</blockquote>
      <p>Try switching users in the top bar to test live access control, or import your own files using the <strong>Import</strong> button!</p>
    `;
    const doc1Plain = 'Welcome to Ajaia Docs. Ajaia Docs is a fast, responsive, and delightful document workspace designed for modern collaborative workflows.';
    insertDoc.run(doc1Id, '🚀 Welcome to Ajaia Docs', doc1Content, doc1Plain, 'user-alex', 1, 'viewer');

    // Share doc1 with Sarah as editor and Marcus as viewer
    const insertShare = db.prepare(`
      INSERT INTO document_shares (id, document_id, user_id, role)
      VALUES (?, ?, ?, ?)
    `);
    insertShare.run('share-1', doc1Id, 'user-sarah', 'editor');
    insertShare.run('share-2', doc1Id, 'user-marcus', 'viewer');

    // Sample doc 2 owned by Sarah
    const doc2Id = 'doc-design-system';
    const doc2Content = `
      <h1>🎨 Q3 Product Design System Guidelines</h1>
      <p>Document owner: <strong>Sarah Taylor (Lead Designer)</strong></p>
      <h2>Typography & Hierarchy</h2>
      <p>We prioritize readability, clear contrast, and consistent rhythm.</p>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="true">Define color tokens and surface contrasts</li>
        <li data-type="taskItem" data-checked="true">Implement responsive typography scale</li>
        <li data-type="taskItem" data-checked="false">Finalize dark mode component overrides</li>
      </ul>
      <p>Please review and leave feedback below!</p>
    `;
    insertDoc.run(doc2Id, '🎨 Q3 Product Design System Guidelines', doc2Content, 'Q3 Product Design System Guidelines. Typography & Hierarchy', 'user-sarah', 0, 'viewer');
    insertShare.run('share-3', doc2Id, 'user-alex', 'editor');

    // Sample doc 3 owned by Marcus
    const doc3Id = 'doc-arch-rfc';
    const doc3Content = `
      <h1>⚡ RFC: Document Sync & SQLite Persistence Architecture</h1>
      <p>Author: <strong>Marcus Vance (Staff Engineer)</strong></p>
      <h2>Executive Summary</h2>
      <p>This RFC outlines our zero-latency persistence model using Write-Ahead Logging (WAL) and synchronous transactions for document revision safety.</p>
      <pre><code>// Fast ACID transaction
db.transaction(() => {
  saveDocumentVersion(docId, content);
  updateDocument(docId, title, content);
})();</code></pre>
      <p>Status: Under Review by Alex Chen.</p>
    `;
    insertDoc.run(doc3Id, '⚡ RFC: Document Sync & SQLite Architecture', doc3Content, 'RFC: Document Sync & SQLite Persistence Architecture', 'user-marcus', 0, 'viewer');
    insertShare.run('share-4', doc3Id, 'user-alex', 'viewer');
  }
}
