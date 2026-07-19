'use strict';

/**
 * BleScanner – discovers Bluetooth Low Energy (BLE) peripherals and classic
 * Bluetooth devices using the @abandonware/noble library.
 *
 * Installation (optional):
 *   npm install @abandonware/noble
 *
 * Linux prerequisites:
 *   sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
 *   sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))
 *   (or run the backend as root / with CAP_NET_RAW)
 *
 * macOS:  works out of the box via CoreBluetooth.
 * Windows: works via WinRT Bluetooth on Windows 10+.
 *
 * If noble is not installed this module emits 'unavailable' and exits
 * gracefully so the rest of the app continues working.
 */
const EventEmitter = require('events');

// Advertising channel → approximate centre frequency (MHz)
const BLE_AD_CHANNELS = { 37: 2402, 38: 2426, 39: 2480 };
const BLE_FREQ_DEFAULT = 2441; // midpoint of BLE band

class BleScanner extends EventEmitter {
  constructor() {
    super();
    this._noble  = null;
    this._active = false;
  }

  start() {
    let noble;
    try {
      noble = require('@abandonware/noble');
    } catch (_) {
      try {
        // Also try the older 'noble' package name for users who installed that
        noble = require('noble'); // eslint-disable-line global-require
      } catch (_2) {
        console.warn(
          '[BleScanner] @abandonware/noble not installed – BLE scanning disabled.\n' +
          '             Run: npm install @abandonware/noble  (inside backend/)'
        );
        this.emit('unavailable', 'noble not installed');
        return;
      }
    }

    this._noble = noble;

    noble.on('stateChange', (state) => {
      console.log(`[BleScanner] Adapter state: ${state}`);
      if (state === 'poweredOn') {
        // allowDuplicates=true so we get continuous RSSI updates
        noble.startScanning([], true);
        this._active = true;
        console.log('[BleScanner] Scanning for BLE peripherals…');
      } else {
        noble.stopScanning();
        this._active = false;
        if (state === 'unsupported' || state === 'unauthorized') {
          console.warn(`[BleScanner] Bluetooth unavailable (${state}).`);
          this.emit('unavailable', state);
        }
      }
    });

    noble.on('discover', (peripheral) => this._onDiscover(peripheral));

    noble.on('scanStop', () => {
      this._active = false;
    });
  }

  stop() {
    if (this._noble) {
      try { this._noble.stopScanning(); } catch (_) {}
    }
    this._active = false;
    console.log('[BleScanner] Stopped');
  }

  // ── private ─────────────────────────────────────────────────────────────

  _onDiscover(peripheral) {
    const adv  = peripheral.advertisement || {};
    const name = (adv.localName || '').trim() || '(unnamed)';
    // noble uses peripheral.address on Linux/Windows; peripheral.uuid on macOS
    const addr = (peripheral.address && peripheral.address !== 'unknown')
      ? peripheral.address.toLowerCase()
      : peripheral.uuid || peripheral.id;

    const rssi = typeof peripheral.rssi === 'number' ? peripheral.rssi : -100;

    // Pick frequency from advertisementChannel if present (noble ≥ 1.9)
    const adChannel = peripheral.advertisementChannel;
    const freqMHz = BLE_AD_CHANNELS[adChannel] || BLE_FREQ_DEFAULT;

    // Derive a display channel label
    const channel = adChannel ? `BLE-${adChannel}` : 'BLE';

    // Infer protocol from service UUIDs or manufacturer data
    const protocol = this._inferProtocol(adv);

    const frame = [{
      id:        `ble-${addr}`,
      ssid:      name,
      mac:       addr,
      rssi,
      // Single-antenna BLE: DoA unavailable
      doa:       0,
      freqMHz,
      channel,
      protocol,
      active:    true,
      beatFreq:  1.0,
      timestamp: Date.now(),
    }];

    this.emit('frame', frame);
  }

  /**
   * Guess the Bluetooth protocol from advertisement data.
   * Returns a human-readable string shown in the UI.
   */
  _inferProtocol(adv) {
    const uuids = (adv.serviceUuids || []).map((u) => u.toLowerCase());

    // Common BLE service UUIDs
    if (uuids.some((u) => u.startsWith('180d'))) return 'BLE (Heart Rate)';
    if (uuids.some((u) => u.startsWith('1800'))) return 'BLE (Generic Access)';
    if (uuids.some((u) => u.startsWith('fe9f') || u.startsWith('fe95')))
      return 'BLE (Mi/Xiaomi)';
    if (uuids.some((u) => u.startsWith('fd6f'))) return 'BLE (COVID-19 EN)';

    // iBeacon / Eddystone
    if (adv.manufacturerData) {
      const mfr = adv.manufacturerData;
      if (mfr.length >= 2 && mfr[0] === 0x4c && mfr[1] === 0x00) return 'BLE (iBeacon)';
    }
    return 'Bluetooth LE';
  }
}

module.exports = BleScanner;
