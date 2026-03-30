import express from 'express';
import { createInternalRouter } from './routes/internal.js';
import { createPublicRouter } from './routes/public.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(createPublicRouter());
  app.use(createInternalRouter());
  return app;
}
