'use strict';

/**
 * WifiScanner – scans for 2.4 GHz and 5 GHz Wi-Fi networks using built-in
 * OS tools. No additional npm packages required.
 *
 * Platform support:
 *   - Linux  : nmcli (NetworkManager) → falls back to iwlist
 *   - macOS  : airport utility (built into macOS)
 *   - Windows: netsh wlan show networks
 */
const EventEmitter = require('events');
const { execFile } = require('child_process');

const SCAN_INTERVAL_MS = parseInt(process.env.WIFI_SCAN_INTERVAL_MS || '4000', 10);
// macOS airport binary path
const AIRPORT_PATH =
  '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';

/**
 * Matches a single nmcli --terse --escape no line for fields SSID,BSSID,SIGNAL,FREQ.
 * Format: <ssid>:<xx:xx:xx:xx:xx:xx>:<0-100>:<NNNN MHz>
 * The BSSID is identified unambiguously as 6 hex-pairs, allowing SSIDs that contain colons.
 */
const NMCLI_LINE_RE = /^(.*):([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}):(\d+):(\d+)\s+MHz\s*$/;

class WifiScanner extends EventEmitter {
  constructor() {
    super();
    this._timer = null;
    this._platform = process.platform;
    this._available = true;
  }

  start() {
    console.log('[WifiScanner] Starting Wi-Fi scan…');
    // First scan immediately, then on interval
    this._scan();
    this._timer = setInterval(() => this._scan(), SCAN_INTERVAL_MS);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    console.log('[WifiScanner] Stopped');
  }

  // ── private ─────────────────────────────────────────────────────────────

  _scan() {
    if (!this._available) return;
    this._getNetworks()
      .then((networks) => {
        if (networks.length > 0) this.emit('frame', networks);
      })
      .catch((err) => console.error('[WifiScanner]', err.message));
  }

  _getNetworks() {
    switch (this._platform) {
      case 'linux':  return this._scanLinux();
      case 'darwin': return this._scanMacOS();
      case 'win32':  return this._scanWindows();
      default:
        this._available = false;
        return Promise.resolve([]);
    }
  }

  // ── Linux ────────────────────────────────────────────────────────────────

  _scanLinux() {
    return new Promise((resolve) => {
      // Try nmcli first (available on most modern Linux desktops)
      execFile(
        'nmcli',
        ['--terse', '--escape', 'no', '-f', 'SSID,BSSID,SIGNAL,FREQ', 'dev', 'wifi', 'list'],
        { timeout: 8000 },
        (err, stdout) => {
          if (!err && stdout.trim()) {
            return resolve(this._parseNmcli(stdout));
          }
          // Fall back to iwlist (legacy tool)
          this._runIwlist().then(resolve).catch(() => resolve([]));
        }
      );
    });
  }

  /**
   * Parse nmcli --terse --escape no output.
   * Columns: SSID:BSSID:SIGNAL:FREQ
   * BSSID is already unescaped (--escape no), so we split carefully.
   * Format: <ssid>:<xx:xx:xx:xx:xx:xx>:<0-100>:<NNNN MHz>
   */
  _parseNmcli(stdout) {
    const results = [];
    for (const raw of stdout.trim().split('\n')) {
      const line = raw.trim();
      if (!line) continue;

      // The BSSID field is always "xx:xx:xx:xx:xx:xx" (17 chars).
      // Find it with a regex to avoid SSID-colon ambiguity.
      const match = line.match(NMCLI_LINE_RE);
      if (!match) continue;

      const ssid    = match[1] || '(hidden)';
      const mac     = match[2].toLowerCase();
      const signal  = parseInt(match[3], 10); // 0–100
      const freqMHz = parseInt(match[4], 10);

      results.push(this._buildFrame(ssid, mac, this._qualityToRssi(signal), freqMHz));
    }
    return results;
  }

  _runIwlist() {
    return new Promise((resolve, reject) => {
      execFile('iwlist', ['scan'], { timeout: 8000 }, (err, stdout) => {
        if (err) return reject(err);
        resolve(this._parseIwlist(stdout));
      });
    });
  }

  _parseIwlist(stdout) {
    const results = [];
    const cellBlocks = stdout.split(/Cell \d+ - /);
    for (const block of cellBlocks.slice(1)) {
      const macMatch   = block.match(/Address:\s*([0-9A-Fa-f:]{17})/);
      const ssidMatch  = block.match(/ESSID:"([^"]*)"/);
      const rssiMatch  = block.match(/Signal level=(-?\d+)\s*dBm/);
      const freqMatch  = block.match(/Frequency:(\d+\.?\d*)\s*GHz/);
      const chanMatch  = block.match(/Channel:?(\d+)/);

      if (!macMatch || !rssiMatch || !freqMatch) continue;

      const mac     = macMatch[1].toLowerCase();
      const ssid    = ssidMatch ? ssidMatch[1] : '(hidden)';
      const rssi    = parseInt(rssiMatch[1], 10);
      const freqMHz = Math.round(parseFloat(freqMatch[1]) * 1000);

      results.push(this._buildFrame(ssid, mac, rssi, freqMHz));
    }
    return results;
  }

  // ── macOS ────────────────────────────────────────────────────────────────

  _scanMacOS() {
    return new Promise((resolve) => {
      execFile(AIRPORT_PATH, ['-s'], { timeout: 8000 }, (err, stdout) => {
        if (err) {
          console.warn('[WifiScanner] airport not available:', err.message);
          this._available = false;
          return resolve([]);
        }
        resolve(this._parseAirport(stdout));
      });
    });
  }

  /**
   * airport -s output (fixed-width columns):
   *          SSID BSSID             RSSI CHANNEL HT CC SECURITY
   *   HomeNetwork aa:bb:cc:dd:ee:ff  -65  6       Y  US RSN(PSK/AES/AES)
   */
  _parseAirport(stdout) {
    const results = [];
    const lines = stdout.trim().split('\n').slice(1); // skip header
    for (const line of lines) {
      const match = line.match(
        /^\s+(.+?)\s+([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})\s+(-\d+)\s+(\d+[A-Z,]*)/
      );
      if (!match) continue;

      const ssid    = match[1].trim() || '(hidden)';
      const mac     = match[2].toLowerCase();
      const rssi    = parseInt(match[3], 10);
      const channel = parseInt(match[4], 10);
      const freqMHz = this._channelToFreq(channel);

      results.push(this._buildFrame(ssid, mac, rssi, freqMHz));
    }
    return results;
  }

  // ── Windows ──────────────────────────────────────────────────────────────

  _scanWindows() {
    return new Promise((resolve) => {
      execFile(
        'netsh',
        ['wlan', 'show', 'networks', 'mode=bssid'],
        { timeout: 8000 },
        (err, stdout) => {
          if (err) {
            console.warn('[WifiScanner] netsh not available:', err.message);
            this._available = false;
            return resolve([]);
          }
          resolve(this._parseNetsh(stdout));
        }
      );
    });
  }

  /**
   * Parse `netsh wlan show networks mode=bssid` output.
   * Blocks are separated by blank lines between SSIDs.
   */
  _parseNetsh(stdout) {
    const results = [];
    // Split into SSID blocks
    const ssidBlocks = stdout.split(/\r?\nSSID \d+\s*:/);
    for (const block of ssidBlocks.slice(1)) {
      const ssidMatch = block.match(/^\s*(.+)/);
      const bssidSection = block.split(/\r?\n\s*BSSID \d+\s*:/);

      const ssid = ssidMatch ? ssidMatch[1].trim() : '(hidden)';

      for (const bssidBlock of bssidSection.slice(1)) {
        const macMatch  = bssidBlock.match(/^\s*([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})/);
        const sigMatch  = bssidBlock.match(/Signal\s*:\s*(\d+)%/);
        const chanMatch = bssidBlock.match(/Channel\s*:\s*(\d+)/);

        if (!macMatch || !sigMatch) continue;

        const mac     = macMatch[1].toLowerCase();
        const signal  = parseInt(sigMatch[1], 10);
        const rssi    = this._qualityToRssi(signal);
        const channel = chanMatch ? parseInt(chanMatch[1], 10) : 0;
        const freqMHz = this._channelToFreq(channel);

        results.push(this._buildFrame(ssid, mac, rssi, freqMHz));
      }
    }
    return results;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /**
   * Build a standard signal frame from parsed Wi-Fi network data.
   */
  _buildFrame(ssid, mac, rssi, freqMHz) {
    const channel  = this._freqToChannel(freqMHz);
    const band     = freqMHz >= 5000 ? '5 GHz' : '2.4 GHz';
    const protocol = freqMHz >= 5000 ? 'Wi-Fi (5 GHz)' : 'Wi-Fi (2.4 GHz)';
    const beatFreq = freqMHz >= 5000 ? 1.2 : 0.6;
    return {
      id:        `wifi-${mac}`,
      ssid:      ssid || '(hidden)',
      mac,
      rssi,
      // DoA requires a directional antenna or phased array; emit 0 as placeholder.
      doa:       0,
      freqMHz,
      channel,
      protocol,
      active:    rssi > -90,
      beatFreq,
      band,
      timestamp: Date.now(),
    };
  }

  /** Convert signal quality percentage (0–100) to approximate dBm. */
  _qualityToRssi(quality) {
    return Math.round(-100 + (quality / 100) * 70);
  }

  /**
   * Map 2.4 GHz / 5 GHz channel number to centre frequency in MHz.
   * Formula per IEEE 802.11-2020 §19.3.15 and §21.3.14:
   *   2.4 GHz: f = 2407 + ch * 5  (channels 1–14)
   *   5 GHz:   f = 5000 + ch * 5  (channels 36–177, covering UNII-1 through UNII-4)
   */
  _channelToFreq(channel) {
    if (channel >= 1 && channel <= 14)   return 2407 + channel * 5;
    if (channel >= 36 && channel <= 177) return 5000 + channel * 5;
    return 2437; // default: 2.4 GHz ch 6
  }

  /**
   * Map frequency in MHz to channel number.
   * Covers 2.4 GHz (ch 1–13, 2412–2472 MHz) and 5 GHz (ch 36–165, 5180–5825 MHz).
   */
  _freqToChannel(freqMHz) {
    if (freqMHz >= 2412 && freqMHz <= 2484) return Math.round((freqMHz - 2407) / 5);
    if (freqMHz >= 5180 && freqMHz <= 5885) return Math.round((freqMHz - 5000) / 5);
    return 0;
  }
}

module.exports = WifiScanner;
