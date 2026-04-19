// ─── 1. Load env config ───────────────────────────────────────────────────────
const env = require('./config/env');

// ─── 2. Imports ───────────────────────────────────────────────────────────────
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const http        = require('http');
const fs          = require('fs');
const path        = require('path');

const { sequelize }     = require('./models');
const routes            = require('./routes');
const auditLogger       = require('./middleware/auditLogger');
const errorHandler      = require('./middleware/errorHandler');
const reminderScheduler = require('./utils/reminderScheduler');
const rateLimiter       = require('./middleware/rateLimiter');
const socketServer      = require('./utils/socketServer');

// ─── 3. Ensure all upload directories exist ───────────────────────────────────
const UPLOAD_DIRS = [
  'documents','certificates','receipts','photos',
  'agreements','evidence','offline','bank_slips',
];
const uploadRoot = env.upload?.path || './uploads';
UPLOAD_DIRS.forEach(dir => {
  const full = path.join(uploadRoot, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// ─── 4. Init Express ──────────────────────────────────────────────────────────
const app = express();

// ─── 5. Security headers ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],  // inline styles needed for PDF/email templates
      imgSrc:         ["'self'", 'data:', 'blob:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for PDF preview
}));

// ─── 6. CORS ──────────────────────────────────────────────────────────────────
// CORS_ORIGINS must be set in production — wildcard '*' is dev-only
if (!process.env.CORS_ORIGINS && process.env.NODE_ENV === 'production') {
  console.warn('[SECURITY] CORS_ORIGINS not set in production — all origins allowed. Set CORS_ORIGINS in .env');
}
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods:        ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials:    true,
}));

// ─── 7. HTTP request logger ───────────────────────────────────────────────────
// HTTP access logging
// In production: write to access.log file for log aggregation (nginx, PM2 logs, etc.)
// In development: colorized dev format to stdout
if (env.nodeEnv === 'production') {
  const logDir = process.env.LOG_DIR || './logs';
  if (!require('fs').existsSync(logDir)) require('fs').mkdirSync(logDir, { recursive: true });
  const accessLogStream = require('fs').createWriteStream(
    require('path').join(logDir, 'access.log'), { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morgan('dev'));
}

// ─── 8. Body parsers ──────────────────────────────────────────────────────────
// PayHere webhook needs raw body for MD5 signature verification — must come BEFORE express.json()
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/x-www-form-urlencoded' }));

// JSON body: 2mb is sufficient for all application data
// File uploads use multipart/form-data via multer (not limited here)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── 9. Request ID — attach unique ID to every request for tracing ──────────────
app.use((req, res, next) => {
  const { randomUUID } = require('crypto');
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// ─── 10. Audit logger ──────────────────────────────────────────────────────────
app.use(auditLogger);

// ─── 10. Global API rate limiter ──────────────────────────────────────────────
app.use('/api/', rateLimiter.api);

// ─── 11. Health check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  // In production: minimal response — don't expose version or uptime to attackers
  if (env.nodeEnv === 'production') {
    return res.json({ status: 'OK' });
  }
  return res.json({
    status:    'OK',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    version:   process.env.npm_package_version || '1.0.0',
  });
});

// ─── 12. All API routes ───────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 12b. Mock PayHere checkout (dev/demo only — disabled in production) ──────
if (process.env.NODE_ENV !== 'production') {
  const mockPayhere = require('./routes/mockPayhere.routes');
  app.use('/mock-payhere', mockPayhere);
  console.log('🔧 Mock PayHere checkout enabled at /mock-payhere/checkout');
}

// ─── 13. 404 handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── 14. Global error handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ─── 15. Boot ─────────────────────────────────────────────────────────────────
const PORT = env.port || 5000;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    if (env.nodeEnv === 'development') {
      // Safe startup: only create missing tables. Do not use alter:true on boot.
      // alter:true can deadlock or hit MySQL key/index limits on large schemas.
      await sequelize.sync();
      console.log('✅ Database models synced (safe mode — creates missing tables only).');
    }

    reminderScheduler.start();
    console.log('✅ All 7 cron jobs started.');

    const server = http.createServer(app);
    socketServer.init(server);

    server.listen(PORT, () => {
      console.log(`\n🚀 Kelaniya Pradeshiya Sabha API`);
      console.log(`   REST:      http://localhost:${PORT}/api/v1`);
      console.log(`   Socket.io: ws://localhost:${PORT}`);
      console.log(`   Health:    http://localhost:${PORT}/health`);
      console.log(`   Mode:      ${env.nodeEnv}\n`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[${signal}] Shutting down gracefully...`);
      server.close(async () => {
        await sequelize.close();
        console.log('Database connection closed. Goodbye.');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

// Process-level safety net — prevents silent crashes on unhandled async errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', { reason, promise });
  // Do not exit — log and continue (PM2/systemd will restart if truly fatal)
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message, err.stack);
  process.exit(1); // Uncaught exceptions leave the app in an unknown state — must restart
});

start();

module.exports = app;
