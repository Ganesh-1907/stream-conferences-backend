import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';
import apiRouter from './routes/index.js';
import { initSocket } from './services/chatSocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 7867;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Serve uploaded files (brochure / banner / logo)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error] Unhandled exception:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect database and listen
async function startServer() {
  await connectDB();
  const httpServer = http.createServer(app);
  initSocket(httpServer);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Express API server running on http://localhost:${PORT}`);
  });
}

startServer();
