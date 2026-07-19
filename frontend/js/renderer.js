/**
 * renderer.js – HTML5 Canvas animation engine for Mr. Wiggles.
 *
 * Renders:
 *   • Black background
 *   • Center origin circle
 *   • Crescent ripples emanating in DoA direction (per signal)
 *   • Nested ripple layers per frequency
 *   • Beat waves travelling along crescents
 *   • Hard circle when signal is located (RSSI threshold)
 *
 * Targets 240 Hz using requestAnimationFrame + uncapped loop.
 */
'use strict';

class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._signals = [];
    this._targetId = null;
    this._time = 0;
    this._lastTs = null;
    this._rafId = null;

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Ripple ring pool – each ring travels outward
    this._rings = new Map(); // signalId → Ring[]
  }

  /** Update the list of signals to render. */
  setSignals(signals) {
    this._signals = signals;
  }

  setTarget(id) {
    this._targetId = id;
  }

  start() {
    if (this._rafId) return;
    this._lastTs = performance.now();
    this._loop(this._lastTs);
  }

  stop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ── private ───────────────────────────────────────────────────────────

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    this._canvas.width = w * dpr;
    this._canvas.height = h * dpr;
    this._ctx.scale(dpr, dpr);
    this._w = w;
    this._h = h;
    this._cx = w / 2;
    this._cy = h / 2;
    this._maxR = Math.min(w, h) * 0.45;
  }

  _loop(ts) {
    this._rafId = requestAnimationFrame((t) => this._loop(t));
    const dt = (ts - (this._lastTs || ts)) / 1000; // seconds
    this._lastTs = ts;
    this._time += dt;
    this._update(dt);
    this._draw();
  }

  /** Spawn new ripple rings and age existing ones. */
  _update(dt) {
    for (const sig of this._signals) {
      if (!this._rings.has(sig.id)) {
        this._rings.set(sig.id, []);
      }
      const rings = this._rings.get(sig.id);

      // Spawn a new ring every ~0.4s (adjusted by beat freq)
      const spawnInterval = 0.4 / (sig.beatFreq || 0.5);
      if (!sig._nextSpawn || this._time >= sig._nextSpawn) {
        sig._nextSpawn = this._time + spawnInterval;
        rings.push({
          radius: 0,
          alpha: 0.9,
          doa: sig.doa,
          rssi: sig.rssi,
          strength: sig.strength || 0.5,
          active: sig.active,
          beatFreq: sig.beatFreq || 0.5,
          beatPhase: Math.random() * Math.PI * 2,
          born: this._time,
        });
      }

      // Age rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        const speed = this._maxR * (0.25 + (sig.beatFreq || 0.5) * 0.35);
        r.radius += speed * dt;
        r.alpha = Math.max(0, 0.9 - (r.radius / this._maxR) * 0.9);
        if (r.radius > this._maxR * 1.1) {
          rings.splice(i, 1);
        }
      }
    }

    // Remove rings for signals that disappeared
    for (const id of this._rings.keys()) {
      if (!this._signals.find((s) => s.id === id)) {
        this._rings.delete(id);
      }
    }
  }

  _draw() {
    const ctx = this._ctx;
    const { _w: w, _h: h, _cx: cx, _cy: cy } = this;

    // ── Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // ── Subtle grid
    this._drawGrid(ctx, cx, cy, w, h);

    // ── Per-signal rendering
    const targetSig = this._signals.find((s) => s.id === this._targetId);

    // Render all non-target signals first (dimmer)
    for (const sig of this._signals) {
      if (sig.id === this._targetId) continue;
      this._drawSignal(ctx, sig, false);
    }

    // Render target signal on top (brighter)
    if (targetSig) {
      this._drawSignal(ctx, targetSig, true);
    }

    // ── Center circle (user position)
    this._drawCenter(ctx, cx, cy);
  }

  _drawGrid(ctx, cx, cy, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;

    // Concentric circles
    const step = this._maxR / 5;
    for (let r = step; r <= this._maxR; r += step) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cardinal lines
    ctx.beginPath();
    ctx.moveTo(cx - this._maxR, cy); ctx.lineTo(cx + this._maxR, cy);
    ctx.moveTo(cx, cy - this._maxR); ctx.lineTo(cx, cy + this._maxR);
    ctx.stroke();

    // Compass labels
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - this._maxR - 6);
    ctx.fillText('S', cx, cy + this._maxR + 14);
    ctx.textAlign = 'left';
    ctx.fillText('E', cx + this._maxR + 6, cy + 4);
    ctx.fillText('W', cx - this._maxR - 20, cy + 4);

    ctx.restore();
  }

  _drawCenter(ctx, cx, cy) {
    ctx.save();

    // Outer glow
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
    grd.addColorStop(0, 'rgba(0,229,255,0.4)');
    grd.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();

    // Solid center dot
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Ring
    ctx.strokeStyle = 'rgba(0,229,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  _drawSignal(ctx, sig, isTarget) {
    const rings = this._rings.get(sig.id) || [];
    const dimFactor = isTarget ? 1.0 : 0.45;

    for (const ring of rings) {
      this._drawCrescentRipple(ctx, ring, sig, isTarget, dimFactor);
    }

    // Hard circle when located
    if (sig.located) {
      this._drawLocatedCircle(ctx, sig, dimFactor);
    }
  }

  /**
   * Draw one crescent ripple ring.
   * A crescent is an arc centred on origin, spanning ~120° around the DoA,
   * with beat waves modulated along it.
   */
  _drawCrescentRipple(ctx, ring, sig, isTarget, dimFactor) {
    const { _cx: cx, _cy: cy } = this;
    const { radius, alpha, doa, strength, active, beatFreq, beatPhase, born } = ring;

    if (radius < 1) return;

    // Convert DoA to canvas angle (0° = North = -90° in canvas coords)
    const doaRad = (doa - 90) * (Math.PI / 180);

    // Crescent span: wider for stronger signals (60°–150°)
    const halfSpan = (Math.PI / 6) + strength * (Math.PI / 4);
    const startAngle = doaRad - halfSpan;
    const endAngle = doaRad + halfSpan;

    // Line thickness based on RSSI strength (1–5 px)
    const lineWidth = isTarget
      ? 1 + strength * 4
      : 0.5 + strength * 2;

    // Color: target = cyan, others = white
    const hue = isTarget ? '0,229,255' : '255,255,255';

    ctx.save();

    // Nested ripple layers (3 layers)
    const layers = 3;
    for (let l = 0; l < layers; l++) {
      const layerOffset = l * 8;
      const r = radius - layerOffset;
      if (r < 1) continue;

      const layerAlpha = alpha * (1 - l * 0.25) * dimFactor;
      if (layerAlpha <= 0) continue;

      // Draw the crescent arc base
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = `rgba(${hue},${layerAlpha.toFixed(3)})`;
      ctx.lineWidth = lineWidth * (1 - l * 0.2);
      ctx.lineCap = 'round';
      ctx.stroke();

      // Beat waves along the crescent
      if (active) {
        this._drawBeatWaves(ctx, cx, cy, r, startAngle, endAngle,
          hue, layerAlpha, beatFreq, beatPhase, born, lineWidth);
      }
    }

    ctx.restore();
  }

  /**
   * Render beat waves as small oscillations along a crescent arc.
   */
  _drawBeatWaves(ctx, cx, cy, radius, startAngle, endAngle,
    hue, alpha, beatFreq, beatPhase, born, baseLineWidth) {
    const steps = 60;
    const span = endAngle - startAngle;
    const beatT = this._time * beatFreq * Math.PI * 2 + beatPhase;
    const waveAmp = 4 + baseLineWidth * 0.5;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${hue},${(alpha * 0.6).toFixed(3)})`;
    ctx.beginPath();

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + t * span;
      const wave = Math.sin(t * Math.PI * 6 + beatT) * waveAmp;
      const r = radius + wave;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Hard glowing circle when RSSI threshold is exceeded (signal located).
   */
  _drawLocatedCircle(ctx, sig, dimFactor) {
    const { _cx: cx, _cy: cy } = this;
    const r = 30 + (sig.strength || 0) * 40;
    const pulse = 0.7 + 0.3 * Math.sin(this._time * 4);

    // DoA direction for glow centre
    const doaRad = (sig.doa - 90) * (Math.PI / 180);
    const dist = this._maxR * 0.35;
    const gx = cx + Math.cos(doaRad) * dist;
    const gy = cy + Math.sin(doaRad) * dist;

    ctx.save();

    // Glow
    const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 1.5);
    grd.addColorStop(0, `rgba(118,255,3,${(0.3 * pulse * dimFactor).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(118,255,3,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(gx, gy, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Hard circle
    ctx.strokeStyle = `rgba(118,255,3,${(pulse * dimFactor).toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = `rgba(118,255,3,${(0.8 * pulse * dimFactor).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(gx, gy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
