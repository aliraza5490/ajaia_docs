import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const PORT = process.env.COLLAB_PORT || 1234;
const wss = new WebSocketServer({ port: Number(PORT) });

/**
 * Global Map of active collaborative documents:
 * Map<docName, {
 *   doc: Y.Doc,
 *   name: string,
 *   awareness: Awareness,
 *   users: Map<userId, { userId: string, name: string, color: string, avatar: string, conns: Set<WebSocket>, lastActive: Date }>,
 *   conns: Map<WebSocket, { userId: string, name: string, clientIds: Set<number> }>
 * }>
 */
const docs = new Map();

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

function getYDoc(docName) {
  let docRecord = docs.get(docName);
  if (!docRecord) {
    const ydoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(ydoc);

    docRecord = {
      doc: ydoc,
      name: docName,
      awareness,
      users: new Map(), // Map<userId, UserSession>
      conns: new Map()  // Map<WebSocket, ConnectionMetadata>
    };

    awareness.on('update', ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      );
      const buff = encoding.toUint8Array(encoder);
      docRecord.conns.forEach((_, conn) => {
        send(conn, buff);
      });
    });

    ydoc.on('update', (update, origin) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const buff = encoding.toUint8Array(encoder);
      docRecord.conns.forEach((_, conn) => {
        if (conn !== origin) {
          send(conn, buff);
        }
      });
    });

    docs.set(docName, docRecord);
  }
  return docRecord;
}

function send(conn, message) {
  if (conn.readyState === 1) { // 1 = OPEN
    conn.send(message);
  }
}

wss.on('connection', (conn, req) => {
  // Parse document name and user parameters from URL query string
  const urlObj = new URL(req.url || '/', `http://localhost:${PORT}`);
  const docName = urlObj.pathname.slice(1) || 'default';
  
  const userId = urlObj.searchParams.get('userId') || 'user-anonymous-' + Math.random().toString(36).slice(2, 7);
  const userName = urlObj.searchParams.get('name') || 'Collaborator';
  const userColor = urlObj.searchParams.get('color') || '#2563eb';
  const userAvatar = urlObj.searchParams.get('avatar') || userName.slice(0, 2).toUpperCase();
  const userRole = urlObj.searchParams.get('role') || 'editor';

  const docRecord = getYDoc(docName);
  const { doc, awareness, conns, users } = docRecord;

  // Track connection metadata with associated User ID
  const connMeta = {
    userId,
    name: userName,
    color: userColor,
    avatar: userAvatar,
    role: userRole,
    clientIds: new Set()
  };
  conns.set(conn, connMeta);

  // Track user session on this document
  let userSession = users.get(userId);
  if (!userSession) {
    userSession = {
      userId,
      name: userName,
      color: userColor,
      avatar: userAvatar,
      role: userRole,
      conns: new Set(),
      connectedAt: new Date()
    };
    users.set(userId, userSession);
  }
  userSession.conns.add(conn);
  userSession.lastActive = new Date();

  console.log(`[Collab] User connected: "${userName}" (${userId}) on doc "${docName}". Total active users: ${users.size}`);

  // 1. Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(conn, encoding.toUint8Array(encoder));

  // 2. Send current awareness states
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awarenessStates.keys())
      )
    );
    send(conn, encoding.toUint8Array(awarenessEncoder));
  }

const MESSAGE_DOCUMENT_RECORD_UPDATE = 4;

  // Handle incoming messages
  conn.on('message', message => {
    try {
      // Check if message is a JSON text frame or binary Buffer representing JSON
      let isJson = false;
      let jsonPayload = null;
      if (typeof message === 'string') {
        try {
          jsonPayload = JSON.parse(message);
          isJson = true;
        } catch {}
      } else if (Buffer.isBuffer(message) && message[0] === 0x7b) {
        try {
          jsonPayload = JSON.parse(message.toString('utf8'));
          isJson = true;
        } catch {}
      }

      if (isJson && jsonPayload) {
        const targetDocId = jsonPayload.documentId;
        const targetDocName = targetDocId ? `doc-${targetDocId}` : docName;
        const targetRecord = docs.get(targetDocName) || docRecord;

        console.log(`[Collab] JSON document access/record update on "${targetDocName}":`, JSON.stringify(jsonPayload));

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_DOCUMENT_RECORD_UPDATE);
        encoding.writeVarString(encoder, JSON.stringify(jsonPayload));
        const buff = encoding.toUint8Array(encoder);

        if (targetRecord) {
          targetRecord.conns.forEach((_, c) => {
            send(c, buff);
          });
        }

        // Also broadcast to workspace-events room if any
        const wsEventsRecord = docs.get('workspace-events');
        if (wsEventsRecord && wsEventsRecord !== targetRecord) {
          wsEventsRecord.conns.forEach((_, c) => {
            send(c, buff);
          });
        }
        return;
      }

      const uint8 = new Uint8Array(message);
      const decoder = decoding.createDecoder(uint8);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MESSAGE_SYNC) {
        const replyEncoder = encoding.createEncoder();
        encoding.writeVarUint(replyEncoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, replyEncoder, doc, conn);
        if (encoding.length(replyEncoder) > 1) {
          send(conn, encoding.toUint8Array(replyEncoder));
        }
      } else if (messageType === MESSAGE_AWARENESS) {
        const rawAwarenessUpdate = decoding.readVarUint8Array(decoder);

        // Track client IDs associated with this connection
        try {
          const awarenessDecoder = decoding.createDecoder(rawAwarenessUpdate);
          const len = decoding.readVarUint(awarenessDecoder);
          for (let i = 0; i < len; i++) {
            const clientID = decoding.readVarUint(awarenessDecoder);
            connMeta.clientIds.add(clientID);
            decoding.readVarUint(awarenessDecoder); // clock
            decoding.readVarString(awarenessDecoder); // JSON string
          }
        } catch {
          // Ignored
        }

        awarenessProtocol.applyAwarenessUpdate(
          awareness,
          rawAwarenessUpdate,
          conn
        );
      } else if (messageType === MESSAGE_DOCUMENT_RECORD_UPDATE) {
        const payloadStr = decoding.readVarString(decoder);
        let parsed = null;
        try {
          parsed = JSON.parse(payloadStr);
        } catch {}

        const targetDocId = parsed?.documentId;
        const targetDocName = targetDocId ? `doc-${targetDocId}` : docName;
        const targetRecord = docs.get(targetDocName) || docRecord;

        console.log(`[Collab] Binary document access/record update on "${targetDocName}":`, payloadStr);

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_DOCUMENT_RECORD_UPDATE);
        encoding.writeVarString(encoder, payloadStr);
        const buff = encoding.toUint8Array(encoder);

        if (targetRecord) {
          targetRecord.conns.forEach((meta, clientConn) => {
            // Forward to all clients in document
            if (clientConn !== conn || !meta.userId.startsWith('system')) {
              send(clientConn, buff);
            }
          });
        }

        // Also broadcast to workspace-events room if any
        const wsEventsRecord = docs.get('workspace-events');
        if (wsEventsRecord && wsEventsRecord !== targetRecord) {
          wsEventsRecord.conns.forEach((_, c) => {
            send(c, buff);
          });
        }
      }
    } catch (err) {
      console.error('[Collab] Error handling message:', err);
    }
  });

  // Handle disconnection
  conn.on('close', () => {
    // 1. Remove connection from doc conns
    conns.delete(conn);

    // 2. Remove awareness states for this connection and broadcast to remaining clients
    if (connMeta.clientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        awareness,
        Array.from(connMeta.clientIds),
        null
      );
    }

    // 3. Remove connection from user session
    const session = users.get(userId);
    if (session) {
      session.conns.delete(conn);
      if (session.conns.size === 0) {
        users.delete(userId);
        console.log(`[Collab] User disconnected: "${userName}" (${userId}) from doc "${docName}". Active users: ${users.size}`);
      }
    }

    // 4. If no more connections to this document, immediately remove document records from memory
    if (conns.size === 0) {
      try {
        docRecord.awareness.destroy();
      } catch {}
      try {
        docRecord.doc.destroy();
      } catch {}
      docs.delete(docName);
      console.log(`[Collab] Document "${docName}" closed and removed from memory.`);
    }
  });
});

// Expose helper to inspect active document users
export function getActiveDocUsers(docName) {
  const docRecord = docs.get(docName);
  if (!docRecord) return [];
  return Array.from(docRecord.users.values()).map(u => ({
    userId: u.userId,
    name: u.name,
    color: u.color,
    avatar: u.avatar,
    role: u.role,
    activeConnections: u.conns.size,
    connectedAt: u.connectedAt,
    lastActive: u.lastActive
  }));
}

console.log(`🚀 Yjs WebSocket Collaboration Server running on ws://localhost:${PORT}`);
