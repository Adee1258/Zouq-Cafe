// Entry point — starts the HTTP server + Socket.IO
require('dotenv').config();
const http   = require('http');
const cron   = require('node-cron');
const app    = require('./app');
const prisma = require('./config/prisma');
const { initSocket } = require('./config/socket');
const { runWeeklyReset } = require('./controllers/mission.controller');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    // Wrap express app in a plain HTTP server so Socket.IO can attach
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV}`);

      // ── Weekly missions reset: every Monday at 05:00 PKT (= 00:00 UTC) ──
      // Cron syntax: sec min hour day month weekday
      // '0 0 * * 1' = minute 0, hour 0, any day, any month, weekday 1 (Monday) — UTC
      cron.schedule('0 0 * * 1', () => {
        console.log('[Missions] Running weekly reset (Monday 05:00 PKT)…');
        runWeeklyReset();
      }, { timezone: 'UTC' });

      console.log('⏰ Mission cron scheduled: every Monday 00:00 UTC (05:00 PKT)');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

start();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('\n👋 Server shut down gracefully');
  process.exit(0);
});
