import { env } from './env.js';
import './db/connection.js'; // führt schema.sql aus, bevor Anfragen bearbeitet werden
import { createApp } from './app.js';

process.on('unhandledRejection', (reason) => console.error('[process] unhandledRejection', reason));
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException', err);
  process.exit(1); // Zustand unklar → pm2 startet sauber neu
});

const app = createApp();
app.listen(env.port, () => {
  console.log(`[math-learning-server] läuft auf :${env.port} (${env.nodeEnv}, Datenbank: ${env.databasePath})`);
});
