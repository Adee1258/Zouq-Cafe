// Entry point — starts the HTTP server + Socket.IO
require('dotenv').config();
const http   = require('http');
const app    = require('./app');
const prisma = require('./config/prisma');
const { initSocket } = require('./config/socket');

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
