# Extending Mr. Wiggles – Adding New Antenna Types

This guide explains how to add support for new SDR hardware or antenna protocols
to Mr. Wiggles without modifying the core visualisation or signal processing code.

## Architecture Overview

```
SDR Hardware / Antenna
        │
        ▼
  ┌─────────────┐
  │   SDR Layer │  (backend/src/sdr/)
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

The **SDR Layer** is the only part you need to implement.

---

## Step 1 – Create your SDR module

Create a new file in `backend/src/sdr/`, e.g. `myAntenna.js`:

```js
'use strict';

const EventEmitter = require('events');

class MyAntenna extends EventEmitter {
  constructor() {
    super();
    this._timer = null;
  }

  /** Called by index.js to start capture. */
  start() {
    console.log('[MyAntenna] Starting capture…');
    // Connect to hardware, open serial port, spawn subprocess, etc.
    // Call this._emitFrame() whenever you have new data.
  }

  /** Called on graceful shutdown. */
  stop() {
    // Clean up resources
    console.log('[MyAntenna] Stopped');
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
      doa:      135,                   // degrees 0-360 (Direction of Arrival)
      freqMHz:  2437,                  // centre frequency in MHz
      channel:  6,                     // logical channel number
      protocol: 'IEEE 802.11n',        // human-readable protocol
      active:   true,                  // is the device currently transmitting?
      beatFreq: 0.8,                   // 0–2 Hz visual beat speed
      timestamp: Date.now(),
    }];
  }
}

module.exports = MyAntenna;
```

### Frame contract

| Field       | Type    | Required | Description                              |
|-------------|---------|----------|------------------------------------------|
| `id`        | string  | ✅       | Stable unique identifier for this device |
| `ssid`      | string  | ✅       | Human-readable name                      |
| `mac`       | string  | ✅       | Hardware address                         |
| `rssi`      | number  | ✅       | Signal strength in dBm                   |
| `doa`       | number  | ✅       | Direction of Arrival, 0–360°             |
| `freqMHz`   | number  | ✅       | Centre frequency in MHz                  |
| `channel`   | number  | ✅       | Logical channel number                   |
| `protocol`  | string  | ✅       | Protocol string                          |
| `active`    | boolean | ✅       | Whether the device is transmitting       |
| `beatFreq`  | number  | ✅       | Visual beat frequency 0–2               |
| `timestamp` | number  | ✅       | Unix timestamp ms                        |

---

## Step 2 – Register in index.js

Open `backend/src/index.js` and add your backend to the conditional:

```js
const MyAntenna = require('./sdr/myAntenna');

// Change the SDR selection logic:
const sdr = DEMO_MODE
  ? new DemoSDR()
  : process.env.SDR_TYPE === 'myantenna'
    ? new MyAntenna()
    : new HardwareSDR();
```

## Step 3 – Add an environment variable (optional)

In `backend/.env` set:
```
DEMO_MODE=false
SDR_TYPE=myantenna
```

---

## Step 4 – Direction of Arrival (DoA)

DoA is the most hardware-specific part.

### With a single omnidirectional antenna
DoA is unavailable – emit `doa: 0` and the visualisation will show all ripples
pointing north. The RSSI and frequency data will still animate correctly.

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

## Supported protocols beyond Wi-Fi

The visualiser is protocol-agnostic. You can adapt it for:

| Protocol       | Tools             | Notes                                     |
|----------------|-------------------|-------------------------------------------|
| Bluetooth LE   | `btlejuice`, `ubertooth` | Use RSSI from HCI events           |
| Zigbee         | `wireshark`, `killerbee` | 2.4 GHz, channel 11-26             |
| Z-Wave         | `z-wave-js`       | 868/908 MHz                               |
| LoRa           | `chirpstack`      | TTN gateway data                          |
| ADS-B (planes) | `dump1090`        | 1090 MHz, use GPS coords as DoA           |
| APRS (ham)     | `direwolf`        | 144.390 MHz                               |
| FM RDS         | `redsea`          | station name as SSID                      |

---

## Contributing

Pull requests for new SDR backends are welcome!

1. Add your module in `backend/src/sdr/`
2. Document the hardware requirements here
3. Add a demo entry in `DemoSDR._generateSignals()` for testing
