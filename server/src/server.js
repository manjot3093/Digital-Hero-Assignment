import { createApp } from './app.js';
import env from './config/env.js';
import logger from './utils/logger.js';
import { closePool, healthCheck } from './db/pool.js';
import { startScheduledJobs } from './jobs/scheduler.js';

const app = createApp();

const server = app.listen(env.port, async () => {
  logger.info(`Digital Heroes API listening on :${env.port}`, { env: env.nodeEnv });
  try {
    await healthCheck();
    logger.info('PostgreSQL connection healthy.');
  } catch (error) {
    logger.error('Cannot reach PostgreSQL', { message: error.message });
  }
  startScheduledJobs();
});

/** Finish in-flight requests before the process exits. */
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down.`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason: String(reason) }));

export default server;
