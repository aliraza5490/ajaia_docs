# Ajaia Docs 📝

> A fast, responsive, and collaborative document workspace designed for modern engineering and product teams.

Built with **Next.js 15+ (App Router)**, **React 19**, **TipTap (ProseMirror)**, **Tailwind CSS**, and **SQLite (better-sqlite3 with WAL mode)**.

---

## 🌟 Key Capabilities

### 1. Rich Document Creation & Editing
- **Modern WYSIWYG Editor**: Powered by TipTap / ProseMirror for reliable DOM serialization.
- **Formatting Tools**: Headings (H1, H2, H3), Bold, Italic, Underline, Strikethrough, Text Highlight, Bulleted & Numbered Lists, Task Lists / Checklists, Blockquotes, Code Blocks, Horizontal Rules, and Text Alignment.
- **Inline Title Renaming**: Fast inline renaming with instant debounced auto-save.
- **Live Auto-Save & Debounce**: Changes persist seamlessly to SQLite without page reloads, accompanied by a real-time status indicator (`Saving...`, `Saved`, `Unsaved`).
- **Document Metadata**: Live word count, character count, estimated reading time, and last modified timestamps.
- **Templates**: Quick-start templates for *Product Requirements (PRD)*, *Weekly Team Sync Notes*, and *Engineering RFCs*.

### 2. Intelligent File Upload & Import
- **Multi-Format Import**: Upload `.docx` (Word), `.md` (Markdown), and `.txt` (Plaintext) files.
- **Auto-Parsing**: Converts headings, lists, quotes, and structured text directly into editable rich documents.
- **Drag & Drop Workspace**: Upload directly on the dashboard or inside active drafts.
- **Document Attachments**: Attach reference images, design assets, and files to any document with inline insert or direct download.

### 3. Collaboration & Access Control
- **Granular Sharing Model**:
  - **Document Owner**: Full permissions to edit, manage access, duplicate, or delete.
  - **Collaborators**: Grant individual access with `Can Edit` (Editor) or `Can View` (Read-only Viewer).
  - **Public Link Sharing**: Configurable public access (`Restricted`, `Public Viewer`, or `Public Editor`).
- **Simulated Multi-User Profile Switcher**: Instantly switch between team profiles (**Alex Chen** - Product Lead, **Sarah Taylor** - Lead Designer, **Marcus Vance** - Staff Engineer) in the navigation bar to test live permissions and access boundaries.
- **Visual Distinction**: Dedicated badges for *Owned by me*, *Shared with me*, *Editor*, and *Read Only*, with collaborator avatar stacks.

### 4. Zero-Latency Persistence & Version History
- **SQLite with Write-Ahead Logging (WAL)**: Fast, zero-config relational persistence. Refresh-safe, acid-compliant local storage.
- **Version History & Snapshots**: Browse previous revisions with timestamps and author credits, with one-click revision restore.

### 5. Multi-Format Document Export
- Export any document to **Markdown (.md)**, **HTML (.html)**, **Plain Text (.txt)**, or formatted **PDF (Print)**.

---

## 🛠️ Architecture & Product Decisions

### What We Prioritized and Why:
1. **TipTap / ProseMirror for the Editor**: Instead of `contenteditable` hacks or heavy iframes, TipTap provides a decoupled schema, structured JSON/HTML document representations, and extensibility.
2. **SQLite + WAL for Persistence**: Gives instantaneous zero-latency local relational persistence with zero external service dependencies. Tables for `users`, `documents`, `document_shares`, `document_attachments`, and `document_versions` ensure complete relational integrity and cascade deletes.
3. **Interactive Multi-User Simulation**: Rather than requiring manual login friction during evaluation, a top-bar profile switcher updates session cookies (`ajaia_user_id`), allowing immediate verification of permission enforcement (e.g. read-only viewer mode, owner-only deletion).
4. **Resilient File Parsing**: Custom multi-stage parsers utilizing `mammoth` for `.docx` and `marked` for `.md` extract clean semantic HTML and auto-detect document titles.

---

## 🚀 Quick Setup & Run Instructions

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- `pnpm` (or `npm` / `yarn`)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start the Development & Collaboration Servers
```bash
# Terminal 1: Start Next.js development server
pnpm dev

# Terminal 2 (Optional for cross-window/network real-time CRDT sync):
pnpm collab
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Open multiple windows or switch simulated profiles to see live multi-cursor editing in real time!


### 3. Run Automated Tests
```bash
pnpm test
```
Runs 7 comprehensive Vitest unit and integration tests covering document CRUD, permission boundaries, sharing logic, version history restore, and file parsers.

### 4. Build for Production
```bash
pnpm build
pnpm start
```

---

## 📂 Project Structure

```
ajaia_docs/
├── app/
│   ├── api/
│   │   ├── documents/
│   │   │   ├── [id]/
│   │   │   │   ├── attachments/    # File attachments upload & delete
│   │   │   │   ├── export/         # Export as MD, HTML, TXT
│   │   │   │   ├── share/          # Add/remove collaborator permissions
│   │   │   │   ├── versions/       # Version snapshot and restore
│   │   │   │   └── route.ts        # Single document GET, PATCH, DELETE
│   │   │   ├── import/             # .docx, .md, .txt parser & importer
│   │   │   └── route.ts            # List and Create documents
│   │   └── users/                  # User list & session switcher
│   ├── doc/[id]/page.tsx           # Document editor page
│   ├── globals.css                 # Design system & TipTap styles
│   ├── layout.tsx                  # Root app layout
│   └── page.tsx                    # Dashboard with templates & filters
├── components/
│   ├── DocumentList.tsx            # Dashboard grid, tabs, search, actions
│   ├── ImportModal.tsx             # File upload dropzone & preview
│   ├── Navbar.tsx                  # Brand & multi-user profile switcher
│   └── Editor/
│       ├── AttachmentDrawer.tsx    # Manage & insert document files
│       ├── DocumentEditor.tsx      # Main TipTap editor & auto-save
│       ├── EditorToolbar.tsx       # Formatting toolbar controls
│       ├── ShareModal.tsx          # Sharing modal & permission controls
│       └── VersionHistoryModal.tsx # Revisions viewer & restore
├── lib/
│   ├── auth.ts                     # User resolution & session cookies
│   ├── db.ts                       # SQLite initialization & schema
│   ├── doc-service.ts              # Business logic & access control
│   ├── parsers.ts                  # .docx, .md, .txt file parsers
│   └── types.ts                    # TypeScript data models
└── tests/
    ├── doc-service.test.ts         # CRUD, permissions, versions tests
    └── parsers.test.ts             # File upload & conversion tests
```

---

## 🧪 Testing Summary

The test suite validates:
- **Seed Data**: Verification of default team members (Alex, Sarah, Marcus).
- **CRUD Operations**: Document creation, renaming, and rich-text updating.
- **Access Control Matrix**:
  - Owner: Full read, write, share, delete access.
  - Shared Editor: Read and write access.
  - Shared Viewer: Read-only access (write attempts return 403 Forbidden).
  - Unshared User: Access blocked (404/403).
- **Version History**: Snapshot capture and rollback restore.
- **File Attachments**: Upload, attachment association, and deletion.
- **File Parsing**: Markdown heading extraction and plaintext formatting.
