# Mr. Wiggles 🌀

> Real-time wireless signal fox hunting sonar visualizer

Mr. Wiggles turns the Wi-Fi and Bluetooth adapters already built into your laptop or
Raspberry Pi into a visual signal radar. It displays animated crescent ripples on a
black-canvas sonar view that show **RSSI**, **Direction of Arrival (DoA)**, and
**frequency** of detected wireless signals in real time.

Works on desktop **and** mobile — and can be installed as an app on your phone.

---

## Features

| Feature | Description |
|---------|-------------|
| 🌊 Crescent ripples | Arc waves emanate from centre in the DoA direction |
| 🎵 Beat waves | Sinusoidal oscillations along each crescent show frequency |
| 📶 RSSI → thickness | Stronger signal = thicker, brighter crescent |
| 📍 Located indicator | Glowing circle + banner when RSSI threshold is reached |
| 📡 Interactive menu | Dropdown to pick which signal to hunt |
| 📱 Mobile-friendly | Full-screen canvas, bottom-sheet drawer, touch targets |
| 📲 PWA installable | Add to Home Screen on iOS and Android – works offline |
| 🔌 No specialist hardware | Uses built-in Wi-Fi + BLE adapters (no SDR dongle needed) |
| 🎮 Demo mode | Optional synthetic data for UI development |
| 🔄 WebSocket | Real-time 60 Hz data push to the browser |

---

## Quick Start

### Prerequisites

- Node.js 18+
- A computer with a Wi-Fi adapter (built-in is fine)
- (Optional) Bluetooth adapter for BLE scanning
- (Optional) ESP32 with Mr. Wiggles firmware for extended range

### 1. Clone and install

```bash
git clone https://github.com/GG-93/mr-wiggles.git
cd mr-wiggles
npm install
```

### 2. Configure

```bash
cp backend/.env.example backend/.env
```

The defaults in `.env.example` are already set for **real scanning**:
- `DEMO_MODE=false` – uses your actual Wi-Fi and Bluetooth adapters
- `HOST=0.0.0.0` – listens on all network interfaces so your phone can connect

Edit `backend/.env` if you need to change the port or disable BLE.

### 3. Run

```bash
npm start
```

Open **http://localhost:3000** in your browser.

---

## Accessing from your phone

Because the server binds to `0.0.0.0` by default, any device on the same Wi-Fi
network can reach it.

1. Find your computer's local IP address:
   - **macOS/Linux**: `ip route get 1 | awk '{print $7}'` or check System Settings → Wi-Fi
   - **Windows**: `ipconfig` → look for IPv4 Address under your Wi-Fi adapter
2. On your phone (same Wi-Fi), open: `http://192.168.x.x:3000` (use your actual IP)
3. The sonar view fills the screen; tap **☰** in the top-right corner to open the
   signal panel.

---

## Installing as an app (PWA)

Mr. Wiggles is a **Progressive Web App** — you can add it to your phone's home
screen and it will launch full-screen, just like a native app.

### Android (Chrome)
1. Open `http://your-ip:3000` in Chrome on your phone
2. Tap the **⋮** menu → **Add to Home screen**
3. Tap **Add** — the app icon appears on your home screen

### iOS (Safari)
1. Open `http://your-ip:3000` in Safari on your iPhone/iPad
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** — the app icon appears on your home screen

> **Note:** On iOS, Safari is required for "Add to Home Screen". Chrome on iOS
> does not support PWA installation.

---

## Hardware

Mr. Wiggles uses the wireless adapters already in your device — no extra hardware
is required to get started.

| Scanner | What it detects | Requirements |
|---------|----------------|--------------|
| **Wi-Fi** | 2.4 GHz & 5 GHz networks, RSSI, BSSID, channel | None – built-in OS commands |
| **Bluetooth LE** | BLE beacons, devices, RSSI | `npm install @abandonware/noble` (see below) |
| **ESP32 serial** | Extended-range RF bridge | ESP32 + USB cable + Mr. Wiggles firmware |

### Optional: enable Bluetooth LE scanning

```bash
cd backend
npm install @abandonware/noble
```

Linux also requires:
```bash
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

After installing, set `ENABLE_BLE=true` in `backend/.env` (it is `true` by default).

### Optional: ESP32 serial bridge

Connect an ESP32 flashed with the Mr. Wiggles firmware via USB, then set
`ESP32_PORT` in `backend/.env`:

```
ESP32_PORT=/dev/ttyUSB0            # Linux
ESP32_PORT=/dev/cu.usbserial-0001  # macOS
ESP32_PORT=COM3                    # Windows
```

Requires: `npm install serialport` (inside `backend/`).

---

## Demo mode

Demo mode generates synthetic signal data for UI development and screenshots. It
is **disabled by default** in favour of real scanning.

To enable it, set in `backend/.env`:

```
DEMO_MODE=true
```

---

## Project Structure

```
mr-wiggles/
├── backend/
│   ├── src/
│   │   ├── index.js               Main server (Express + WebSocket)
│   │   ├── sdr/
│   │   │   ├── demoSDR.js         Synthetic signal generator
│   │   │   ├── nativeScanner.js   Orchestrates Wi-Fi + BLE + ESP32
│   │   │   ├── wifiScanner.js     OS-level Wi-Fi scanning
│   │   │   ├── bleScanner.js      Bluetooth LE via noble (optional)
│   │   │   └── esp32Scanner.js    USB serial bridge (optional)
│   │   ├── processors/
│   │   │   └── signalManager.js   Smoothing, threshold detection
│   │   └── utils/
│   │       ├── wsServer.js        WebSocket broadcast server
│   │       └── helpers.js         Math helpers (EMA, RSSI→strength, etc.)
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── manifest.json              PWA web app manifest
│   ├── sw.js                      Service worker (offline shell caching)
│   ├── icons/
│   │   ├── icon.svg
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── js/
│   │   ├── app.js                 Main controller
│   │   ├── renderer.js            Canvas animation engine
│   │   └── wsClient.js            WebSocket client (auto-reconnect)
│   └── css/
│       └── style.css
├── scripts/
│   ├── generate-icons.js          Regenerate PWA PNG icons
│   └── install-sdr.sh             Legacy SDR driver installer (Linux)
├── docs/
│   └── extending-antennas.md      Guide: add new scanner backends
├── package.json                   Root workspace
└── README.md
```

---

## Visual Parameter Mapping

| Signal Property | Visual Effect |
|-----------------|---------------|
| RSSI (dBm) | Crescent line thickness + brightness |
| Direction of Arrival (°) | Crescent emanation angle from centre |
| Frequency (MHz) | Ripple travel speed + beat wave frequency |
| Active transmission | Beat wave animation intensity |
| RSSI ≥ threshold | Green glowing circle + "Signal Located!" banner |

---

## Configuration Reference (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` = all interfaces) |
| `DEMO_MODE` | `false` | `true` = synthetic data, `false` = real hardware |
| `DEMO_SIGNAL_COUNT` | `5` | Number of virtual signals (demo only) |
| `DEMO_UPDATE_RATE_HZ` | `60` | Demo frame rate |
| `WIFI_SCAN_INTERVAL_MS` | `4000` | Milliseconds between Wi-Fi scans |
| `ENABLE_BLE` | `true` | Set to `false` to disable BLE even if noble is installed |
| `ESP32_PORT` | *(unset)* | Serial port for attached ESP32 (leave blank to disable) |
| `ESP32_BAUD` | `115200` | Baud rate for ESP32 serial |
| `RSSI_THRESHOLD` | `-60` | dBm threshold for "located" |
| `DOA_SMOOTHING` | `0.3` | EMA alpha for DoA (0–1) |
| `WS_BROADCAST_RATE_HZ` | `60` | WebSocket update rate |

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Server status and mode |
| `GET` | `/api/signals` | Current signal snapshot |
| `POST` | `/api/target` | Set hunt target `{ "id": "..." }` |

WebSocket endpoint: `ws://your-ip:3000/ws`

---

## Extending

See **[docs/extending-antennas.md](docs/extending-antennas.md)** for a complete guide on adding new scanner backends, antenna types, and protocols (Bluetooth, Zigbee, LoRa, ADS-B, and more).

---

## License

MIT
