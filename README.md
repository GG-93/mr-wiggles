# Mr. Wiggles 🌀

> Real-time wireless signal fox hunting sonar visualizer

Mr. Wiggles turns your SDR antenna into a visual signal radar.
It displays animated crescent ripples on a black-canvas sonar view that show **RSSI**, **Direction of Arrival (DoA)**, and **frequency** of detected wireless signals in real time.

---

## Features

| Feature | Description |
|---------|-------------|
| 🌊 Crescent ripples | Arc waves emanate from centre in the DoA direction |
| 🎵 Beat waves | Sinusoidal oscillations along each crescent show frequency |
| 📶 RSSI → thickness | Stronger signal = thicker, brighter crescent |
| 📍 Located indicator | Glowing circle + banner when RSSI threshold is reached |
| 📡 Interactive menu | Dropdown to pick which signal to hunt |
| 🎮 Demo mode | Runs synthetic data with no hardware required |
| 🔌 Hardware SDR | RTL-SDR & HackRF support via `rtl_power` / `hackrf_sweep` |
| 🔄 WebSocket | Real-time 60 Hz data push to the browser |
| 🖥 240 Hz canvas | Silky-smooth animation via `requestAnimationFrame` |

---

## Quick Start

### Prerequisites

- Node.js 18+
- (Optional) RTL-SDR or HackRF hardware

### 1. Clone and install

```bash
git clone https://github.com/GG-93/mr-wiggles.git
cd mr-wiggles
npm install
```

### 2. Configure

```bash
cp backend/.env.example backend/.env
# Edit backend/.env – set DEMO_MODE=true for testing without hardware
```

### 3. Run

```bash
npm start
```

Open **http://localhost:3000** in your browser.

---

## Demo Mode

Demo mode generates synthetic signal data so you can explore the visualiser without
any hardware. It is enabled by default (`DEMO_MODE=true` in `.env`).

Five virtual Wi-Fi signals are simulated with:
- Slowly drifting DoA
- Fluctuating RSSI (simulates movement)
- Random transmission bursts

---

## Hardware Setup (RTL-SDR / HackRF)

```bash
sudo ./scripts/install-sdr.sh
```

The script installs OS drivers, udev rules, and blacklists conflicting kernel modules.
After installation set `DEMO_MODE=false` in `backend/.env`.

---

## Project Structure

```
mr-wiggles/
├── backend/
│   ├── src/
│   │   ├── index.js               Main server (Express + WebSocket)
│   │   ├── sdr/
│   │   │   ├── demoSDR.js         Synthetic signal generator
│   │   │   └── hardwareSDR.js     RTL-SDR / HackRF interface
│   │   ├── processors/
│   │   │   └── signalManager.js   Smoothing, threshold detection
│   │   └── utils/
│   │       ├── wsServer.js        WebSocket broadcast server
│   │       └── helpers.js         Math helpers (EMA, RSSI→strength, etc.)
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── js/
│   │   ├── app.js                 Main controller
│   │   ├── renderer.js            Canvas animation engine
│   │   └── wsClient.js            WebSocket client (auto-reconnect)
│   └── css/
│       └── style.css
├── scripts/
│   └── install-sdr.sh             SDR driver installer (Linux)
├── docs/
│   └── extending-antennas.md      Guide: add new SDR backends
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
| `DEMO_MODE` | `true` | Use synthetic data |
| `DEMO_SIGNAL_COUNT` | `5` | Number of virtual signals |
| `DEMO_UPDATE_RATE_HZ` | `60` | Demo frame rate |
| `SDR_TYPE` | `auto` | `rtlsdr`, `hackrf`, or `auto` |
| `SDR_CENTER_FREQ` | `2437000000` | Centre frequency (Hz) |
| `SDR_GAIN` | `20` | SDR gain (dB) |
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

WebSocket endpoint: `ws://localhost:3000/ws`

---

## Extending

See **[docs/extending-antennas.md](docs/extending-antennas.md)** for a complete guide on adding new SDR hardware backends, antenna types, and protocols (Bluetooth, Zigbee, LoRa, ADS-B, and more).

---

## License

MIT
