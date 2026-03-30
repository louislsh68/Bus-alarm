import 'dotenv/config';
import { createApp } from './app.js';
import { startCatalogRefreshLoop } from './transit/services/catalogRefreshService.js';
import { startStopRefreshLoop } from './transit/services/stopRefreshLoopService.js';

const app = createApp();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, async () => {
  console.log(`🚌 BusAlarm backend listening on http://${host}:${port}`);
  await startCatalogRefreshLoop();
  await startStopRefreshLoop();
});
