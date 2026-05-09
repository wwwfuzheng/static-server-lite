import { createApp } from './app.js';
import { loadConfig } from './config/index.js';
import { createLogger } from './middleware/logger.js';

const config = loadConfig();
const logger = createLogger(config);
const app = createApp(config, logger);

app.listen(config.port, () => {
  logger.info({ port: config.port, staticRoot: config.staticRoot }, 'server started');
});
