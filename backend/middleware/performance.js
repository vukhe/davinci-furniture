const compression = require('compression');
const morgan      = require('morgan');
const fs          = require('fs');
const path        = require('path');

// Gzip compression – giảm ~70% response size
const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,          // 1 (fast) → 9 (best) – 6 là cân bằng
  threshold: 1024,   // chỉ nén response > 1KB
});

// Access log ra file (production)
const setupLogging = (app) => {
  if (process.env.NODE_ENV === 'production') {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

    const accessLog = fs.createWriteStream(
      path.join(logDir, 'access.log'),
      { flags: 'a' }
    );
    app.use(morgan('combined', { stream: accessLog }));
  } else {
    app.use(morgan('dev'));
  }
};

// Theo dõi concurrent requests
let activeRequests = 0;

const requestTracker = (req, res, next) => {
  activeRequests++;
  res.setHeader('X-Active-Requests', activeRequests);

  let tracked = true;
  const release = () => {
    if (!tracked) return;
    tracked = false;
    activeRequests = Math.max(0, activeRequests - 1);
  };

  // finish: normal response done; close: socket closed early.
  // Guard prevents double-decrement when both events fire.
  res.on('finish', release);
  res.on('close', release);

  // Cảnh báo nếu > 80 concurrent
  if (activeRequests > 80) {
    console.warn(`⚠️  High load: ${activeRequests} concurrent requests`);
  }

  next();
};

const getActiveRequests = () => activeRequests;

module.exports = { compressionMiddleware, setupLogging, requestTracker, getActiveRequests };
