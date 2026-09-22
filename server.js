import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config/index.js';
import rateLimiter from './middleware/rateLimiter.js';
import requestLogger from './middleware/requestLogger.js';
import errorHandler from './middleware/errorHandler.js';
import v1Router from './routes/v1.js';
import ApiError from './utils/apiError.js';

const app = express();

// Global Middleware
app.use(cors({ origin: '*' }));
app.use(requestLogger);

// Handle JSON body parsing with custom error handling for malformed JSON
app.use(express.json({
  verify: (req, res, buf) => {
    try {
      if (buf.length) JSON.parse(buf.toString());
    } catch {
      throw ApiError.badRequest('Malformed JSON body syntax.');
    }
  },
}));

// Serve static frontend consumer and design token files
app.use(express.static('.'));
app.use('/consumer', express.static('consumer'));

// Rate Limiter applied to API routes
app.use('/api', rateLimiter);

// API v1 Routes
app.use('/api/v1', v1Router);

// Serve consumer/index.html at root route /
app.get('/', (req, res) => {
  res.sendFile(path.resolve('consumer/index.html'));
});

// 404 handler for undefined API routes
app.all('/api/*', (req, res, next) => {
  next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} not found.`));
});

// Centralized Error Handling Middleware (Zero 500s on client error)
app.use(errorHandler);

// Only listen if executed directly as entrypoint (not when imported in tests)
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`Food Delivery API server running at: http://localhost:${config.port}`);
  });
}

export default app;
