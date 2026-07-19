'use strict';

/**
 * Misc utility functions used across the backend.
 */

/**
 * Clamp a value between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Linearly interpolate between a and b by t (0–1).
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Exponential moving average.
 * @param {number} prev  - Previous smoothed value
 * @param {number} next  - New raw value
 * @param {number} alpha - Smoothing factor (0 = no change, 1 = instant)
 * @returns {number}
 */
function ema(prev, next, alpha) {
  return prev + alpha * (next - prev);
}

/**
 * Normalise an angle to [0, 360).
 * @param {number} deg
 * @returns {number}
 */
function normaliseDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Convert dBm RSSI to a 0–1 strength factor.
 * Typical range: -100 dBm (weakest) → -20 dBm (strongest).
 * @param {number} rssi  dBm value
 * @returns {number}     0–1
 */
function rssiToStrength(rssi) {
  const MIN_RSSI = -100;
  const MAX_RSSI = -20;
  return clamp((rssi - MIN_RSSI) / (MAX_RSSI - MIN_RSSI), 0, 1);
}

/**
 * Generate a simple random ID.
 * @param {number} [len=8]
 * @returns {string}
 */
function randomId(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0');
}

/**
 * Format a MAC address from a random buffer.
 * @param {Buffer|Uint8Array} buf  6-byte buffer
 * @returns {string}  xx:xx:xx:xx:xx:xx
 */
function bufToMac(buf) {
  return Array.from(buf.slice(0, 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

module.exports = { clamp, lerp, ema, normaliseDeg, rssiToStrength, randomId, bufToMac };
