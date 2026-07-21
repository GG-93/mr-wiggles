/**
 * app.js – Main application controller.
 * Wires together the WebSocket client, renderer, and UI.
 */
'use strict';

(function () {

  // ── DOM refs ──────────────────────────────────────────────────────────
  const canvas        = document.getElementById('js-canvas');
  const statusDot     = document.getElementById('js-status-dot');
  const statusText    = document.getElementById('js-status-text');
  const targetSelect  = document.getElementById('js-target-select');
  const signalList    = document.getElementById('js-signal-list');
  const locatedBanner = document.getElementById('js-located-banner');

  const infoSsid     = document.getElementById('js-info-ssid');
  const infoMac      = document.getElementById('js-info-mac');
  const infoRssi     = document.getElementById('js-info-rssi');
  const infoDoa      = document.getElementById('js-info-doa');
  const infoFreq     = document.getElementById('js-info-freq');
  const infoChannel  = document.getElementById('js-info-channel');
  const infoProtocol = document.getElementById('js-info-protocol');
  const infoStatus   = document.getElementById('js-info-status');

  // ── State ─────────────────────────────────────────────────────────────
  let signals   = [];
  let targetId  = null;

  // ── Renderer ──────────────────────────────────────────────────────────
  const renderer = new Renderer(canvas);
  renderer.start();

  // ── WebSocket ─────────────────────────────────────────────────────────
  const wsUrl = `ws://${location.host}/ws`;
  const ws = new WsClient(wsUrl);

  ws.addEventListener('open', () => {
    setStatus('connected', 'Connected');
  });

  ws.addEventListener('close', () => {
    setStatus('disconnected', 'Disconnected');
  });

  ws.addEventListener('reconnecting', (e) => {
    const delay = (e.detail.delay / 1000).toFixed(1);
    setStatus('connecting', `Reconnecting in ${delay}s…`);
  });

  ws.addEventListener('message', (e) => {
    const payload = e.detail;
    if (payload.type === 'update') {
      signals = payload.signals || [];
      handleUpdate(payload);
    }
  });

  ws.connect();

  // ── Signal selection ──────────────────────────────────────────────────
  targetSelect.addEventListener('change', () => {
    targetId = targetSelect.value || null;
    renderer.setTarget(targetId);
    if (targetId) {
      ws.send({ type: 'setTarget', id: targetId });
      fetch('/api/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId }),
      }).catch(() => {});
    }
    updateInfoPanel();
  });

  // ── Core update handler ───────────────────────────────────────────────
  function handleUpdate(payload) {
    renderer.setSignals(signals);

    // If server changed target externally, sync
    if (payload.targetId && payload.targetId !== targetId) {
      targetId = payload.targetId;
      renderer.setTarget(targetId);
      targetSelect.value = targetId;
    }

    updateSelectOptions();
    updateSignalList();
    updateInfoPanel();
    updateLocatedBanner();
  }

  // ── UI helpers ────────────────────────────────────────────────────────

  function setStatus(state, text) {
    statusDot.className = `status-dot status-dot--${state}`;
    statusText.textContent = text;
  }

  function updateSelectOptions() {
    // Keep selected value if still valid
    const selected = targetSelect.value;
    const ids = new Set(signals.map((s) => s.id));

    // Remove stale options
    Array.from(targetSelect.options).forEach((opt) => {
      if (opt.value && !ids.has(opt.value)) opt.remove();
    });

    // Add new options
    for (const sig of signals) {
      if (!targetSelect.querySelector(`option[value="${sig.id}"]`)) {
        const opt = document.createElement('option');
        opt.value = sig.id;
        opt.textContent = `${sig.ssid} (${sig.mac})`;
        targetSelect.appendChild(opt);
      }
    }

    // Restore selection
    if (selected && ids.has(selected)) {
      targetSelect.value = selected;
    }
  }

  function updateSignalList() {
    // Build a map of current items
    const existing = new Map(
      Array.from(signalList.querySelectorAll('li[data-id]'))
        .map((el) => [el.dataset.id, el])
    );

    const ids = new Set(signals.map((s) => s.id));

    // Remove stale
    for (const [id, el] of existing) {
      if (!ids.has(id)) el.remove();
    }

    for (const sig of signals) {
      let item = existing.get(sig.id);
      if (!item) {
        item = document.createElement('li');
        item.className = 'signal-list__item';
        item.dataset.id = sig.id;
        item.innerHTML = `
          <span class="signal-list__dot"></span>
          <span class="signal-list__name"></span>
          <span class="signal-list__rssi"></span>
        `;
        item.addEventListener('click', () => {
          targetSelect.value = sig.id;
          targetSelect.dispatchEvent(new Event('change'));
        });
        signalList.appendChild(item);
      }

      const dot  = item.querySelector('.signal-list__dot');
      const name = item.querySelector('.signal-list__name');
      const rssi = item.querySelector('.signal-list__rssi');

      const strength = sig.strength || 0;
      const color = strengthToColor(strength);
      dot.style.background = color;
      name.textContent = sig.ssid || sig.mac;
      rssi.textContent = `${sig.rssi ? sig.rssi.toFixed(1) : '—'} dBm`;

      item.classList.toggle('signal-list__item--target', sig.id === targetId);
    }
  }

  function updateInfoPanel() {
    const sig = signals.find((s) => s.id === targetId);
    if (!sig) {
      [infoSsid, infoMac, infoRssi, infoDoa, infoFreq, infoChannel, infoProtocol, infoStatus]
        .forEach((el) => { el.textContent = '—'; });
      return;
    }
    infoSsid.textContent     = sig.ssid || '—';
    infoMac.textContent      = sig.mac || '—';
    infoRssi.textContent     = sig.rssi != null ? `${sig.rssi.toFixed(1)} dBm` : '—';
    infoDoa.textContent      = sig.doa != null ? `${sig.doa.toFixed(1)}°` : '—';
    infoFreq.textContent     = sig.freqMHz ? `${sig.freqMHz} MHz` : '—';
    infoChannel.textContent  = sig.channel || '—';
    infoProtocol.textContent = sig.protocol || '—';
    infoStatus.textContent   = sig.located ? '📍 Located' : sig.active ? '📡 Active' : '💤 Idle';
    infoStatus.style.color   = sig.located ? '#76ff03' : sig.active ? '#00e5ff' : '#888';
  }

  function updateLocatedBanner() {
    const located = signals.some((s) => s.id === targetId && s.located);
    locatedBanner.classList.toggle('hidden', !located);
  }

  /** Map 0–1 strength to a colour (blue → cyan → green) */
  function strengthToColor(s) {
    if (s < 0.3) return '#2196f3';
    if (s < 0.6) return '#00e5ff';
    if (s < 0.8) return '#76ff03';
    return '#ff4081';
  }

})();
