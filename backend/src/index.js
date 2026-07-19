'use strict';

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocketServer = require('./utils/wsServer');
const SignalManager = require('./processors/signalManager');
const DemoSDR       = require('./sdr/demoSDR');
const NativeScanner = require('./sdr/nativeScanner');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';
const DEMO_MODE = process.env.DEMO_MODE !== 'false';

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend static files
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// REST endpoints
app.get('/api/status', (_req, res) => {
  res.json({
    mode: DEMO_MODE ? 'demo' : 'hardware',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/api/signals', (_req, res) => {
  res.json(signalManager.getSignals());
});

app.post('/api/target', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  signalManager.setTarget(id);
  res.json({ ok: true, target: id });
});

// ── HTTP + WebSocket server ──────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer(server);

// ── Signal manager ───────────────────────────────────────────────────────────
const signalManager = new SignalManager();

signalManager.on('update', (payload) => {
  wss.broadcast(payload);
});

// ── SDR backend ──────────────────────────────────────────────────────────────
const sdr = DEMO_MODE ? new DemoSDR() : new NativeScanner();

sdr.on('frame', (frame) => {
  signalManager.process(frame);
});

sdr.on('error', (err) => {
  console.error('[SDR] Error:', err.message);
});

// ── Boot ─────────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log(`Mr. Wiggles backend running at http://${HOST}:${PORT}`);
  console.log(`Mode: ${DEMO_MODE ? 'DEMO (synthetic data)' : 'LIVE (WiFi + BLE + ESP32)'}`);
  console.log(`Frontend: http://${HOST}:${PORT}`);
  sdr.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  sdr.stop();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  sdr.stop();
  server.close(() => process.exit(0));
});
