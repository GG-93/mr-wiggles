'use strict';

/**
 * NativeScanner – orchestrates all native hardware scanners:
 *
 *   • WifiScanner  – 2.4 GHz / 5 GHz Wi-Fi via OS commands (always enabled)
 *   • BleScanner   – Bluetooth LE via @abandonware/noble (enabled if installed)
 *   • Esp32Scanner – USB serial bridge for ESP32 firmware (enabled if ESP32_PORT set)
 *
 * This replaces the RTL-SDR / HackRF backend.  No specialist radio hardware
 * is required – it works with the wireless adapters already built into any
 * modern laptop, desktop, Raspberry Pi, or attached USB dongle.
 *
 * Environment variables:
 *   WIFI_SCAN_INTERVAL_MS=4000   Milliseconds between Wi-Fi scans (default 4000)
 *   ENABLE_BLE=true              Set to 'false' to disable BLE scanning
 *   ESP32_PORT=/dev/ttyUSB0      Serial port for an attached ESP32 (optional)
 *   ESP32_BAUD=115200            Baud rate for ESP32 serial (default 115200)
 */
const EventEmitter = require('events');
const WifiScanner  = require('./wifiScanner');
const BleScanner   = require('./bleScanner');
const Esp32Scanner = require('./esp32Scanner');

const ENABLE_BLE = process.env.ENABLE_BLE !== 'false';

class NativeScanner extends EventEmitter {
  constructor() {
    super();
    this._scanners = [];
  }

  start() {
    console.log('[NativeScanner] Starting native hardware scanners…');

    // ── Wi-Fi (always on) ────────────────────────────────────────────────
    const wifi = new WifiScanner();
    wifi.on('frame', (frames) => this.emit('frame', frames));
    wifi.on('error', (err)    => console.error('[WifiScanner]', err.message));
    wifi.start();
    this._scanners.push(wifi);

    // ── BLE (enabled unless ENABLE_BLE=false) ────────────────────────────
    if (ENABLE_BLE) {
      const ble = new BleScanner();
      ble.on('frame',       (frames) => this.emit('frame', frames));
      ble.on('unavailable', (reason) => console.log(`[BleScanner] Unavailable: ${reason}`));
      ble.start();
      this._scanners.push(ble);
    }

    // ── ESP32 serial (only if ESP32_PORT is configured) ──────────────────
    if (process.env.ESP32_PORT) {
      const esp32 = new Esp32Scanner();
      esp32.on('frame',       (frames) => this.emit('frame', frames));
      esp32.on('unavailable', (reason) => console.log(`[Esp32Scanner] Unavailable: ${reason}`));
      esp32.start();
      this._scanners.push(esp32);
    }

    console.log(
      `[NativeScanner] Active sources: WiFi${ENABLE_BLE ? ' + BLE' : ''}` +
      `${process.env.ESP32_PORT ? ' + ESP32' : ''}`
    );
  }

  stop() {
    this._scanners.forEach((s) => {
      try { s.stop(); } catch (_) {}
    });
    this._scanners = [];
    console.log('[NativeScanner] All scanners stopped');
  }
}

module.exports = NativeScanner;
