'use strict';

/**
 * DemoSDR – emits synthetic signal frames at a configurable rate.
 * Used when DEMO_MODE=true or no hardware is available.
 */
const EventEmitter = require('events');
const { randomId, bufToMac, normaliseDeg } = require('../utils/helpers');
const crypto = require('crypto');

const UPDATE_RATE_HZ = parseInt(process.env.DEMO_UPDATE_RATE_HZ || '60', 10);
const SIGNAL_COUNT = parseInt(process.env.DEMO_SIGNAL_COUNT || '5', 10);
const INTERVAL_MS = Math.round(1000 / UPDATE_RATE_HZ);

// Common 2.4 GHz Wi-Fi channels → frequencies in MHz
const WIFI_CHANNELS = [
  { channel: 1, freq: 2412 },
  { channel: 6, freq: 2437 },
  { channel: 11, freq: 2462 },
  { channel: 36, freq: 5180 },
  { channel: 100, freq: 5500 },
];

// Synthetic SSID pool
const SSID_POOL = [
  'HomeNetwork', 'XFINITY-5G', 'ATT-WiFi', 'TP-Link_Demo',
  'Netgear_Fox', 'Linksys-2G', 'ASUS_RT', 'GoogleFiber',
];

class DemoSDR extends EventEmitter {
  constructor() {
    super();
    this._timer = null;
    this._tickCount = 0;
    this._signals = this._generateSignals();
  }

  start() {
    console.log(`[DemoSDR] Starting – ${SIGNAL_COUNT} synthetic signals at ${UPDATE_RATE_HZ} Hz`);
    this._timer = setInterval(() => this._tick(), INTERVAL_MS);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    console.log('[DemoSDR] Stopped');
  }

  // ── private ─────────────────────────────────────────────────────────────

  _generateSignals() {
    return Array.from({ length: SIGNAL_COUNT }, (_, i) => {
      const ch = WIFI_CHANNELS[i % WIFI_CHANNELS.length];
      const mac = bufToMac(crypto.randomBytes(6));
      return {
        id: randomId(),
        ssid: SSID_POOL[i % SSID_POOL.length],
        mac,
        baseRssi: -50 - Math.random() * 40,       // -50 to -90 dBm
        baseDoa: Math.random() * 360,              // 0-360°
        doaDrift: (Math.random() - 0.5) * 0.5,    // slow DoA drift per tick
        freqMHz: ch.freq,
        channel: ch.channel,
        protocol: i < 3 ? 'IEEE 802.11n' : i === 3 ? 'IEEE 802.11ac' : 'IEEE 802.11ax',
        rssiAmplitude: 5 + Math.random() * 10,    // RSSI fluctuation amplitude
        rssiPhase: Math.random() * Math.PI * 2,
        beatPhase: Math.random() * Math.PI * 2,
        active: true,
      };
    });
  }

  _tick() {
    const t = this._tickCount++ * (INTERVAL_MS / 1000);

    const frames = this._signals.map((sig) => {
      // Slowly drift DoA
      sig.baseDoa = normaliseDeg(sig.baseDoa + sig.doaDrift);

      // RSSI fluctuates with a sine wave (simulate movement)
      const rssi = sig.baseRssi + Math.sin(t * 0.7 + sig.rssiPhase) * sig.rssiAmplitude;

      // Transmission activity: random bursts
      const active = Math.random() > 0.15;

      // Beat frequency tied to Wi-Fi channel frequency (normalised)
      const beatFreq = 0.5 + (sig.freqMHz - 2412) / 3000;

      return {
        id: sig.id,
        ssid: sig.ssid,
        mac: sig.mac,
        rssi: Math.round(rssi * 10) / 10,
        doa: Math.round(sig.baseDoa * 10) / 10,
        freqMHz: sig.freqMHz,
        channel: sig.channel,
        protocol: sig.protocol,
        active,
        beatFreq,
        timestamp: Date.now(),
      };
    });

    this.emit('frame', frames);
  }
}

module.exports = DemoSDR;
