'use strict';

class Renderer {
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._signals = [];
    this._targetId = null;
    this._time = 0;
    this._lastTs = null;
    this._rafId = null;
    this._rings = new Map();
    this._heading = 0;
    this._targetHeading = 0;

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  setSignals(signals) {
    this._signals = signals;
  }

  setTarget(id) {
    this._targetId = id;
  }

  setOrientation(headingDeg) {
    if (typeof headingDeg === 'number' && !Number.isNaN(headingDeg)) {
      this._targetHeading = ((headingDeg % 360) + 360) % 360;
    }
  }

  start() {
    if (this._rafId) return;
    this._lastTs = performance.now();
    this._loop(this._lastTs);
  }

  stop() {
    if (!this._rafId) return;
    cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    this._canvas.width = w * dpr;
    this._canvas.height = h * dpr;
    this._ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._ctx.scale(dpr, dpr);
    this._w = w;
    this._h = h;
    this._cx = w / 2;
    this._cy = h / 2;
    this._maxR = Math.min(w, h) * 0.65;
    this._avatarR = 18;
  }

  _loop(ts) {
    this._rafId = requestAnimationFrame((t) => this._loop(t));
    const dt = (ts - (this._lastTs || ts)) / 1000;
    this._lastTs = ts;
    this._time += dt;
    this._update(dt);
    this._draw();
  }

  _update(dt) {
    this._heading = this._smoothHeading(this._heading, this._targetHeading, dt, 240);

    for (const sig of this._signals) {
      if (!this._rings.has(sig.id)) this._rings.set(sig.id, []);
      const rings = this._rings.get(sig.id);
      const beatFreqSafe = sig.beatFreq > 0 ? sig.beatFreq : 0.5;
      const spawnInterval = 0.42 / beatFreqSafe;

      if (!sig._nextSpawn || this._time >= sig._nextSpawn) {
        sig._nextSpawn = this._time + spawnInterval;
        rings.push({
          travel: 0,
          alpha: 0.85,
          doa: typeof sig.doa === 'number' ? sig.doa : this._heading,
          strength: sig.strength || 0.5,
          active: sig.active,
          beatFreq: sig.beatFreq || 0.5,
          beatPhase: Math.random() * Math.PI * 2,
          directional: sig.bearingAvailable !== false,
        });
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        const speed = this._maxR * (0.22 + (sig.beatFreq || 0.5) * 0.28);
        ring.travel += speed * dt;
        ring.alpha = Math.max(0, 0.85 - (ring.travel / this._maxR) * 0.85);
        if (ring.travel > this._maxR * 1.1) rings.splice(i, 1);
      }
    }

    for (const id of this._rings.keys()) {
      if (!this._signals.find((s) => s.id === id)) this._rings.delete(id);
    }
  }

  _draw() {
    const ctx = this._ctx;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this._w, this._h);

    const targetSig = this._signals.find((s) => s.id === this._targetId);
    for (const sig of this._signals) {
      if (sig.id === this._targetId) continue;
      this._drawSignal(sig, false);
    }
    if (targetSig) this._drawSignal(targetSig, true);

    this._drawPacman();
  }

  _drawSignal(sig, isTarget) {
    const rings = this._rings.get(sig.id) || [];
    for (const ring of rings) {
      if (ring.directional) this._drawDirectionalRipple(ring, isTarget);
      else this._drawFallbackRipple(ring, isTarget);
    }
  }

  _drawDirectionalRipple(ring, isTarget) {
    const ctx = this._ctx;
    const doaRad = (ring.doa - 90) * (Math.PI / 180);
    const originX = this._cx + Math.cos(doaRad) * this._avatarR;
    const originY = this._cy + Math.sin(doaRad) * this._avatarR;
    const radius = Math.max(2, ring.travel);
    const halfSpan = (Math.PI / 8) + ring.strength * (Math.PI / 7);
    const startAngle = doaRad - halfSpan;
    const endAngle = doaRad + halfSpan;
    const hue = isTarget ? '20,20,20' : '120,120,120';

    ctx.save();
    ctx.beginPath();
    ctx.arc(originX, originY, radius, startAngle, endAngle);
    ctx.strokeStyle = `rgba(${hue},${ring.alpha.toFixed(3)})`;
    ctx.lineWidth = isTarget ? 2.4 : 1.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (ring.active) {
      this._drawWave(originX, originY, radius, startAngle, endAngle, ring, isTarget);
    }
    ctx.restore();
  }

  _drawFallbackRipple(ring, isTarget) {
    const ctx = this._ctx;
    const radius = Math.max(2, ring.travel);
    ctx.save();
    ctx.beginPath();
    ctx.arc(this._cx, this._cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${isTarget ? '40,40,40' : '150,150,150'},${(ring.alpha * 0.65).toFixed(3)})`;
    ctx.lineWidth = isTarget ? 1.8 : 1.0;
    ctx.stroke();
    ctx.restore();
  }

  _drawWave(ox, oy, radius, start, end, ring, isTarget) {
    const ctx = this._ctx;
    const steps = 40;
    const span = end - start;
    const beatT = this._time * ring.beatFreq * Math.PI * 2 + ring.beatPhase;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${isTarget ? '40,40,40' : '140,140,140'},${(ring.alpha * 0.5).toFixed(3)})`;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = start + t * span;
      const wave = Math.sin(t * Math.PI * 6 + beatT) * 3;
      const r = radius + wave;
      const x = ox + Math.cos(angle) * r;
      const y = oy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawPacman() {
    const ctx = this._ctx;
    const headingRad = (this._heading - 90) * (Math.PI / 180);
    const mouth = 0.45;

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this._cx, this._cy);
    ctx.arc(this._cx, this._cy, this._avatarR, headingRad + mouth, headingRad - mouth, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _smoothHeading(current, target, dt, maxDegPerSec) {
    const delta = ((((target - current) % 360) + 540) % 360) - 180;
    const maxStep = maxDegPerSec * dt;
    if (Math.abs(delta) <= maxStep) return ((target % 360) + 360) % 360;
    const next = current + Math.sign(delta) * maxStep;
    return ((next % 360) + 360) % 360;
  }
}
