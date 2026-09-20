import env from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[process.env.LOG_LEVEL ?? (env.isProduction ? 'info' : 'debug')] ?? 2;

function emit(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = { level, time: new Date().toISOString(), message, ...(meta ? { meta } : {}) };
  const serialised = env.isProduction ? JSON.stringify(line) : `${line.time} ${level.toUpperCase()} ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
  if (level === 'error') console.error(serialised);
  else if (level === 'warn') console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
};

export default logger;
