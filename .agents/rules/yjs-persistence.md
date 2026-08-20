# Yjs & SQLite Dual-Layer Persistence Guidelines

## Architecture Overview
`ajaia_docs` utilizes a dual-layer state management model for document editing:
1. **Client-Side CRDT & Offline Layer**:
   - `Y.Doc` managed with `y-websocket` (real-time collaboration) and `y-indexeddb` (instant local cache & offline recovery).
   - IndexedDB persistence instances must always be bound to the document's unique ID (`ajaia-doc-${docId}`) and properly cleaned up / destroyed on component unmount.
2. **Backend Persistence Layer (SQLite)**:
   - REST endpoints (`/api/documents/[id]`) persist content, title, and metadata.
   - Version history snapshots (`/api/documents/[id]/versions`) are created on manual save or triggered when flushing significant batches of offline edits (`createSnapshot: true`).

## Offline & Sync Invariants
- **Queueing**: Any edits made while offline or during WebSocket disconnection must be staged in the client offline queue (`ajaia_offline_queue_${docId}`) and flushed automatically upon reconnection (`window.addEventListener('online')`).
- **Save Status UX**: The editor header must accurately reflect the 5 lifecycle states:
  - `saved` (Cloud icon, green)
  - `saving` (Spinner, blue)
  - `syncing` (Spinner, indigo)
  - `offline` (HardDrive icon, amber - saved locally)
  - `unsaved` (CloudOff icon, amber)
- **Snapshot Triggering**: Do not trigger snapshots on every keystroke; debounce updates (e.g., 1000ms) and only flag `createSnapshot: true` on explicit user saves or after flushing major offline edit cycles (≥ 4 cycles).

## Build & Test Invariants
- Always verify TypeScript compilation (`pnpm run build`) and test suites (`pnpm test` via Vitest) after modifying editor synchronization or API routes.
