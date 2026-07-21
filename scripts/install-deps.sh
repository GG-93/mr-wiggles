#!/usr/bin/env bash
# ============================================================
# Mr. Wiggles – Dependency Installer
# Sets up Wi-Fi scanning, Bluetooth / BLE, and ESP32 serial
# Supports: Ubuntu / Debian / Raspberry Pi OS
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[*]${RESET} $*"; }
ok()   { echo -e "${GREEN}[✓]${RESET} $*"; }
warn() { echo -e "${YELLOW}[!]${RESET} $*"; }
err()  { echo -e "${RED}[✗]${RESET} $*" >&2; }

# ── Root check ──────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "This script must be run as root. Use: sudo ./install-deps.sh"
  exit 1
fi

# ── Detect OS ───────────────────────────────────────────────
if ! command -v apt-get &>/dev/null; then
  err "This script requires apt-get (Ubuntu/Debian/Raspberry Pi OS)."
  exit 1
fi

# Resolve the repo root (two levels up from scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"

log "Updating package lists…"
apt-get update -qq

# ── Node.js (if not present) ────────────────────────────────
if ! command -v node &>/dev/null; then
  log "Installing Node.js 20 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  ok "Node.js $(node -v) installed"
else
  ok "Node.js already installed: $(node -v)"
fi

# ── Build tools (needed for native Node.js modules) ─────────
log "Installing build tools…"
apt-get install -y -qq build-essential python3 python3-pip

# ── Wi-Fi scanning tools ─────────────────────────────────────
install_wifi() {
  log "Checking Wi-Fi scanning tools…"

  if command -v nmcli &>/dev/null; then
    ok "nmcli (NetworkManager) already available"
  else
    log "Installing NetworkManager for nmcli…"
    apt-get install -y -qq network-manager
    ok "nmcli installed"
  fi

  # Fallback: iwlist from wireless-tools
  if ! command -v iwlist &>/dev/null; then
    log "Installing wireless-tools (iwlist fallback)…"
    apt-get install -y -qq wireless-tools
    ok "iwlist installed"
  fi
}

# ── Bluetooth / BLE ──────────────────────────────────────────
install_bluetooth() {
  log "Installing Bluetooth / BLE dependencies…"
  apt-get install -y -qq bluetooth bluez libbluetooth-dev libudev-dev

  # Enable and start bluetoothd
  systemctl enable bluetooth 2>/dev/null || true
  systemctl start  bluetooth 2>/dev/null || true

  ok "BlueZ installed and service started"

  log "Installing @abandonware/noble (Node.js BLE library)…"
  if [[ -d "${BACKEND_DIR}" ]]; then
    (cd "${BACKEND_DIR}" && npm install @abandonware/noble)
    ok "@abandonware/noble installed"
  else
    warn "backend/ directory not found – run 'npm install @abandonware/noble' manually in backend/"
  fi

  # Grant Node.js CAP_NET_RAW so non-root users can access BLE
  NODE_BIN="$(which node)"
  setcap cap_net_raw+eip "$(readlink -f "${NODE_BIN}")" 2>/dev/null && \
    ok "Granted CAP_NET_RAW to Node.js (BLE works without sudo)" || \
    warn "Could not set CAP_NET_RAW – you may need to run the backend as root for BLE"
}

# ── ESP32 serial ─────────────────────────────────────────────
install_esp32() {
  log "Setting up ESP32 serial support…"
  apt-get install -y -qq python3-serial

  # Add user to dialout group for serial port access
  if [[ -n "${SUDO_USER:-}" ]]; then
    usermod -aG dialout "$SUDO_USER" 2>/dev/null || true
    ok "Added $SUDO_USER to dialout group (serial port access)"
  fi

  log "Installing serialport (Node.js serial library)…"
  if [[ -d "${BACKEND_DIR}" ]]; then
    (cd "${BACKEND_DIR}" && npm install serialport)
    ok "serialport installed"
  else
    warn "backend/ directory not found – run 'npm install serialport' manually in backend/"
  fi

  ok "ESP32 serial support ready"
  echo ""
  warn "Flash your ESP32 with the Mr. Wiggles firmware (see docs/esp32-firmware-example.md)"
  warn "Then set ESP32_PORT=/dev/ttyUSB0 (or similar) in backend/.env"
}

# ── Menu ─────────────────────────────────────────────────────
echo ""
echo "What do you want to set up?"
echo "  1) Wi-Fi scanning only (nmcli / iwlist – no extra deps)"
echo "  2) Wi-Fi + Bluetooth / BLE (@abandonware/noble)"
echo "  3) Wi-Fi + Bluetooth / BLE + ESP32 serial (serialport)"
echo "  4) All of the above"
echo "  5) Skip (demo mode only)"
echo ""
read -rp "Choice [1-5]: " CHOICE

case "$CHOICE" in
  1) install_wifi ;;
  2) install_wifi; install_bluetooth ;;
  3) install_wifi; install_bluetooth; install_esp32 ;;
  4) install_wifi; install_bluetooth; install_esp32 ;;
  5) warn "Skipping hardware setup. Mr. Wiggles will run in demo mode." ;;
  *) err "Invalid choice. Exiting."; exit 1 ;;
esac

# ── Add user to plugdev ──────────────────────────────────────
if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG plugdev "$SUDO_USER" 2>/dev/null || true
fi

# ── Final message ────────────────────────────────────────────
echo ""
ok "Setup complete!"
echo ""
echo "  Next steps:"
echo "    1. cd mr-wiggles"
echo "    2. npm install"
echo "    3. cp backend/.env.example backend/.env"
echo "    4. Edit backend/.env:"
echo "         • Set DEMO_MODE=false to use real hardware"
echo "         • Set ENABLE_BLE=true (default) to scan Bluetooth LE"
echo "         • Set ESP32_PORT=/dev/ttyUSB0 if using an ESP32"
echo "    5. npm start"
echo "    6. Open http://localhost:3000 in your browser"
echo "       (also accessible from your phone on the same network)"
echo ""
