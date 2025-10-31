import { createServer } from 'http';
import { createApp } from './app/createApp.js';
import { appConfig } from './config/appConfig.js';

async function bootstrap() {
  const app = createApp();
  const server = createServer(app);

  return new Promise<void>((resolve) => {
    server.listen(appConfig.port, () => {
      console.log(`Server listening on port ${appConfig.port}`);
      resolve();
    });
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
