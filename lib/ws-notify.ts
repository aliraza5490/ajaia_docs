import WebSocket from 'ws';
import * as encoding from 'lib0/encoding';

export const MESSAGE_DOCUMENT_RECORD_UPDATE = 4;

export interface DocumentAccessUpdatePayload {
  type: 'DOCUMENT_ACCESS_UPDATED' | 'DOCUMENT_UPDATED';
  documentId: string;
  action: 'share_added' | 'share_updated' | 'share_removed' | 'access_updated' | 'record_updated';
  targetUserId?: string;
  role?: string;
  isPublic?: number;
  publicRole?: string;
  updatedBy?: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Sends a WebSocket message to notify all connected clients on a document
 * that document access / records have been updated.
 */
export async function notifyDocumentAccessUpdated(
  documentId: string,
  data?: Partial<DocumentAccessUpdatePayload>
): Promise<boolean> {
  const port = process.env.COLLAB_PORT || 1234;
  const wsUrl = `ws://localhost:${port}/doc-${documentId}?userId=system-notifier&name=System`;

  const payload: DocumentAccessUpdatePayload = {
    type: 'DOCUMENT_ACCESS_UPDATED',
    documentId,
    action: data?.action || 'access_updated',
    timestamp: new Date().toISOString(),
    ...data
  };

  return new Promise<boolean>((resolve) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        try {
          ws.terminate();
        } catch {}
        resolve(false);
      }, 1200);

      ws.on('open', () => {
        try {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_DOCUMENT_RECORD_UPDATE);
          encoding.writeVarString(encoder, JSON.stringify(payload));
          ws.send(encoding.toUint8Array(encoder), () => {
            clearTimeout(timer);
            try {
              ws.close();
            } catch {}
            resolve(true);
          });
        } catch {
          clearTimeout(timer);
          try {
            ws.terminate();
          } catch {}
          resolve(false);
        }
      });

      ws.on('error', () => {
        clearTimeout(timer);
        try {
          ws.terminate();
        } catch {}
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}
