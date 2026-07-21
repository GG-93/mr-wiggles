/**
 * wsClient.js – WebSocket client with auto-reconnect.
 * Exposes a global `WsClient` class.
 */
'use strict';

class WsClient extends EventTarget {
  constructor(url) {
    super();
    this._url = url;
    this._ws = null;
    this._reconnectDelay = 1000;
    this._maxDelay = 10000;
    this._reconnectTimer = null;
    this._intentionalClose = false;
  }

  connect() {
    this._intentionalClose = false;
    this._open();
  }

  disconnect() {
    this._intentionalClose = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this._ws) this._ws.close();
  }

  send(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  get readyState() {
    return this._ws ? this._ws.readyState : WebSocket.CLOSED;
  }

  // ── private ────────────────────────────────────────────────────────────

  _open() {
    this._ws = new WebSocket(this._url);

    this._ws.onopen = () => {
      console.log('[WS] Connected');
      this._reconnectDelay = 1000;
      this.dispatchEvent(new CustomEvent('open'));
    };

    this._ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        this.dispatchEvent(new CustomEvent('message', { detail: data }));
      } catch (e) {
        console.warn('[WS] Bad message:', evt.data);
      }
    };

    this._ws.onerror = (err) => {
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
    };

    this._ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.dispatchEvent(new CustomEvent('close'));
      if (!this._intentionalClose) {
        this._scheduleReconnect();
      }
    };
  }

  _scheduleReconnect() {
    this.dispatchEvent(new CustomEvent('reconnecting', { detail: { delay: this._reconnectDelay } }));
    this._reconnectTimer = setTimeout(() => {
      console.log(`[WS] Reconnecting (delay: ${this._reconnectDelay}ms)…`);
      this._open();
    }, this._reconnectDelay);
    this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, this._maxDelay);
  }
}
