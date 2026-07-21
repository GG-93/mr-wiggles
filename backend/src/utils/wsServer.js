'use strict';

/**
 * WebSocket server wrapper.
 * Broadcasts JSON messages to all connected clients.
 */
const { WebSocketServer: WS } = require('ws');

const BROADCAST_RATE_HZ = parseInt(process.env.WS_BROADCAST_RATE_HZ || '60', 10);
const BROADCAST_INTERVAL_MS = Math.round(1000 / BROADCAST_RATE_HZ);

class WebSocketServer {
  constructor(httpServer) {
    this._wss = new WS({ server: httpServer, path: '/ws' });
    this._pending = null;
    this._timer = null;

    this._wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;
      console.log(`[WS] Client connected from ${ip}`);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._handleClientMessage(ws, msg);
        } catch (_) {
          // ignore malformed messages
        }
      });

      ws.on('close', () => console.log(`[WS] Client disconnected from ${ip}`));
      ws.on('error', (err) => console.error('[WS] Client error:', err.message));

      // Send current state immediately on connect
      if (this._pending) {
        this._send(ws, this._pending);
      }
    });

    // Rate-limited broadcast loop
    this._timer = setInterval(() => {
      if (this._pending) {
        this._broadcastNow(this._pending);
        this._pending = null;
      }
    }, BROADCAST_INTERVAL_MS);

    console.log(`[WS] Server ready (broadcast rate: ${BROADCAST_RATE_HZ} Hz)`);
  }

  /**
   * Queue a payload for broadcast on the next tick.
   * @param {object} payload
   */
  broadcast(payload) {
    this._pending = payload;
  }

  _broadcastNow(payload) {
    const json = JSON.stringify(payload);
    this._wss.clients.forEach((client) => {
      if (client.readyState === 1 /* OPEN */) {
        client.send(json, (err) => {
          if (err) console.error('[WS] Send error:', err.message);
        });
      }
    });
  }

  _send(ws, payload) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload), (err) => {
        if (err) console.error('[WS] Send error:', err.message);
      });
    }
  }

  _handleClientMessage(ws, msg) {
    // Forward client commands to main process if needed in future
    console.log('[WS] Client message:', msg);
  }

  close() {
    clearInterval(this._timer);
    this._wss.close();
  }
}

module.exports = WebSocketServer;
