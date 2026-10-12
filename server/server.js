/**
 * server/server.js
 * QRDine backend entry point.
 *
 * Express HTTP server + Socket.IO, mounted menu/order routes, static vendor
 * dashboard, and real-time order synchronization.
 */

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import { buildMenuPayload } from './config/menuData.js';
import menuRoutes from './routes/menuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { setupSocketHandler } from './sockets/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to server directory first, then process.cwd() fallback
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// Ensure HASH_SECRET has a reliable fallback
process.env.HASH_SECRET = process.env.HASH_SECRET || 'canteen-dev-secret-2026-sha256-verified';

const VIEWS_DIR = path.join(__dirname, 'views');

export function createApp() {
  const PORT = Number(process.env.PORT) || 3000;
  const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:8080').replace(/\/+$/, '');

  const app = express();
  const server = http.createServer(app);

  // Check if an origin is allowed (allows localhost, 127.0.0.1, LAN IPs in dev, and CLIENT_URL)
  const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (origin === CLIENT_URL) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    // Allow private LAN IPs (e.g. 192.168.x.x, 10.x.x.x, 172.16-31.x.x) for mobile testing
    if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)) return true;
    return true; // Permissive for local dev & testing
  };

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 20000,
    pingInterval: 25000
  });

  // --- Middleware ---
  app.use(cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  }));
  app.use(express.json({ limit: '1mb' }));

  // Expose the Socket.IO server on every request so controllers can emit events.
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // --- Static views (vendor dashboard) ---
  // Serve socket.io client script automatically from node_modules if present
  const socketDist = path.join(__dirname, 'node_modules/socket.io/client-dist');
  if (fs.existsSync(socketDist)) {
    app.use('/socket.io', express.static(socketDist));
  }
  app.use(express.static(VIEWS_DIR));

  // --- API routes ---
  app.use('/api/menu', menuRoutes);
  app.use('/api/order', orderRoutes);

  // Convenience: serve the authoritative menu at a root-ish path too.
  app.get('/api', (req, res) => {
    res.json(buildMenuPayload());
  });

  // --- Socket.IO ---
  setupSocketHandler(io);

  // --- Error handling ---
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return { app, server, io, PORT };
}

// Only start listening when this file is run directly (not imported by tests).
const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === __filename ||
  path.resolve(process.argv[1]).endsWith(`${path.sep}server.js`)
);

if (isMain) {
  const { app, server, io, PORT } = createApp();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
  ============================================
   QRDine Backend
   ============================================
   Server running on: http://localhost:${PORT}
   Vendor dashboard:  http://localhost:${PORT}/vendor-dashboard.html
   API base:          http://localhost:${PORT}/api
   CORS origin:       ${process.env.CLIENT_URL || 'http://localhost:8080'} (and dev origins)
  `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port ${PORT} is already in use. Set PORT env to a free port.`);
    } else {
      console.error('[Server] Startup error:', err.message);
    }
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
  });
}