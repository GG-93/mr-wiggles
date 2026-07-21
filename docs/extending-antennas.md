# Extending Mr. Wiggles – Adding New Signal Sources

This guide explains how to add support for new hardware or signal protocols
to Mr. Wiggles without modifying the core visualisation or signal processing code.

## Architecture Overview

```
Hardware / OS Signal Source
         │
         ▼
   ┌─────────────┐
   │  Scanner    │  (backend/src/sdr/)
   │  *.js       │  emits 'frame' events
   └──────┬──────┘
          │ frame[]
          ▼
   ┌──────────────────┐
   │  SignalManager   │  (backend/src/processors/)
   │  smoothing/EMA   │  emits 'update' events
   └──────┬───────────┘
          │ update payload
          ▼
   ┌──────────────────┐
   │  WebSocketServer │  (backend/src/utils/)
   │  JSON broadcast  │
   └──────┬───────────┘
          │
          ▼
      Frontend
```

The **Scanner Layer** is the only part you need to implement.

---

## Built-in scanners

Mr. Wiggles ships with three native scanners (no specialist radio hardware required):

| Scanner | File | What it scans | Dependencies |
|---------|------|---------------|--------------|
| `WifiScanner` | `sdr/wifiScanner.js` | 2.4 GHz + 5 GHz Wi-Fi APs | None (uses OS commands) |
| `BleScanner` | `sdr/bleScanner.js` | Bluetooth LE peripherals | `@abandonware/noble` (optional) |
| `Esp32Scanner` | `sdr/esp32Scanner.js` | Wi-Fi + BLE via USB serial ESP32 | `serialport` (optional) |

These are orchestrated by `sdr/nativeScanner.js` when `DEMO_MODE=false`.

---

## Step 1 – Create your scanner module

Create a new file in `backend/src/sdr/`, e.g. `myScanner.js`:

```js
'use strict';

const EventEmitter = require('events');

class MyScanner extends EventEmitter {
  constructor() {
    super();
    this._timer = null;
  }

  /** Called by index.js to start capture. */
  start() {
    console.log('[MyScanner] Starting capture…');
    // Connect to hardware, open serial port, spawn subprocess, etc.
    // Call this._emitFrame() whenever you have new data.
  }

  /** Called on graceful shutdown. */
  stop() {
    // Clean up resources
    console.log('[MyScanner] Stopped');
  }

  // ── private ──────────────────────────────────────────────────────────

  _emitFrame(rawData) {
    // Transform your raw data into the frame format
    const frames = this._parse(rawData);
    this.emit('frame', frames);   // ← this is the contract
  }

  _parse(rawData) {
    // Return an array of signal objects.
    // At minimum, provide the fields below.
    return [{
      id:       'unique-signal-id',    // string – stable per device
      ssid:     'Network Name',        // display name
      mac:      'aa:bb:cc:dd:ee:ff',   // hardware address (or equivalent)
      rssi:     -65,                   // dBm (number)
      doa:      0,                     // degrees 0-360 (0 = unknown / no directional antenna)
      freqMHz:  2437,                  // centre frequency in MHz
      channel:  6,                     // logical channel number (or label string)
      protocol: 'Wi-Fi (2.4 GHz)',     // human-readable protocol
      active:   true,                  // is the device currently transmitting?
      beatFreq: 0.8,                   // 0–2 Hz visual beat speed
      timestamp: Date.now(),
    }];
  }
}

module.exports = MyScanner;
```

### Frame contract

| Field       | Type           | Required | Description                              |
|-------------|----------------|----------|------------------------------------------|
| `id`        | string         | ✅       | Stable unique identifier for this device |
| `ssid`      | string         | ✅       | Human-readable name                      |
| `mac`       | string         | ✅       | Hardware address or unique device ID     |
| `rssi`      | number         | ✅       | Signal strength in dBm                   |
| `doa`       | number         | ✅       | Direction of Arrival, 0–360° (0 = unknown) |
| `freqMHz`   | number         | ✅       | Centre frequency in MHz                  |
| `channel`   | number\|string | ✅       | Logical channel number or label          |
| `protocol`  | string         | ✅       | Protocol string                          |
| `active`    | boolean        | ✅       | Whether the device is transmitting       |
| `beatFreq`  | number         | ✅       | Visual beat frequency 0–2               |
| `timestamp` | number         | ✅       | Unix timestamp ms                        |

---

## Step 2 – Register in nativeScanner.js

Open `backend/src/sdr/nativeScanner.js` and add your scanner:

```js
const MyScanner = require('./myScanner');

// Inside NativeScanner.start():
const mine = new MyScanner();
mine.on('frame', (frames) => this.emit('frame', frames));
mine.start();
this._scanners.push(mine);
```

## Step 3 – Add environment variables (optional)

In `backend/.env` set:
```
DEMO_MODE=false
```

---

## Step 4 – Direction of Arrival (DoA)

DoA is the most hardware-specific part.

### With a single omnidirectional antenna (default)
DoA is unavailable – emit `doa: 0` and the visualisation will show all ripples
pointing north. The RSSI and frequency data still animate correctly.
Walking toward a signal source while watching RSSI increase is the most
practical "fox hunting" technique with a single antenna.

### With a rotating directional antenna
Track the angle of maximum RSSI as you rotate:

```js
// Motor controller → degrees, RSSI reading → dBm
this._bestDoa = angleAtMaxRssi;
```

### With a phased array (multiple antennas)
Use phase difference between antenna elements to estimate angle:

```js
const phaseDiff = Math.atan2(imagPart, realPart);  // complex cross-correlation
const doa = normaliseDeg(phaseDiff * (180 / Math.PI));
```

See [MUSIC algorithm](https://en.wikipedia.org/wiki/MUSIC_(algorithm)) and
[ESPRIT](https://en.wikipedia.org/wiki/Estimation_of_signal_parameters_via_rotational_invariance_techniques)
for advanced DoA estimation.

---

## Step 5 – Test with demo mode

Before connecting hardware, validate the frame format by temporarily emitting
frames from your `_parse()` using hardcoded values. Set `DEMO_MODE=true` to
compare output with the built-in demo.

---

## Supported protocols

The visualiser is protocol-agnostic. Currently supported out of the box:

| Protocol        | Scanner            | Hardware needed               |
|-----------------|--------------------|-------------------------------|
| Wi-Fi 2.4 GHz   | `WifiScanner`      | Any Wi-Fi adapter             |
| Wi-Fi 5 GHz     | `WifiScanner`      | 5 GHz capable Wi-Fi adapter   |
| Bluetooth LE    | `BleScanner`       | Any Bluetooth adapter         |
| Wi-Fi via ESP32 | `Esp32Scanner`     | ESP32 + USB cable             |
| BLE via ESP32   | `Esp32Scanner`     | ESP32 + USB cable             |

Protocols you can add with a custom scanner:

| Protocol       | Tools / APIs               | Notes                                        |
|----------------|----------------------------|----------------------------------------------|
| Zigbee         | `zigbee2mqtt`, `killerbee` | 2.4 GHz, channels 11-26                      |
| Z-Wave         | `z-wave-js`                | 868/908 MHz                                  |
| LoRa           | `chirpstack`               | TTN gateway data                             |
| ADS-B (planes) | `dump1090`                 | 1090 MHz, use GPS coords as DoA              |
| RTL-SDR        | `sdr/hardwareSDR.js`       | Legacy – RTL-SDR or HackRF hardware required |

---

## Mobile access

Mr. Wiggles runs as a local web server. Any device on the same network can view
the visualisation by navigating to `http://<your-host-ip>:3000` in a browser.
The scanning always happens server-side (on the computer running the backend).

## Contributing

Pull requests for new scanner backends are welcome!

1. Add your module in `backend/src/sdr/`
2. Register it in `backend/src/sdr/nativeScanner.js`
3. Document the hardware requirements here
4. Add a demo entry in `DemoSDR._generateSignals()` for testing
