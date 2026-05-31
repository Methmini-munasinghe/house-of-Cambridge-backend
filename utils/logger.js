const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

const write = (level, data) => {
  if (LOG_LEVELS[level] > CURRENT_LEVEL) return;
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, ...data });
  if (level === 'error') process.stderr.write(entry + '\n');
  else process.stdout.write(entry + '\n');
};

export const logger = {
  info: (msg, meta = {}) => write('info', { msg, ...meta }),
  warn: (msg, meta = {}) => write('warn', { msg, ...meta }),
  error: (msg, meta = {}) => write('error', { msg, ...meta }),
  debug: (msg, meta = {}) => write('debug', { msg, ...meta }),
};

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('HTTP', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms,
      ip: req.ip,
      user: req.user?._id?.toString() ?? 'guest',
    });
  });
  next();
};