import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patient.routes.js';
import therapistRoutes from './routes/therapist.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import messageRoutes from './routes/message.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import reviewRoutes from './routes/review.routes.js';
import adminRoutes from './routes/admin.routes.js';

// Import the Prisma singleton + helpers.
import {
  prisma,
  pingDatabase,
  startupDbProbe,
  describeDbError,
} from './db/prisma.js';

// Import Socket.IO setup
import { createSocketServer } from './socket/socket.js';

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Health check endpoint
// ---------------------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get('/health/ready', async (req, res) => {
  try {
    const ms = await pingDatabase();
    res.json({
      status: 'ok',
      database: 'ok',
      pingMs: ms,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      database: 'unreachable',
      message: describeDbError(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/therapists', therapistRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  const msg = String(err.message || '');
  const isDbUnreachable =
    /Can'?t reach database server/i.test(msg) ||
    /Timed out fetching a new connection/i.test(msg) ||
    err.code === 'P1001' ||
    err.code === 'P1002';

  if (isDbUnreachable) {
    res.set('Retry-After', '5');
    return res.status(503).json({
      success: false,
      message: describeDbError(err),
      retryable: true,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Stocker l'instance io pour export après boot
let io = null;

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

const boot = async () => {
  const probe = await startupDbProbe({ retries: 5, delayMs: 2000 });
  if (!probe.ok) {
    console.error(
      '[boot] Database is unreachable after retries. Refusing to start. ' +
        'Common causes: (1) Neon compute is suspended — first request ' +
        'wakes it up, try again in ~30s; (2) bad DATABASE_URL; (3) DNS / ' +
        'firewall blocking port 5432; (4) Neon project deleted or branch removed.',
    );
    console.error('[boot] Last error:', probe.error?.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Liveness  : http://localhost:${PORT}/health`);
    console.log(`Readiness : http://localhost:${PORT}/health/ready`);
  });

  // Attacher Socket.IO au serveur HTTP
  io = createSocketServer(server);

  const shutdown = async (signal) => {
    console.log(`\n[shutdown] received ${signal}, closing server...`);
    server.close(() => console.log('[shutdown] http server closed'));
    try {
      await prisma.$disconnect();
      console.log('[shutdown] prisma disconnected');
    } catch (e) {
      console.warn('[shutdown] prisma disconnect error:', e.message);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

boot();

export { io };
export default app;