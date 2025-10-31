import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { certificatesRouter } from '../routes/certificates.js';
import { healthRouter } from '../routes/health.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { notFoundHandler } from '../middleware/notFoundHandler.js';
import { appConfig } from '../config/appConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan(appConfig.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.use('/api/health', healthRouter);
  app.use('/api/certificates', certificatesRouter);

  if (appConfig.staticFilesDir) {
    const staticPath = path.isAbsolute(appConfig.staticFilesDir)
      ? appConfig.staticFilesDir
      : path.join(__dirname, '../../', appConfig.staticFilesDir);
    app.use(express.static(staticPath));
    app.get('*', (_req, res, next) => {
      if (!staticPath) {
        return next();
      }
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
