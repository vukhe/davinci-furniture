require('dotenv').config();
require('express-async-errors');

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectDB }           = require('./config/db');
const { initRedis }           = require('./config/redis');
const routes                  = require('./routes/index');
const { errorHandler }        = require('./middleware/errorHandler');
const {
  compressionMiddleware,
  setupLogging,
  requestTracker,
  getActiveRequests,
} = require('./middleware/performance');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Compression (must be first) ───────────────────────
app.use(compressionMiddleware);

// ── Security ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.set('trust proxy', 1); // behind Nginx

app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ── Rate limiting ─────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/login',    rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));

// ── Logging & tracking ────────────────────────────────
setupLogging(app);
app.use(requestTracker);

// ── Body parser ───────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check ──────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status:  'OK',
  pid:     process.pid,
  uptime:  Math.floor(process.uptime()),
  active:  getActiveRequests(),
  memory:  `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  time:    new Date().toISOString(),
}));

// ── API routes ────────────────────────────────────────
app.use('/api', routes);

// ── 404 ───────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route không tồn tại: ${req.method} ${req.path}` })
);

// ── Error handler ─────────────────────────────────────
app.use(errorHandler);

// ── Graceful shutdown ─────────────────────────────────
let server;
const shutdown = (signal) => {
  console.log(`\n[${signal}] Graceful shutdown PID ${process.pid}...`);
  if (server) {
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  } else {
    process.exit(0);
  }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

// ── Start ─────────────────────────────────────────────
const start = async () => {
  await connectDB();
  await initRedis();

  // ── AI Retrain Scheduler ──────────────────────────
  try {
    const scheduler = require('./jobs/retrainScheduler');
    scheduler.start();

    // Mount admin AI routes (protected)
    const { protect, authorize } = require('./middleware/auth');
    app.use('/api/admin/ai', protect, authorize('admin'), scheduler.adminRouter);
  } catch (e) {
    console.warn('[Scheduler] Could not start retrain scheduler:', e.message);
  }

  server = app.listen(PORT, () => {
    console.log(`\n  PID ${process.pid} → http://localhost:${PORT}`);
    console.log(`  Env: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Health: http://localhost:${PORT}/health\n`);
  });
};

start();
