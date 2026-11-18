const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config');
const pkg = require('../package.json');
const { pool, query } = require('./db');
const { initSocket } = require('./socket');
const { startMaintenanceCron } = require('./jobs/maintenanceCron');
const { mountSwagger } = require('./swagger');
const { authenticate, authorizeRole } = require('./middleware/auth');
const authRoutes = require('./routes/auth.routes');
const vehicleRoutes = require('./routes/vehicle.routes');
const driverRoutes = require('./routes/driver.routes');
const routeRoutes = require('./routes/route.routes');
const tripRoutes = require('./routes/trip.routes');
const bookingRoutes = require('./routes/booking.routes');
const reportRoutes = require('./routes/report.routes');
const userRoutes = require('./routes/user.routes');
const auditRoutes = require('./routes/audit.routes');
const notificationRoutes = require('./routes/notification.routes');
const searchRoutes = require('./routes/search.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security & middleware
app.use(helmet());
const allowedOrigins = config.corsOrigin
  ? config.corsOrigin.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Allow render.com and localhost subdomains
      if (/https:\/\/.*\.onrender\.com$/.test(origin) || /http:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoints
app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    return res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('[Health Check Failed]', err.message);
    return res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.get('/health/detailed', authenticate, authorizeRole('admin'), async (_req, res) => {
  let dbStatus = 'ok';
  try {
    await query('SELECT 1');
  } catch (_err) {
    dbStatus = 'error';
  }

  return res.status(dbStatus === 'ok' ? 200 : 503).json({
    db: dbStatus,
    pool: {
      total: pool.totalCount ?? 0,
      idle: pool.idleCount ?? 0,
      waiting: pool.waitingCount ?? 0,
    },
    uptime_sec: Math.round(process.uptime()),
    memory_mb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(2)),
    version: pkg.version,
  });
});

// API Routes
mountSwagger(app);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/routes', routeRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/search', searchRoutes);

// 404 & Global Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start HTTP server, Socket.io, and cron jobs only when executed directly
if (require.main === module) {
  const server = http.createServer(app);
  initSocket(server);
  startMaintenanceCron();
  server.listen(config.port, () => {
    console.log(`FleetFlow TMS API listening on port ${config.port}`);
  });
}

module.exports = app;
