// Vercel serverless entry point
// On Vercel, env vars are injected automatically via dashboard — no dotenv needed
// dotenv is only used in local dev via src/server.js
const app = require('../src/app');

module.exports = app;
