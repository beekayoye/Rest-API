import crypto from 'node:crypto';

/**
 * Structured request logging middleware (PRD Functional Requirement 17).
 * Logs timestamp, HTTP method, path, status code, response time in ms, and a hashed client IP.
 */
export function requestLogger(req, res, next) {
  const start = performance.now();
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const hashedIp = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

  res.on('finish', () => {
    const durationMs = (performance.now() - start).toFixed(2);
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: `${durationMs}ms`,
      hashedIp,
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[REQ] ${logEntry.timestamp} | ${logEntry.method} ${logEntry.path} -> ${logEntry.statusCode} (${logEntry.durationMs}) [IP:${logEntry.hashedIp}]`);
    }
  });

  next();
}

export default requestLogger;
