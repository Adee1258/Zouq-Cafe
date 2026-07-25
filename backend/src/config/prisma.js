// Singleton Prisma client — with Neon reconnect handling
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

// Neon free tier drops idle connections (os error 10054).
// Wrap every query with one silent retry on connection errors.
const CONNECTION_ERROR_CODES = ['P1011', 'P1001', 'P1002', 'P1008', 'P1017'];

const handler = {
  get(target, prop) {
    const value = target[prop];
    if (typeof value !== 'object' || value === null) return value;

    // Proxy each model delegate (prisma.user, prisma.product, etc.)
    return new Proxy(value, {
      get(modelTarget, method) {
        const fn = modelTarget[method];
        if (typeof fn !== 'function') return fn;

        return async (...args) => {
          try {
            return await fn.apply(modelTarget, args);
          } catch (err) {
            if (CONNECTION_ERROR_CODES.includes(err.code)) {
              // Reconnect and retry once
              try { await target.$disconnect(); } catch (_) {}
              try { await target.$connect(); } catch (_) {}
              return fn.apply(modelTarget, args);
            }
            throw err;
          }
        };
      },
    });
  },
};

module.exports = new Proxy(prisma, handler);
