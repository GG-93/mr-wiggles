'use strict';

/**
 * SignalManager – aggregates raw SDR frames into named signal records,
 * applies smoothing, threshold detection, and broadcasts updates via events.
 */
const EventEmitter = require('events');
const { ema, normaliseDeg, rssiToStrength } = require('../utils/helpers');

const DOA_ALPHA = parseFloat(process.env.DOA_SMOOTHING || '0.3');
const RSSI_ALPHA = 0.4;
const RSSI_THRESHOLD = parseFloat(process.env.RSSI_THRESHOLD || '-60');
const STALE_MS = 5000; // remove signals not seen for 5 s

class SignalManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, SignalRecord>} */
    this._signals = new Map();
    this._targetId = null;

    // Periodically prune stale signals
    this._pruneTimer = setInterval(() => this._prune(), 2000);
  }

  /**
   * Process a batch of signal frames from the SDR layer.
   * @param {object[]} frames
   */
  process(frames) {
    const now = Date.now();

    for (const f of frames) {
      let rec = this._signals.get(f.id);

      if (!rec) {
        rec = {
          id: f.id,
          ssid: f.ssid,
          mac: f.mac,
          rssi: f.rssi,
          doa: f.doa,
          freqMHz: f.freqMHz,
          channel: f.channel,
          protocol: f.protocol,
          active: f.active,
          beatFreq: f.beatFreq,
          strength: rssiToStrength(f.rssi),
          located: false,
          firstSeen: now,
          lastSeen: now,
        };
        this._signals.set(f.id, rec);
        console.log(`[SignalManager] New signal: ${rec.ssid} (${rec.mac}) @ ${rec.freqMHz} MHz`);
      } else {
        // Smooth RSSI and DoA
        rec.rssi = ema(rec.rssi, f.rssi, RSSI_ALPHA);
        rec.doa = normaliseDeg(ema(rec.doa, f.doa, DOA_ALPHA));
        rec.active = f.active;
        rec.beatFreq = f.beatFreq;
        rec.strength = rssiToStrength(rec.rssi);
        rec.located = rec.rssi >= RSSI_THRESHOLD;
        rec.lastSeen = now;
      }
    }

    this._broadcast();
  }

  /**
   * Get current snapshot of all known signals.
   * @returns {object[]}
   */
  getSignals() {
    return Array.from(this._signals.values()).map((r) => ({ ...r }));
  }

  /**
   * Set the signal the user is hunting.
   * @param {string} id
   */
  setTarget(id) {
    this._targetId = id;
    console.log(`[SignalManager] Target set to: ${id}`);
  }

  // ── private ───────────────────────────────────────────────────────────────

  _broadcast() {
    const signals = this.getSignals();
    const target = this._targetId
      ? signals.find((s) => s.id === this._targetId) || null
      : null;

    this.emit('update', {
      type: 'update',
      signals,
      target,
      targetId: this._targetId,
      timestamp: Date.now(),
    });
  }

  _prune() {
    const cutoff = Date.now() - STALE_MS;
    for (const [id, rec] of this._signals) {
      if (rec.lastSeen < cutoff) {
        console.log(`[SignalManager] Pruning stale signal: ${rec.ssid}`);
        this._signals.delete(id);
      }
    }
  }
}

module.exports = SignalManager;
