'use strict';

/**
 * HardwareSDR – interface to physical SDR hardware (HackRF / RTL-SDR).
 *
 * This module wraps the system-level SDR tools via child_process.
 * Supported backends:
 *   - rtlsdr  → rtl_power / rtl_fm
 *   - hackrf  → hackrf_sweep
 *   - auto    → auto-detect
 *
 * When hardware is unavailable or DEMO_MODE=true, use DemoSDR instead.
 */
const EventEmitter = require('events');
const { spawn } = require('child_process');
const { normaliseDeg, rssiToStrength } = require('../utils/helpers');

const SDR_TYPE = (process.env.SDR_TYPE || 'auto').toLowerCase();
const SAMPLE_RATE = parseInt(process.env.SDR_SAMPLE_RATE || '2000000', 10);
const CENTER_FREQ = parseInt(process.env.SDR_CENTER_FREQ || '2437000000', 10);
const GAIN = parseInt(process.env.SDR_GAIN || '20', 10);

class HardwareSDR extends EventEmitter {
  constructor() {
    super();
    this._proc = null;
    this._type = SDR_TYPE;
  }

  start() {
    this._type = this._type === 'auto' ? this._detect() : this._type;
    console.log(`[HardwareSDR] Starting with backend: ${this._type}`);

    if (this._type === 'none') {
      this.emit('error', new Error(
        'No supported SDR hardware found. ' +
        'Install rtl-sdr or hackrf tools, or set DEMO_MODE=true.'
      ));
      return;
    }

    this._spawn();
  }

  stop() {
    if (this._proc) {
      this._proc.kill('SIGTERM');
      this._proc = null;
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  _detect() {
    try {
      const { execSync } = require('child_process');
      execSync('which rtl_power', { stdio: 'ignore' });
      return 'rtlsdr';
    } catch (_) {}
    try {
      const { execSync } = require('child_process');
      execSync('which hackrf_sweep', { stdio: 'ignore' });
      return 'hackrf';
    } catch (_) {}
    return 'none';
  }

  _spawn() {
    const args = this._buildArgs();
    console.log(`[HardwareSDR] Spawning: ${args[0]} ${args.slice(1).join(' ')}`);

    this._proc = spawn(args[0], args.slice(1));
    let buffer = '';

    this._proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line
      lines.forEach((line) => this._parseLine(line.trim()));
    });

    this._proc.stderr.on('data', (d) => console.error('[HardwareSDR]', d.toString().trim()));

    this._proc.on('close', (code) => {
      console.log(`[HardwareSDR] Process exited with code ${code}`);
      this._proc = null;
      if (code !== 0) {
        this.emit('error', new Error(`SDR process exited with code ${code}`));
      }
    });
  }

  _buildArgs() {
    if (this._type === 'rtlsdr') {
      // rtl_power -f 2400M:2480M:1M -g 20 -i 1 -
      const freqMHz = Math.round(CENTER_FREQ / 1e6);
      return [
        'rtl_power',
        '-f', `${freqMHz - 40}M:${freqMHz + 40}M:1M`,
        '-g', String(GAIN),
        '-i', '1',
        '-',
      ];
    }
    if (this._type === 'hackrf') {
      const freqMHz = Math.round(CENTER_FREQ / 1e6);
      return [
        'hackrf_sweep',
        '-f', `${freqMHz - 40}:${freqMHz + 40}`,
        '-g', String(GAIN),
        '-l', '32',
      ];
    }
    return [];
  }

  /**
   * Parse a line from the SDR tool stdout and emit a frame.
   * Supports rtl_power CSV format and hackrf_sweep format.
   */
  _parseLine(line) {
    if (!line) return;

    try {
      // rtl_power CSV: date, time, hz_low, hz_high, hz_step, samples, db...
      const parts = line.split(',').map((s) => s.trim());
      if (parts.length < 7) return;

      const freqLow = parseFloat(parts[2]);
      const freqHigh = parseFloat(parts[3]);
      const freqMHz = Math.round((freqLow + freqHigh) / 2 / 1e6);
      const dbValues = parts.slice(6).map(Number).filter((v) => !isNaN(v));
      if (!dbValues.length) return;

      const rssi = dbValues.reduce((a, b) => a + b, 0) / dbValues.length;
      const active = rssi > parseFloat(process.env.RSSI_THRESHOLD || '-60');

      // Approximate DoA from frequency peak position (requires multi-antenna setup)
      const doa = this._estimateDoa(dbValues);

      const frame = [{
        id: `hw-${freqMHz}`,
        ssid: `Channel ${freqMHz}MHz`,
        mac: '00:00:00:00:00:00',
        rssi: Math.round(rssi * 10) / 10,
        doa,
        freqMHz,
        channel: this._freqToChannel(freqMHz),
        protocol: 'IEEE 802.11',
        active,
        beatFreq: 0.5 + (freqMHz - 2412) / 3000,
        timestamp: Date.now(),
      }];

      this.emit('frame', frame);
    } catch (err) {
      // skip unparseable lines
    }
  }

  /**
   * Estimate DoA from power distribution across antenna array.
   * Placeholder – real DoA needs a phased array or multiple antennas.
   * @param {number[]} dbValues
   * @returns {number} degrees
   */
  _estimateDoa(dbValues) {
    // Find the index of the peak and map to 0-360°
    const peak = dbValues.indexOf(Math.max(...dbValues));
    return normaliseDeg((peak / dbValues.length) * 360);
  }

  _freqToChannel(freqMHz) {
    // 2.4 GHz band
    if (freqMHz >= 2412 && freqMHz <= 2484) {
      return Math.round((freqMHz - 2407) / 5);
    }
    // 5 GHz band
    if (freqMHz >= 5170 && freqMHz <= 5825) {
      return Math.round((freqMHz - 5000) / 5);
    }
    return 0;
  }
}

module.exports = HardwareSDR;
