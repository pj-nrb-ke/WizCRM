import { buildApp } from './app.js';
import { config } from './config.js';
import { startHeatMapScheduler } from './services/lead-engine/heat-map/scheduler.js';

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
  startHeatMapScheduler();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
