// Singleton Prisma client
const { PrismaClient } = require('@prisma/client');

// Vercel serverless mein har invocation pe naya instance ban sakta hai
// global variable se reuse karte hain
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
