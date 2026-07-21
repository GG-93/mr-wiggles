#!/usr/bin/env bash
# ============================================================
# Mr. Wiggles – SDR Driver & Dependency Installer
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
  err "This script must be run as root. Use: sudo ./install-sdr.sh"
  exit 1
fi

# ── Detect OS ───────────────────────────────────────────────
if ! command -v apt-get &>/dev/null; then
  err "This script requires apt-get (Ubuntu/Debian/Raspberry Pi OS)."
  exit 1
fi

log "Updating package lists…"
apt-get update -qq

# ── Common build tools ──────────────────────────────────────
log "Installing build tools…"
apt-get install -y -qq build-essential cmake git pkg-config libusb-1.0-0-dev

# ── Node.js (if not present) ────────────────────────────────
if ! command -v node &>/dev/null; then
  log "Installing Node.js 20 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  ok "Node.js $(node -v) installed"
else
  ok "Node.js already installed: $(node -v)"
fi

# ── RTL-SDR ─────────────────────────────────────────────────
install_rtlsdr() {
  log "Installing RTL-SDR…"
  apt-get install -y -qq rtl-sdr librtlsdr-dev

  # Blacklist DVB kernel modules that conflict with rtl-sdr
  BLACKLIST="/etc/modprobe.d/rtlsdr-blacklist.conf"
  if [[ ! -f "$BLACKLIST" ]]; then
    cat > "$BLACKLIST" <<'EOF'
blacklist dvb_usb_rtl28xxu
blacklist rtl2832
blacklist rtl2830
EOF
    ok "Kernel modules blacklisted: $BLACKLIST"
  fi

  # udev rule so non-root users can access device
  UDEV="/etc/udev/rules.d/10-rtlsdr.rules"
  if [[ ! -f "$UDEV" ]]; then
    echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2838", GROUP="plugdev", MODE="0666", SYMLINK+="rtl_sdr"' > "$UDEV"
    udevadm control --reload-rules && udevadm trigger
    ok "udev rule installed: $UDEV"
  fi

  if command -v rtl_test &>/dev/null; then
    ok "RTL-SDR installed successfully (rtl_test found)"
  else
    warn "RTL-SDR binaries not found in PATH – you may need to reboot"
  fi
}

# ── HackRF ──────────────────────────────────────────────────
install_hackrf() {
  log "Installing HackRF tools…"
  apt-get install -y -qq hackrf libhackrf-dev

  UDEV="/etc/udev/rules.d/53-hackrf.rules"
  if [[ ! -f "$UDEV" ]]; then
    cat > "$UDEV" <<'EOF'
ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", SYMLINK+="hackrf-jawbreaker", GROUP="plugdev", MODE="0666"
ATTR{idVendor}=="1d50", ATTR{idProduct}=="604b", SYMLINK+="hackrf-one", GROUP="plugdev", MODE="0666"
ATTR{idVendor}=="1d50", ATTR{idProduct}=="6003", SYMLINK+="rad1o", GROUP="plugdev", MODE="0666"
EOF
    udevadm control --reload-rules && udevadm trigger
    ok "udev rule installed: $UDEV"
  fi

  if command -v hackrf_info &>/dev/null; then
    ok "HackRF installed successfully (hackrf_info found)"
  else
    warn "HackRF binaries not found in PATH – you may need to reboot"
  fi
}

# ── Menu ─────────────────────────────────────────────────────
echo ""
echo "Which SDR hardware do you want to install drivers for?"
echo "  1) RTL-SDR (Realtek RTL2832U – cheap USB dongles)"
echo "  2) HackRF One"
echo "  3) Both"
echo "  4) Skip (demo mode only)"
echo ""
read -rp "Choice [1-4]: " CHOICE

case "$CHOICE" in
  1) install_rtlsdr ;;
  2) install_hackrf ;;
  3) install_rtlsdr; install_hackrf ;;
  4) warn "Skipping SDR driver installation. Mr. Wiggles will run in demo mode." ;;
  *) err "Invalid choice. Exiting."; exit 1 ;;
esac

# ── Add user to plugdev ──────────────────────────────────────
if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG plugdev "$SUDO_USER" 2>/dev/null || true
  ok "Added $SUDO_USER to plugdev group (log out and back in for effect)"
fi

# ── Final message ────────────────────────────────────────────
echo ""
ok "SDR setup complete!"
echo ""
echo "  Next steps:"
echo "    1. cd mr-wiggles"
echo "    2. npm install"
echo "    3. cp backend/.env.example backend/.env"
echo "    4. Edit backend/.env (set DEMO_MODE=false to use hardware)"
echo "    5. npm start"
echo "    6. Open http://localhost:3000 in your browser"
echo ""
