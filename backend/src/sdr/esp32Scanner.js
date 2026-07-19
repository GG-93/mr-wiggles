'use strict';

/**
 * Esp32Scanner – reads Wi-Fi and BLE scan results from an ESP32 (or any
 * microcontroller) connected via USB serial.
 *
 * Installation (optional):
 *   npm install serialport
 *
 * Configuration (.env):
 *   ESP32_PORT=/dev/ttyUSB0        # serial device path (required to enable)
 *   ESP32_BAUD=115200              # baud rate (default: 115200)
 *
 * Expected firmware output — one JSON object per line:
 *
 *   Wi-Fi AP:
 *     {"t":"wifi","ssid":"MyNet","bssid":"aa:bb:cc:dd:ee:ff","rssi":-65,"freq":2437,"ch":6}
 *
 *   BLE peripheral:
 *     {"t":"ble","name":"Device","addr":"aa:bb:cc:dd:ee:ff","rssi":-72}
 *
 *   Keep-alive (ignored):
 *     {"t":"ping"}
 *
 * Sample Arduino/ESP32 sketch: docs/esp32-firmware-example.md
 *
 * If serialport is not installed or ESP32_PORT is not set, this module
 * exits gracefully so the rest of the app continues.
 */
const EventEmitter = require('events');

const ESP32_PORT = process.env.ESP32_PORT || '';
const ESP32_BAUD = parseInt(process.env.ESP32_BAUD || '115200', 10);

class Esp32Scanner extends EventEmitter {
  constructor() {
    super();
    this._port   = null;
    this._parser = null;
    this._buffer = '';
  }

  start() {
    if (!ESP32_PORT) {
      console.log('[Esp32Scanner] ESP32_PORT not set – ESP32 scanning disabled.');
      this.emit('unavailable', 'ESP32_PORT not configured');
      return;
    }

    let SerialPort, ReadlineParser;
    try {
      ({ SerialPort } = require('serialport'));
    } catch (_) {
      console.warn(
        '[Esp32Scanner] serialport not installed – ESP32 scanning disabled.\n' +
        '             Run: npm install serialport  (inside backend/)'
      );
      this.emit('unavailable', 'serialport not installed');
      return;
    }
    try {
      ({ ReadlineParser } = require('@serialport/parser-readline'));
    } catch (_) {
      console.warn(
        '[Esp32Scanner] @serialport/parser-readline not found.\n' +
        '             Reinstall serialport: npm install serialport  (inside backend/)'
      );
      this.emit('unavailable', '@serialport/parser-readline not found');
      return;
    }

    console.log(`[Esp32Scanner] Opening ${ESP32_PORT} at ${ESP32_BAUD} baud…`);

    this._port = new SerialPort({ path: ESP32_PORT, baudRate: ESP32_BAUD });
    this._parser = this._port.pipe(new ReadlineParser({ delimiter: '\n' }));

    this._port.on('open',  ()    => console.log(`[Esp32Scanner] Connected to ${ESP32_PORT}`));
    this._port.on('error', (err) => console.error('[Esp32Scanner]', err.message));
    this._port.on('close', ()    => console.log('[Esp32Scanner] Port closed'));

    this._parser.on('data', (line) => this._onLine(line.trim()));
  }

  stop() {
    if (this._port && this._port.isOpen) {
      this._port.close((err) => {
        if (err) console.error('[Esp32Scanner] Close error:', err.message);
      });
    }
    console.log('[Esp32Scanner] Stopped');
  }

  // ── private ─────────────────────────────────────────────────────────────

  _onLine(line) {
    if (!line || line[0] !== '{') return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (_) {
      return; // ignore malformed lines
    }

    const frames = this._toFrames(msg);
    if (frames.length > 0) this.emit('frame', frames);
  }

  _toFrames(msg) {
    const type = (msg.t || msg.type || '').toLowerCase();

    if (type === 'wifi') {
      const mac     = (msg.bssid || msg.mac || '').toLowerCase();
      const ssid    = msg.ssid  || '(hidden)';
      const rssi    = typeof msg.rssi === 'number' ? msg.rssi : -100;
      const freqMHz = msg.freq  || 2437;
      const channel = msg.ch    || msg.channel || 0;

      if (!mac) return [];
      return [{
        id:        `esp32-wifi-${mac}`,
        ssid,
        mac,
        rssi,
        doa:       0,
        freqMHz,
        channel,
        protocol:  freqMHz >= 5000 ? 'Wi-Fi ESP32 (5 GHz)' : 'Wi-Fi ESP32 (2.4 GHz)',
        active:    rssi > -90,
        beatFreq:  freqMHz >= 5000 ? 1.2 : 0.6,
        timestamp: Date.now(),
      }];
    }

    if (type === 'ble') {
      const addr = (msg.addr || msg.address || '').toLowerCase();
      const name = msg.name || '(unnamed)';
      const rssi = typeof msg.rssi === 'number' ? msg.rssi : -100;

      if (!addr) return [];
      return [{
        id:        `esp32-ble-${addr}`,
        ssid:      name,
        mac:       addr,
        rssi,
        doa:       0,
        freqMHz:   2441,
        channel:   'BLE',
        protocol:  'Bluetooth LE (ESP32)',
        active:    true,
        beatFreq:  1.0,
        timestamp: Date.now(),
      }];
    }

    return []; // ignore "ping" and unknown types
  }
}

module.exports = Esp32Scanner;
