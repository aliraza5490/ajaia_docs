import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { notifyDocumentAccessUpdated, MESSAGE_DOCUMENT_RECORD_UPDATE } from '../lib/ws-notify';

describe('Document Access Update WebSocket Protocol', () => {
  const TEST_PORT = 1239;
  let wss: WebSocketServer;
  const connections = new Set<WebSocket>();

  beforeAll(async () => {
    process.env.COLLAB_PORT = String(TEST_PORT);
    wss = new WebSocketServer({ port: TEST_PORT });

    wss.on('connection', (ws, req) => {
      connections.add(ws);

      ws.on('message', (data) => {
        try {
          const uint8 = new Uint8Array(data as Buffer);
          const decoder = decoding.createDecoder(uint8);
          const messageType = decoding.readVarUint(decoder);

          if (messageType === MESSAGE_DOCUMENT_RECORD_UPDATE) {
            const payload = decoding.readVarString(decoder);
            // Broadcast to other connections
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_DOCUMENT_RECORD_UPDATE);
            encoding.writeVarString(encoder, payload);
            const buff = encoding.toUint8Array(encoder);

            connections.forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(buff);
              }
            });
          }
        } catch (err) {
          console.error('Error in test WS:', err);
        }
      });

      ws.on('close', () => {
        connections.delete(ws);
      });
    });
  });

  afterAll(async () => {
    connections.forEach(c => c.terminate());
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  it('should send and broadcast a document access update message to connected subscribers', async () => {
    const docId = 'test-doc-123';
    const clientWs = new WebSocket(`ws://localhost:${TEST_PORT}/doc-${docId}?userId=user-marcus`);

    await new Promise<void>((resolve) => clientWs.on('open', resolve));

    const messagePromise = new Promise<any>((resolve) => {
      clientWs.on('message', (data) => {
        const uint8 = new Uint8Array(data as Buffer);
        const decoder = decoding.createDecoder(uint8);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === MESSAGE_DOCUMENT_RECORD_UPDATE) {
          const payloadStr = decoding.readVarString(decoder);
          const parsed = JSON.parse(payloadStr);
          resolve(parsed);
        }
      });
    });

    // Trigger access update notification
    const success = await notifyDocumentAccessUpdated(docId, {
      action: 'share_updated',
      targetUserId: 'user-marcus',
      role: 'editor',
      updatedBy: 'user-alex'
    });

    expect(success).toBe(true);

    const receivedPayload = await messagePromise;
    expect(receivedPayload).toBeDefined();
    expect(receivedPayload.type).toBe('DOCUMENT_ACCESS_UPDATED');
    expect(receivedPayload.documentId).toBe(docId);
    expect(receivedPayload.action).toBe('share_updated');
    expect(receivedPayload.targetUserId).toBe('user-marcus');
    expect(receivedPayload.role).toBe('editor');
    expect(receivedPayload.updatedBy).toBe('user-alex');

    clientWs.close();
  });

  it('should handle public access change notifications', async () => {
    const docId = 'test-public-doc-456';
    const clientWs = new WebSocket(`ws://localhost:${TEST_PORT}/doc-${docId}?userId=user-sarah`);

    await new Promise<void>((resolve) => clientWs.on('open', resolve));

    const messagePromise = new Promise<any>((resolve) => {
      clientWs.on('message', (data) => {
        const uint8 = new Uint8Array(data as Buffer);
        const decoder = decoding.createDecoder(uint8);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === MESSAGE_DOCUMENT_RECORD_UPDATE) {
          const payloadStr = decoding.readVarString(decoder);
          resolve(JSON.parse(payloadStr));
        }
      });
    });

    const success = await notifyDocumentAccessUpdated(docId, {
      action: 'access_updated',
      isPublic: 1,
      publicRole: 'editor',
      updatedBy: 'user-alex'
    });

    expect(success).toBe(true);

    const payload = await messagePromise;
    expect(payload.type).toBe('DOCUMENT_ACCESS_UPDATED');
    expect(payload.documentId).toBe(docId);
    expect(payload.isPublic).toBe(1);
    expect(payload.publicRole).toBe('editor');

    clientWs.close();
  });
});
