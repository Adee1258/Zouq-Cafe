// Vercel serverless entry point
require('dotenv').config();
const app = require('../src/app');

module.exports = app;
